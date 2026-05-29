-- Migración Inicial para la Arquitectura Híbrida Server-Authoritative (Fase 9.1)
-- Implementa Event Sourcing, OCC, y Stored Procedures para transacciones atómicas.

-- 1. Habilitar extensión pgcrypto para UUIDs (Si no está habilitada)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Tabla Principal: matches (Estado Global y Snapshot)
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
    turn_number INTEGER NOT NULL DEFAULT 1,
    active_player_id UUID NOT NULL,
    winner_id UUID NULL,
    host_id UUID NOT NULL,
    guest_id UUID NULL,
    state_version INTEGER NOT NULL DEFAULT 0, -- CRÍTICO: last_sequence_number
    current_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, -- Optimización para Hard-Sync
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla Secundaria: match_players (Datos inmutables por jugador en una partida)
CREATE TABLE match_players (
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    is_host BOOLEAN NOT NULL DEFAULT false,
    deck_snapshot JSONB NOT NULL, -- Las 20 cartas congeladas al momento del matchmaking
    lives INTEGER NOT NULL DEFAULT 3,
    energy INTEGER NOT NULL DEFAULT 1,
    connection_status TEXT NOT NULL DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected')),
    PRIMARY KEY (match_id, user_id)
);

-- 4. Tabla Crítica: match_events (Ledger Inmutable para Event Sourcing)
CREATE TABLE match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL, -- Versión estricta
    client_action_id UUID NOT NULL, -- Para idempotencia
    player_id UUID NOT NULL,
    action_type TEXT NOT NULL, -- Ej: 'PLAY_CARD', 'ATTACK', 'END_TURN'
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CONSTRAINTS CRÍTICOS PARA PREVENIR RACE CONDITIONS Y HACKS
-- 4.1. Garantizar orden estricto y evitar colisión concurrente (OCC)
ALTER TABLE match_events ADD CONSTRAINT unique_match_sequence UNIQUE (match_id, sequence_number);

-- 4.2. Idempotencia: Evitar doble ejecución por Retry/Packet Loss
ALTER TABLE match_events ADD CONSTRAINT unique_match_client_action UNIQUE (match_id, client_action_id);

-- 5. Tabla de Telemetría: shadow_telemetry_logs (Para monitorear el Shadow Mode)
CREATE TABLE shadow_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('DESYNC', 'HARD_SYNC', 'ROLLBACK', 'PACKET_FAULT', 'DUPLICATE_ACTION')),
    latency_ms INTEGER NULL,
    description TEXT,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. ÍNDICES DE RENDIMIENTO
CREATE INDEX idx_matches_status ON matches(status) WHERE status = 'playing';
CREATE INDEX idx_match_events_match_seq ON match_events(match_id, sequence_number);

-- 7. STORED PROCEDURE ATÓMICO: apply_battle_action
-- Ejecuta el evento y el snapshot dentro de una única transacción sellada con Row Locking
CREATE OR REPLACE FUNCTION apply_battle_action(
    p_match_id UUID,
    p_client_action_id UUID,
    p_player_id UUID,
    p_action_type TEXT,
    p_event_payload JSONB,
    p_new_snapshot JSONB,
    p_next_turn_number INTEGER,
    p_next_active_player UUID,
    p_winner_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_current_version INTEGER;
    v_winner_id UUID;
    v_status TEXT;
BEGIN
    -- A. Bloqueo de concurrencia: Adquirir Lock sobre el Match (Bloquea requests simultáneos)
    SELECT state_version, winner_id, status 
    INTO v_current_version, v_winner_id, v_status
    FROM matches 
    WHERE id = p_match_id 
    FOR UPDATE;

    -- Validaciones preventivas
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Match_Not_Found');
    END IF;

    IF v_status != 'playing' THEN
        RETURN jsonb_build_object('error', 'Match_Not_Playing');
    END IF;

    IF v_winner_id IS NOT NULL THEN
        RETURN jsonb_build_object('error', 'Match_Already_Finished');
    END IF;

    -- B. Chequeo de Idempotencia (¿Ya procesamos este POST por un retry de red móvil?)
    IF EXISTS (SELECT 1 FROM match_events WHERE match_id = p_match_id AND client_action_id = p_client_action_id) THEN
        RETURN jsonb_build_object(
            'status', 'already_processed', 
            'state_version', v_current_version
        );
    END IF;

    -- C. Insertar en el Libro Mayor (Incrementando el Sequence a la fuerza)
    INSERT INTO match_events (
        match_id, sequence_number, client_action_id, player_id, action_type, payload
    ) VALUES (
        p_match_id, v_current_version + 1, p_client_action_id, p_player_id, p_action_type, p_event_payload
    );

    -- D. Actualizar Estado Global de Optimización (El Snapshot)
    UPDATE matches 
    SET 
        current_snapshot = p_new_snapshot,
        state_version = v_current_version + 1,
        turn_number = COALESCE(p_next_turn_number, turn_number),
        active_player_id = COALESCE(p_next_active_player, active_player_id),
        winner_id = p_winner_id,
        status = CASE WHEN p_winner_id IS NOT NULL THEN 'finished' ELSE status END,
        updated_at = NOW()
    WHERE id = p_match_id;

    -- E. Retorno Exitoso. Si hay Broadcast Realtime, la Edge Function debe hacerlo DESPUÉS de que retorne esto.
    RETURN jsonb_build_object(
        'status', 'success', 
        'state_version', v_current_version + 1
    );

EXCEPTION
    -- F. Captura Genérica de Errores (Asegura ROLLBACK Implícito)
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', 'Transaction_Failed',
            'detail', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- 8. POLÍTICAS RLS BÁSICAS (Row Level Security)
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_telemetry_logs ENABLE ROW LEVEL SECURITY;

-- Políticas temporales (Permisivas para Edge Functions usando Service Role)
-- Todo debe ser orquestado por el backend a partir de ahora, no por el cliente insertando a lo loco.
CREATE POLICY "Lectura pública para participantes" ON matches FOR SELECT USING (true);
CREATE POLICY "Lectura eventos para la partida" ON match_events FOR SELECT USING (true);
