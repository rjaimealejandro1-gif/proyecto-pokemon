import { Injectable, signal, computed } from '@angular/core';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DialogType = 'danger' | 'warning' | 'info' | 'success';
export type ToastType  = 'success' | 'error' | 'warning' | 'info';

export interface DialogConfig {
  id: string;
  type: DialogType;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolveFn: (result: boolean) => void;
}

export interface ToastConfig {
  id: number;
  type: ToastType;
  msg: string;
  icon: string;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DialogService {

  // ── Signals de estado ──────────────────────────────────────────────────────
  readonly dialogs = signal<DialogConfig[]>([]);
  readonly toasts  = signal<ToastConfig[]>([]);

  readonly hasActiveDialog = computed(() => this.dialogs().length > 0);
  readonly activeDialog    = computed(() => this.dialogs()[0] ?? null);

  private _toastCounter = 0;
  private _dialogCounter = 0;

  // ── Dialogs de confirmación holográficos ───────────────────────────────────

  /**
   * Abre un dialog de confirmación holográfico RED MODE.
   * Reemplaza 100% al confirm() nativo del navegador.
   * Retorna Promise<boolean> — true si el usuario confirmó.
   */
  confirm(
    title: string,
    message: string,
    type: DialogType = 'warning',
    confirmLabel = 'CONFIRMAR',
    cancelLabel  = 'CANCELAR'
  ): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      const id = `dialog-${++this._dialogCounter}`;
      const config: DialogConfig = {
        id, type, title, message,
        confirmLabel, cancelLabel,
        resolveFn: resolve,
      };
      this.dialogs.update(prev => [...prev, config]);
    });
  }

  /** Resuelve el dialog activo con el resultado dado y lo elimina del stack. */
  resolveDialog(id: string, result: boolean): void {
    const dialog = this.dialogs().find(d => d.id === id);
    if (dialog) {
      dialog.resolveFn(result);
      this.dialogs.update(prev => prev.filter(d => d.id !== id));
    }
  }

  // ── Toast notifications enterprise ────────────────────────────────────────

  /**
   * Muestra un toast enterprise con auto-dismiss (3.5 segundos).
   * Reemplaza 100% al alert() nativo del navegador.
   */
  toast(type: ToastType, msg: string, duration = 3500): void {
    const icons: Record<ToastType, string> = {
      success: '✅',
      error:   '❌',
      warning: '⚠️',
      info:    'ℹ️',
    };
    const id = ++this._toastCounter;
    const config: ToastConfig = { id, type, msg, icon: icons[type] };
    this.toasts.update(prev => [...prev, config]);
    setTimeout(() => {
      this.toasts.update(prev => prev.filter(t => t.id !== id));
    }, duration);
  }

  // ── Shortcuts de conveniencia ──────────────────────────────────────────────

  success(msg: string)  { this.toast('success', msg); }
  error(msg: string)    { this.toast('error', msg); }
  warning(msg: string)  { this.toast('warning', msg); }
  info(msg: string)     { this.toast('info', msg); }

  /** Dialog de peligro para eliminar elementos irreversibles */
  confirmDelete(itemName: string): Promise<boolean> {
    return this.confirm(
      'ELIMINAR PERMANENTEMENTE',
      `¿Eliminar "${itemName}" de forma permanente? Esta acción no se puede deshacer.`,
      'danger',
      '🗑️ ELIMINAR',
      'CANCELAR'
    );
  }
}
