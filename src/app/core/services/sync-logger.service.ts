import { Injectable, signal, computed } from '@angular/core';

/**
 * SyncEvent — Registro atómico de un evento de sincronización enterprise.
 */
export interface SyncEvent {
  id: string;
  timestamp: string;          // ISO 8601 timestamp completo
  timestampShort: string;     // HH:MM:SS.ms para display en UI
  operation: SyncOperation;
  table?: string;             // Tabla de Supabase involucrada
  latencyMs?: number;         // Latencia medida en milisegundos
  error?: string;             // Mensaje de error si aplica
  retryCount?: number;        // Número de reintentos realizados
  detail?: string;            // Información adicional de contexto
  success?: boolean;          // true = éxito, false = fallo
}

export type SyncOperation =
  | 'SUPABASE_QUERY'
  | 'SUPABASE_UPSERT'
  | 'SUPABASE_DELETE'
  | 'SUPABASE_INSERT'
  | 'POKEAPI_CALL'
  | 'SYNC_START'
  | 'SYNC_SUCCESS'
  | 'SYNC_FAIL'
  | 'FALLBACK_LOCAL'
  | 'DECK_SAVE'
  | 'DECK_CREATE'
  | 'DECK_DELETE'
  | 'DECK_RENAME'
  | 'AUTH_CHECK'
  | 'PROFILE_SYNC'
  | 'COLLECTION_SYNC'
  | 'TIMEOUT_WARNING'
  // Cola de sync offline
  | 'QUEUE_ENQUEUE_OFFLINE'
  | 'QUEUE_PROCESSING'
  | 'QUEUE_SYNC_OK'
  | 'QUEUE_SYNC_FAILED'
  | 'QUEUE_RESTORED'
  // Red
  | 'NETWORK_ONLINE'
  | 'NETWORK_OFFLINE';

/**
 * SyncLoggerService — Servicio enterprise de telemetría de sincronización.
 *
 * Centraliza todos los eventos de I/O (Supabase + PokéAPI) con:
 * - Timestamps precisos
 * - Latencias medidas
 * - Historial de últimos N eventos
 * - Estadísticas de latencia promedio
 * - Signal reactivo para display en UI
 *
 * Uso:
 *   const t = this.syncLogger.startTimer();
 *   // ... operación async
 *   this.syncLogger.log('SUPABASE_QUERY', { table: 'decks', latencyMs: t.elapsed(), success: true });
 */
@Injectable({
  providedIn: 'root'
})
export class SyncLoggerService {
  private static readonly MAX_EVENTS = 100;
  private eventCounter = 0;

  // Signal privado con historial de eventos
  private readonly _events = signal<SyncEvent[]>([]);

  // Signal privado de estadísticas de latencia
  private readonly _supabaseLatencies: number[] = [];
  private readonly _pokeApiLatencies: number[] = [];

  // Public computed signals
  public readonly events = computed(() => this._events());
  public readonly recentEvents = computed(() => this._events().slice(0, 20));

  public readonly avgSupabaseLatency = computed(() => {
    if (this._supabaseLatencies.length === 0) return 0;
    const sum = this._supabaseLatencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this._supabaseLatencies.length);
  });

  public readonly avgPokeApiLatency = computed(() => {
    if (this._pokeApiLatencies.length === 0) return 0;
    const sum = this._pokeApiLatencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this._pokeApiLatencies.length);
  });

  public readonly totalEvents = computed(() => this._events().length);
  public readonly failedEvents = computed(() => this._events().filter(e => e.success === false).length);

  /**
   * Registra un evento de sincronización.
   */
  public log(operation: SyncOperation, opts: {
    table?: string;
    latencyMs?: number;
    error?: string;
    retryCount?: number;
    detail?: string;
    success?: boolean;
  } = {}): void {
    const now = new Date();
    const ts = now.toISOString();
    const tsShort = ts.split('T')[1].substring(0, 12); // HH:MM:SS.ms

    const event: SyncEvent = {
      id: `ev-${++this.eventCounter}`,
      timestamp: ts,
      timestampShort: tsShort,
      operation,
      ...opts
    };

    // Registrar latencias para estadísticas
    if (opts.latencyMs !== undefined) {
      if (operation === 'SUPABASE_QUERY' || operation === 'SUPABASE_UPSERT' ||
          operation === 'SUPABASE_INSERT' || operation === 'SUPABASE_DELETE' ||
          operation === 'PROFILE_SYNC' || operation === 'COLLECTION_SYNC') {
        this._supabaseLatencies.push(opts.latencyMs);
        if (this._supabaseLatencies.length > 50) this._supabaseLatencies.shift();
      }
      if (operation === 'POKEAPI_CALL') {
        this._pokeApiLatencies.push(opts.latencyMs);
        if (this._pokeApiLatencies.length > 50) this._pokeApiLatencies.shift();
      }
    }

    // Mantener solo los últimos MAX_EVENTS eventos
    this._events.update(prev => {
      const next = [event, ...prev];
      if (next.length > SyncLoggerService.MAX_EVENTS) {
        next.pop();
      }
      return next;
    });

    // Console logging enterprise con colores
    this.consoleLog(event);
  }

  /**
   * Inicia un timer de latencia. Devuelve un objeto con `elapsed()` para obtener ms transcurridos.
   */
  public startTimer(): { elapsed: () => number } {
    const start = performance.now();
    return {
      elapsed: () => Math.round(performance.now() - start)
    };
  }

  /**
   * Logging de consola con formato enterprise y colores.
   */
  private consoleLog(event: SyncEvent): void {
    const isError = event.success === false || event.operation === 'SYNC_FAIL' || event.operation === 'TIMEOUT_WARNING';
    const isWarning = event.operation === 'FALLBACK_LOCAL' || event.operation === 'TIMEOUT_WARNING';
    const isSuccess = event.success === true || event.operation === 'SYNC_SUCCESS';

    const prefix = `[%cSyncLogger ${event.timestampShort}%c]`;
    const style1 = isError
      ? 'color: #ff4336; font-weight: bold;'
      : isWarning
        ? 'color: #ff9800; font-weight: bold;'
        : 'color: #ff7f7a; font-weight: bold;';
    const style2 = 'color: reset;';

    const msg = `${event.operation}${event.table ? ` [${event.table}]` : ''}${
      event.latencyMs !== undefined ? ` — ${event.latencyMs}ms` : ''
    }${event.detail ? ` — ${event.detail}` : ''}${
      event.error ? ` — ❌ ${event.error}` : ''
    }`;

    if (isError) {
      console.error(`${prefix} ${msg}`, style1, style2);
    } else if (isWarning) {
      console.warn(`${prefix} ${msg}`, style1, style2);
    } else {
      console.log(`${prefix} ${msg}`, style1, style2);
    }
  }

  /**
   * Resetea el log (útil en logout/reinicio).
   */
  public clearLog(): void {
    this._events.set([]);
    this._supabaseLatencies.length = 0;
    this._pokeApiLatencies.length = 0;
    this.eventCounter = 0;
  }
}
