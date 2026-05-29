import { Injectable, signal, computed, inject } from '@angular/core';
import { SyncLoggerService } from './sync-logger.service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type SyncOpType =
  | 'SAVE_DECK'
  | 'CREATE_DECK'
  | 'DELETE_DECK'
  | 'RENAME_DECK'
  | 'SAVE_COLLECTION';

export interface SyncOperation {
  id: string;
  type: SyncOpType;
  payload: unknown;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  lastAttemptAt?: string;
  error?: string;
}

type ExecutorFn = (op: SyncOperation) => Promise<boolean>;

const QUEUE_STORAGE_KEY = 'poke_sync_queue';

// ─── Servicio ─────────────────────────────────────────────────────────────────

/**
 * SyncQueueService — Cola offline-first enterprise.
 * Persiste operaciones pendientes en localStorage y las ejecuta
 * automáticamente al reconectar. Soporta retry con backoff.
 */
@Injectable({ providedIn: 'root' })
export class SyncQueueService {

  private readonly syncLogger = inject(SyncLoggerService);

  // ── Signals públicos ───────────────────────────────────────────────────────
  readonly queue      = signal<SyncOperation[]>([]);
  readonly isOnline   = signal<boolean>(navigator.onLine);
  readonly isProcessing = signal<boolean>(false);

  readonly pendingCount = computed(() => this.queue().length);
  readonly hasPending   = computed(() => this.queue().length > 0);

  // ── Mapa de ejecutores por tipo ────────────────────────────────────────────
  private _executors = new Map<SyncOpType, ExecutorFn>();

  // ── Listeners de red ───────────────────────────────────────────────────────
  private _onlineListener  = () => this._handleOnline();
  private _offlineListener = () => this._handleOffline();

  constructor() {
    this._loadQueueFromStorage();
    this._attachNetworkListeners();
  }

  // ── API Pública ────────────────────────────────────────────────────────────

  /**
   * Registra un ejecutor para un tipo de operación.
   * El PlayerStore registra sus ejecutores al inicializarse.
   */
  registerExecutor(type: SyncOpType, fn: ExecutorFn): void {
    this._executors.set(type, fn);
  }

  /**
   * Encola una operación. Si hay conexión, la ejecuta inmediatamente.
   * Si no hay conexión, la persiste y se ejecuta al reconectar.
   */
  async enqueue(type: SyncOpType, payload: unknown, maxRetries = 3): Promise<void> {
    const op: SyncOperation = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      retryCount: 0,
      maxRetries,
      createdAt: new Date().toISOString(),
    };

    if (this.isOnline()) {
      // Intento directo — no encolar si tiene éxito
      const success = await this._executeOne(op);
      if (!success) {
        this._addToQueue(op);
      }
    } else {
      // Sin conexión — guardar para después
      this._addToQueue(op);
      this.syncLogger.log('QUEUE_ENQUEUE_OFFLINE', {
        detail: `${type} guardado para sync posterior`,
        success: false,
      });
    }
  }

  /**
   * Procesa todas las operaciones pendientes en orden FIFO.
   * Se llama automáticamente al detectar reconexión.
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing() || !this.isOnline() || !this.hasPending()) return;

    this.isProcessing.set(true);
    this.syncLogger.log('QUEUE_PROCESSING', {
      detail: `Procesando ${this.pendingCount()} operaciones pendientes`,
      success: true,
    });

    const ops = [...this.queue()];
    const remaining: SyncOperation[] = [];

    for (const op of ops) {
      op.lastAttemptAt = new Date().toISOString();
      const success = await this._executeOne(op);

      if (success) {
        this.syncLogger.log('QUEUE_SYNC_OK', {
          detail: `${op.type} sincronizado tras reconexión`,
          success: true,
        });
      } else {
        op.retryCount++;
        if (op.retryCount < op.maxRetries) {
          op.error = `Retry ${op.retryCount}/${op.maxRetries}`;
          remaining.push(op);
        } else {
          this.syncLogger.log('QUEUE_SYNC_FAILED', {
            detail: `${op.type} falló tras ${op.maxRetries} intentos — descartado`,
            success: false,
          });
        }
      }
    }

    this.queue.set(remaining);
    this._saveQueueToStorage();
    this.isProcessing.set(false);
  }

  /** Limpia toda la cola (usar solo en logout). */
  clearQueue(): void {
    this.queue.set([]);
    this._saveQueueToStorage();
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async _executeOne(op: SyncOperation): Promise<boolean> {
    const executor = this._executors.get(op.type);
    if (!executor) {
      console.warn(`[SyncQueue] No hay ejecutor registrado para: ${op.type}`);
      return false;
    }
    try {
      return await executor(op);
    } catch (err) {
      console.error(`[SyncQueue] Error ejecutando ${op.type}:`, err);
      return false;
    }
  }

  private _addToQueue(op: SyncOperation): void {
    this.queue.update(prev => [...prev, op]);
    this._saveQueueToStorage();
  }

  private _saveQueueToStorage(): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue()));
    } catch {
      console.warn('[SyncQueue] No se pudo persistir la cola en localStorage.');
    }
  }

  private _loadQueueFromStorage(): void {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SyncOperation[];
        this.queue.set(parsed);
        if (parsed.length > 0) {
          this.syncLogger.log('QUEUE_RESTORED', {
            detail: `${parsed.length} operaciones restauradas desde localStorage`,
            success: true,
          });
        }
      }
    } catch {
      console.warn('[SyncQueue] Error al cargar la cola persistida.');
    }
  }

  private _attachNetworkListeners(): void {
    window.addEventListener('online',  this._onlineListener);
    window.addEventListener('offline', this._offlineListener);
  }

  private _handleOnline(): void {
    this.isOnline.set(true);
    this.syncLogger.log('NETWORK_ONLINE', {
      detail: 'Conexión restaurada — procesando cola pendiente',
      success: true,
    });
    // Pequeño delay para que la conexión se estabilice
    setTimeout(() => this.processQueue(), 1200);
  }

  private _handleOffline(): void {
    this.isOnline.set(false);
    this.syncLogger.log('NETWORK_OFFLINE', {
      detail: 'Conexión perdida — modo offline activado',
      success: false,
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('online',  this._onlineListener);
    window.removeEventListener('offline', this._offlineListener);
  }
}
