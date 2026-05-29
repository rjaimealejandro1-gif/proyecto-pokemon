import { Injectable, signal, computed, inject } from '@angular/core';
import { SyncLoggerService } from './sync-logger.service';
import { SupabaseService } from './supabase.service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ChannelName = 'matchmaking' | 'game-events' | 'player-presence';

export interface RealtimeChannel {
  name: ChannelName;
  status: 'idle' | 'subscribing' | 'subscribed' | 'error';
  subscribedAt?: string;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

/**
 * RealtimeChannelService — Arquitectura preparada para Fase 5 (PvP Multiplayer).
 *
 * ESTADO ACTUAL: Canales definidos pero NO suscritos.
 * Fase 5 activará las suscripciones reales cuando el matchmaking esté listo.
 *
 * Canales planificados:
 *   - matchmaking     → búsqueda de partida
 *   - game-events     → eventos de batalla en tiempo real
 *   - player-presence → estado online de jugadores
 */
@Injectable({ providedIn: 'root' })
export class RealtimeChannelService {

  private readonly supabase  = inject(SupabaseService);
  private readonly syncLogger = inject(SyncLoggerService);

  // Map para trackear todos los canales activos y evitar zombies
  private activeChannels = new Map<string, any>();
  private matchmakingTimeoutId: any = null;
  private lastUserId: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => this.handleVisibilityChange());
      window.addEventListener('focus', () => this.handleFocus());
      window.addEventListener('online', () => this.handleOnline());
    }
  }

  private handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      console.log(`[VISIBILITY] La pestaña volvió al foco (visible)`);
      this.attemptSilentRecovery();
    } else {
      console.log(`[VISIBILITY] La pestaña pasó a background (hidden)`);
    }
  }

  private handleFocus() {
    console.log(`[FOCUS] El usuario volvió a la ventana`);
    this.attemptSilentRecovery();
  }

  private handleOnline() {
    console.log(`[FOCUS] Conexión a internet restaurada`);
    this.attemptSilentRecovery();
  }

  private attemptSilentRecovery() {
    console.log(`[RECONNECT] Verificando estado de canales activos...`);
    for (const [topic, channel] of Array.from(this.activeChannels.entries())) {
      console.log(`[HEARTBEAT] Verificando canal: ${topic} - estado: ${channel.state}`);
      if (channel.state !== 'joined' && channel.state !== 'joining') {
        console.log(`[RECONNECT] Canal ${topic} inactivo. Intentando recuperación silenciosa...`);
        // Intentar resubscribe manual
        channel.subscribe(async (status: string) => {
          console.log(`[SOCKET] Recuperación ${topic} status=${status}`);
          if (status === 'SUBSCRIBED' && this.lastUserId) {
            console.log(`[PRESENCE] Restaurando track de usuario: ${this.lastUserId}`);
            await channel.track({ userId: this.lastUserId });
            console.log(`[PRESENCE] Track restaurado exitosamente.`);
          }
        });
      }
    }
  }

  // ── Signals de estado ──────────────────────────────────────────────────────
  readonly channels = signal<RealtimeChannel[]>([
    { name: 'matchmaking',      status: 'idle' },
    { name: 'game-events',      status: 'idle' },
    { name: 'player-presence',  status: 'idle' },
  ]);

  readonly presenceMap = signal<Record<string, { userId: string; username: string; status: string }>>({});

  readonly activeChannelCount = computed(() =>
    this.channels().filter(c => c.status === 'subscribed').length
  );

  readonly isReady = computed(() =>
    this.channels().every(c => c.status === 'idle' || c.status === 'subscribed')
  );

  // ── API Pública (Fase 5 llamará estos métodos) ─────────────────────────────

  /**
   * Suscribe al canal de matchmaking usando PRESENCE para emparejamiento P2P.
   * FASE 7 (Opción A): Buscar rivales activos y negociar partida.
   * FASE 8: Incluye timeout de 30 segundos si no hay rivales.
   */
  async subscribeMatchmaking(
    userId: string,
    onMatch: (roomId: string, opponentId: string, isHost: boolean) => void,
    onTimeout?: () => void
  ): Promise<void> {
    console.log(`%c[MATCHMAKING] subscribeMatchmaking() iniciado para userId=${userId}`, 'color:#00b4d8;font-weight:bold');
    this._setChannelStatus('matchmaking', 'subscribing');
    try {
      // 1. Limpieza estricta de canal previo (Zombies)
      if (this.activeChannels.has('matchmaking')) {
        console.warn('[MATCHMAKING] Canal zombie detectado. Purgando...');
        const oldChannel = this.activeChannels.get('matchmaking');
        await this.supabase.client.removeChannel(oldChannel);
        this.activeChannels.delete('matchmaking');
      }

      const channel = this.supabase.client.channel('matchmaking', {
        config: { presence: { key: userId } }
      });
      this.activeChannels.set('matchmaking', channel);

      let matchFound = false;

      const triggerOnMatch = (opponentId: string, roomId: string, isHost: boolean) => {
        console.log(`%c[MATCHMAKING] ✅ MATCH CONFIRMADO — Sala=${roomId} | Rival=${opponentId} | Soy Host=${isHost}`, 'color:#2ec4b6;font-weight:bold;font-size:14px');
        if (this.matchmakingTimeoutId) {
          clearTimeout(this.matchmakingTimeoutId);
          this.matchmakingTimeoutId = null;
        }
        onMatch(roomId, opponentId, isHost);
      };

      channel
        .on('presence', { event: 'sync' }, () => {
          if (matchFound) return;

          const state = channel.presenceState<{ userId: string; status: string; target?: string; roomId?: string }>();
          const allPlayers = Object.values(state).flatMap(p => p);
          console.log(`[PRESENCE] sync — MiId=${userId} | JugadoresEnCanal=${allPlayers.length}`, allPlayers);

          // 1. ¿Alguien me invitó? (Soy Guest)
          const matchedWithMe = allPlayers.find(p => p.target === userId && p.status === 'matched');
          if (matchedWithMe) {
            matchFound = true;
            console.log(`%c[MATCHMAKING] ✅ Fui seleccionado por ${matchedWithMe.userId} (Host). Únicamente navego a la sala.`, 'color:#ffb703;font-weight:bold');
            triggerOnMatch(matchedWithMe.userId, matchedWithMe.roomId!, false);
            return;
          }

          // 2. ¿Yo ya invité a alguien? (Soy Host)
          const myPresence = allPlayers.find(p => p.userId === userId && p.status === 'matched');
          if (myPresence && myPresence.target && myPresence.roomId) {
            matchFound = true;
            console.log(`%c[MATCHMAKING] ✅ Confirmé mi rol como Host. Esperando a ${myPresence.target} en sala ${myPresence.roomId}.`, 'color:#ffb703;font-weight:bold');
            triggerOnMatch(myPresence.target, myPresence.roomId, true);
            return;
          }

          // 3. Si estoy buscando, verificar si puedo ser Host
          const myCurrentStatus = allPlayers.find(p => p.userId === userId)?.status;
          if (myCurrentStatus === 'searching') {
            // Filtramos a todos los que están buscando y quitamos duplicados de cuentas en múltiples pestañas
            const uniqueSearching = Array.from(new Map(allPlayers.filter(p => p.status === 'searching').map(p => [p.userId, p])).values());
            uniqueSearching.sort((a, b) => a.userId.localeCompare(b.userId));

            if (uniqueSearching.length >= 2) {
              // Si soy el ID más pequeño, tomo la iniciativa de invitar al segundo más pequeño
              if (uniqueSearching[0].userId === userId) {
                const guest = uniqueSearching[1];
                const newRoomId = `room_${userId}_${guest.userId}`;
                console.log(`[MATCHMAKING] 👑 Soy Host (${userId} < ${guest.userId}). Invitando a ${guest.userId} a la sala ${newRoomId}...`);
                channel.track({ userId, status: 'matched', target: guest.userId, roomId: newRoomId }).catch(console.error);
              } else {
                console.log(`[MATCHMAKING] ⏳ Esperando invitación (mi ID no es el menor de la lista).`);
              }
            } else {
              console.log(`[MATCHMAKING] 🔍 Buscando oponentes...`);
            }
          }
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log(`[PRESENCE] 👋 JOIN — key=${key}`, newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log(`[PRESENCE] 👋 LEAVE — key=${key}`, leftPresences);
        })
        .subscribe(async (wsStatus) => {
          console.log(`[CHANNEL_STATE] matchmaking → wsStatus=${wsStatus}`);
          if (wsStatus === 'SUBSCRIBED') {
            this._setChannelStatus('matchmaking', 'subscribed');
            console.log(`[MATCHMAKING] ✅ Canal suscrito. Haciendo track con estado 'searching'...`);
            await channel.track({ userId, status: 'searching' });
            console.log(`[MATCHMAKING] Track enviado. Esperando presence sync...`);

            this.matchmakingTimeoutId = setTimeout(async () => {
              if (!matchFound) {
                console.warn('[MATCHMAKING] ⏱️ Timeout de 30s alcanzado. Cancelando búsqueda.');
                await this.unsubscribeMatchmaking();
                if (onTimeout) onTimeout();
              }
            }, 30000);
          } else if (wsStatus === 'CLOSED') {
            console.log(`[CHANNEL_STATE] Canal matchmaking cerrado legítimamente o por cleanup.`);
          } else {
            console.error(`[CHANNEL_STATE] ❌ Error en canal matchmaking: ${wsStatus}`);
            this._setChannelStatus('matchmaking', 'error');
          }
        });
    } catch (err) {
      this._setChannelStatus('matchmaking', 'error');
      console.error('[MATCHMAKING] Error crítico suscribiendo matchmaking:', err);
    }
  }

  /**
   * Suscribe a eventos de batalla en tiempo real.
   * FASE 5: Llamar desde BattleStore cuando empiece una batalla PvP.
   * FASE 8: Incluye Presence para detectar desconexión del rival.
   */
  async subscribeGameEvents(
    gameId: string,
    userId: string,
    onEvent: (payload: unknown) => void,
    onRivalPresenceChange?: (isPresent: boolean) => void
  ): Promise<void> {
    console.log(`%c[ONLINE_FLOW] subscribeGameEvents() — gameId=${gameId} userId=${userId}`, 'color:#a8dadc;font-weight:bold');
    this._setChannelStatus('game-events', 'subscribing');
    this.lastUserId = userId;
    
    return new Promise((resolve, reject) => {
      try {
        const topic = `game-${gameId}`;

        if (this.activeChannels.has(topic)) {
          console.warn(`[ONLINE_FLOW] Canal zombie detectado para ${topic}. Purgando...`);
          const oldChannel = this.activeChannels.get(topic);
          this.supabase.client.removeChannel(oldChannel);
          this.activeChannels.delete(topic);
        }

        const channel = this.supabase.client.channel(topic, {
          config: { presence: { key: userId } }
        });
        this.activeChannels.set(topic, channel);
        
        console.log(`[GAME_ROOM] Canal creado`);
        console.log(`[GAME_ROOM] roomId=${gameId}`);
        console.log(`[GAME_ROOM] activeChannels size=${this.activeChannels.size}`);

        channel
          .on('broadcast', { event: 'game_action' }, (payload: any) => {
            console.log(`[ONLINE_FLOW] 📥 game_action recibido:`, payload['payload']);
            onEvent(payload['payload']);
          })
          .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState<{ userId: string }>();
            const onlinePlayers = Object.values(state).flatMap(p => p).map(p => p.userId);
            console.log(`[GAME_ROOM] Presence users=${onlinePlayers.length}`);
            console.log(`[BARRIER_SYNC] presence sync en sala — jugadores: [${onlinePlayers.join(', ')}]`);
            const rivalIsHere = onlinePlayers.some(id => id !== userId);
            if (onRivalPresenceChange) {
              onRivalPresenceChange(rivalIsHere);
            }
          })
          .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log(`[BARRIER_SYNC] 👋 JOIN en sala game — key=${key}`, newPresences);
          })
          .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log(`[BARRIER_SYNC] 💀 LEAVE en sala game — key=${key}`, leftPresences);
          })
          .subscribe(async (wsStatus) => {
            console.log(`[CHANNEL_STATE] game-events (${topic}) → wsStatus=${wsStatus}`);
            if (wsStatus === 'SUBSCRIBED') {
              this._setChannelStatus('game-events', 'subscribed');
              await channel.track({ userId });
              console.log(`[GAME_ROOM] SUBSCRIBED`);
              console.log(`[BARRIER_SYNC] ✅ Suscrito a sala de juego y track enviado`);
              resolve();
            } else if (wsStatus === 'CLOSED') {
              console.log(`[CHANNEL_STATE] Canal game-events (${topic}) cerrado legítimamente.`);
            } else {
              console.error(`[CHANNEL_STATE] ❌ Error canal game-events: ${wsStatus} (Canal no destruido, esperando recovery)`);
              this._setChannelStatus('game-events', 'error');
              // No hacemos reject inmediato si es TIMED_OUT o CHANNEL_ERROR, porque podría ser un background tab.
              // Dejamos que el silent recovery lo intente arreglar.
            }
          });
      } catch (err) {
        this._setChannelStatus('game-events', 'error');
        console.error('[ONLINE_FLOW] Error crítico suscribiendo game-events:', err);
        reject(err);
      }
    });
  }

  /**
   * Emite una acción de juego por el canal activo ya suscrito.
   * ⚠️ FIX CRÍTICO: Se reutiliza el canal del activeChannels en lugar de crear uno nuevo efímero.
   * Crear `supabase.client.channel()` sin suscribirse NO envía mensajes a los suscriptores reales.
   */
  async broadcastGameEvent(gameId: string, payload: unknown): Promise<void> {
    const topic = `game-${gameId}`;
    const channel = this.activeChannels.get(topic);
    
    if (!channel) {
      console.error(`[ONLINE_FLOW] ❌ broadcastGameEvent FALLÓ: No hay canal activo para ${topic}. El mensaje NO será enviado.`);
      console.log(`[GAME_ROOM] canal encontrado=false`);
      return;
    }
    
    // Safety check that channel is fully subscribed before sending
    if (channel.state !== 'joined') {
      console.warn(`[ONLINE_FLOW] ⚠️ El canal ${topic} no está SUBSCRIBED (estado: ${channel.state}). Intentando recuperación silenciosa antes de enviar...`);
      this.attemptSilentRecovery();
      
      // Esperar brevemente para permitir la reconexión y reintentar una vez
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (channel.state !== 'joined') {
        console.error(`[ONLINE_FLOW] ❌ broadcastGameEvent FALLÓ: Timeout esperando recuperación del canal ${topic}. El mensaje se ha perdido.`);
        return;
      }
    }

    try {
      console.log(`[GAME_ROOM] canal encontrado=true`);
      console.log(`[GAME_ROOM] canal.state=SUBSCRIBED`);
      console.log(`[ONLINE_FLOW] 📤 Enviando game_action a ${topic}:`, payload);
      await channel.send({
        type: 'broadcast',
        event: 'game_action',
        payload: payload
      });
    } catch (err) {
      console.error('[ONLINE_FLOW] Error emitiendo game_action:', err);
    }
  }

  /**
   * Desuscribe de eventos de batalla (Fase 8)
   */
  async unsubscribeGameEvents(gameId: string): Promise<void> {
    const topic = `game-${gameId}`;
    const channel = this.activeChannels.get(topic);
    if (channel) {
      await this.supabase.client.removeChannel(channel);
      this.activeChannels.delete(topic);
      this._setChannelStatus('game-events', 'idle');
    }
  }

  /**
   * Cancela la búsqueda de matchmaking (Fase 8)
   */
  async unsubscribeMatchmaking(): Promise<void> {
    if (this.matchmakingTimeoutId) {
      clearTimeout(this.matchmakingTimeoutId);
      this.matchmakingTimeoutId = null;
    }
    const channel = this.activeChannels.get('matchmaking');
    if (channel) {
      await this.supabase.client.removeChannel(channel);
      this.activeChannels.delete('matchmaking');
      this._setChannelStatus('matchmaking', 'idle');
    }
  }

  /**
   * Suscribe al canal de presencia (estado online de jugadores).
   * FASE 5: Llamar desde PlayerStore cuando el usuario hace login.
   */
  async subscribePresence(userId: string, username: string): Promise<void> {
    this._setChannelStatus('player-presence', 'subscribing');
    try {
      if (this.activeChannels.has('player-presence')) {
        const oldChannel = this.activeChannels.get('player-presence');
        await this.supabase.client.removeChannel(oldChannel);
        this.activeChannels.delete('player-presence');
      }

      const channel = this.supabase.client.channel('player-presence');
      this.activeChannels.set('player-presence', channel);
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<{ userId: string; username: string; status: string }>();
          const flat: Record<string, { userId: string; username: string; status: string }> = {};
          Object.entries(state).forEach(([key, presences]) => {
            if (presences[0]) flat[key] = presences[0];
          });
          this.presenceMap.set(flat);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            this._setChannelStatus('player-presence', 'subscribed');
            await channel.track({ userId, username, status: 'online' });
          } else {
            this._setChannelStatus('player-presence', 'error');
          }
        });
    } catch (err) {
      this._setChannelStatus('player-presence', 'error');
      console.error('[RealtimeChannel] Error suscribiendo player-presence:', err);
    }
  }

  /** Desuscribe todos los canales activos (llamar en logout). */
  async unsubscribeAll(): Promise<void> {
    if (this.matchmakingTimeoutId) {
      clearTimeout(this.matchmakingTimeoutId);
      this.matchmakingTimeoutId = null;
    }
    await this.supabase.client.removeAllChannels();
    this.activeChannels.clear();
    this.channels.update(chs =>
      chs.map(c => ({ ...c, status: 'idle' as const }))
    );
    this.presenceMap.set({});
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private _setChannelStatus(name: ChannelName, status: RealtimeChannel['status']): void {
    this.channels.update(chs =>
      chs.map(c => c.name === name
        ? { ...c, status, subscribedAt: status === 'subscribed' ? new Date().toISOString() : c.subscribedAt }
        : c
      )
    );
  }
}
