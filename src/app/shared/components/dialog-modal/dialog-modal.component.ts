import { Component, inject } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { DialogService, DialogConfig, ToastConfig } from '@core/services/dialog.service';

@Component({
  selector: 'app-dialog-modal',
  standalone: true,
  imports: [NgIf, NgFor, NgClass],
  template: `
    <!-- ── TOAST CONTAINER ─────────────────────────────────────────────── -->
    <div class="toast-stack" *ngIf="ds.toasts().length > 0">
      <div
        class="toast-item"
        *ngFor="let t of ds.toasts()"
        [ngClass]="'toast-' + t.type">
        <span class="toast-icon">{{ t.icon }}</span>
        <span class="toast-msg">{{ t.msg }}</span>
      </div>
    </div>

    <!-- ── DIALOG OVERLAY ──────────────────────────────────────────────── -->
    <div class="dialog-overlay" *ngIf="ds.activeDialog() as dlg">
      <div class="dialog-card" [ngClass]="'dlg-' + dlg.type">
        <!-- Scanner bar animada -->
        <div class="dlg-scanner"></div>

        <!-- Indicadores Pokédex -->
        <div class="dlg-pokedex-bar">
          <span class="dlg-lens"></span>
          <span class="dlg-dot dot-r"></span>
          <span class="dlg-dot dot-y"></span>
          <span class="dlg-dot dot-g"></span>
        </div>

        <!-- Ícono de tipo -->
        <div class="dlg-type-icon">
          <span *ngIf="dlg.type === 'danger'">🗑️</span>
          <span *ngIf="dlg.type === 'warning'">⚠️</span>
          <span *ngIf="dlg.type === 'info'">ℹ️</span>
          <span *ngIf="dlg.type === 'success'">✅</span>
        </div>

        <!-- Contenido -->
        <h2 class="dlg-title">{{ dlg.title }}</h2>
        <p class="dlg-message">{{ dlg.message }}</p>

        <!-- Acciones -->
        <div class="dlg-actions">
          <button
            class="dlg-btn-cancel"
            (click)="ds.resolveDialog(dlg.id, false)">
            {{ dlg.cancelLabel ?? 'CANCELAR' }}
          </button>
          <button
            class="dlg-btn-confirm"
            [ngClass]="'btn-' + dlg.type"
            (click)="ds.resolveDialog(dlg.id, true)">
            {{ dlg.confirmLabel ?? 'CONFIRMAR' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ── TOASTS ─────────────────────────────────────────────────────── */
    .toast-stack {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }

    .toast-item {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 280px;
      max-width: 420px;
      padding: 12px 18px;
      border-radius: 10px;
      font-family: var(--font-title);
      font-size: 13px;
      font-weight: 700;
      backdrop-filter: blur(14px);
      animation: toastIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      border: 1px solid transparent;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
    }

    @keyframes toastIn {
      from { transform: translateX(120%); opacity: 0; }
      to   { transform: translateX(0);   opacity: 1; }
    }

    .toast-success {
      background: rgba(30, 90, 60, 0.92);
      border-color: rgba(46, 196, 182, 0.55);
      color: #7fffd4;
    }
    .toast-error {
      background: rgba(120, 25, 25, 0.95);
      border-color: rgba(240, 80, 80, 0.6);
      color: #ffb3b3;
    }
    .toast-warning {
      background: rgba(110, 70, 10, 0.92);
      border-color: rgba(255, 183, 3, 0.5);
      color: #ffe082;
    }
    .toast-info {
      background: rgba(25, 60, 110, 0.92);
      border-color: rgba(100, 160, 240, 0.5);
      color: #b3d1ff;
    }

    .toast-icon { font-size: 16px; flex-shrink: 0; }
    .toast-msg  { line-height: 1.4; }

    /* ── DIALOG OVERLAY ─────────────────────────────────────────────── */
    .dialog-overlay {
      position: fixed;
      inset: 0;
      z-index: 99998;
      background: rgba(30, 2, 2, 0.88);
      backdrop-filter: blur(18px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: overlayIn 0.25s ease forwards;
    }

    @keyframes overlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .dialog-card {
      width: 460px;
      max-width: 100%;
      background: linear-gradient(145deg, rgba(120, 28, 28, 0.97) 0%, rgba(70, 12, 12, 0.99) 100%);
      border: 2px solid rgba(240, 80, 80, 0.55);
      border-radius: 18px;
      padding: 36px 32px 28px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 50px rgba(220, 50, 50, 0.4), inset 0 0 30px rgba(200, 50, 50, 0.15);
      animation: dlgScale 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 16px;
    }

    /* Variantes de color */
    .dlg-danger  { border-color: rgba(240, 80, 80, 0.75) !important; box-shadow: 0 0 50px rgba(220, 50, 50, 0.5) !important; }
    .dlg-warning { border-color: rgba(255, 183, 3, 0.6)  !important; box-shadow: 0 0 50px rgba(255, 183, 3, 0.3)  !important; }
    .dlg-info    { border-color: rgba(100, 160, 240, 0.6) !important; box-shadow: 0 0 50px rgba(80, 140, 220, 0.3) !important; }
    .dlg-success { border-color: rgba(46, 196, 182, 0.6)  !important; box-shadow: 0 0 50px rgba(46, 196, 182, 0.3) !important; }

    @keyframes dlgScale {
      from { transform: scale(0.88); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }

    /* Scanner */
    .dlg-scanner {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 3px;
      background: linear-gradient(90deg, transparent, #f05050, transparent);
      animation: scannerMove 3s linear infinite;
      z-index: 2;
    }
    @keyframes scannerMove {
      0%   { top: 0; }
      50%  { top: 100%; }
      100% { top: 0; }
    }

    /* Barra Pokédex */
    .dlg-pokedex-bar {
      position: absolute;
      top: 14px; left: 18px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dlg-lens {
      width: 20px; height: 20px;
      border-radius: 50%;
      background: radial-gradient(circle, #f07070 0%, #c03030 70%);
      border: 2px solid rgba(255,255,255,0.3);
      box-shadow: 0 0 8px #f05050;
    }
    .dlg-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
    }
    .dot-r { background: #f05050; box-shadow: 0 0 4px #f05050; animation: dlgFlash 1.1s infinite; }
    .dot-y { background: #ffb703; box-shadow: 0 0 4px #ffb703; animation: dlgFlash 1.6s infinite; }
    .dot-g { background: #2ec4b6; box-shadow: 0 0 4px #2ec4b6; }
    @keyframes dlgFlash { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }

    /* Ícono de tipo */
    .dlg-type-icon {
      font-size: 40px;
      margin-top: 8px;
      filter: drop-shadow(0 4px 12px rgba(200,50,50,0.5));
    }

    /* Título */
    .dlg-title {
      font-family: var(--font-title);
      font-size: 18px;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      text-shadow: 0 0 12px rgba(240, 80, 80, 0.4);
      margin: 0;
    }

    /* Mensaje */
    .dlg-message {
      font-size: 14px;
      color: rgba(255, 200, 200, 0.85);
      line-height: 1.55;
      max-width: 340px;
      margin: 0;
    }

    /* Botones */
    .dlg-actions {
      display: flex;
      gap: 14px;
      margin-top: 8px;
      width: 100%;
    }

    .dlg-btn-cancel {
      flex: 1;
      padding: 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.7);
      border-radius: 8px;
      font-family: var(--font-title);
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.25s;
    }
    .dlg-btn-cancel:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }

    .dlg-btn-confirm {
      flex: 1.4;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-family: var(--font-title);
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.25s;
      text-transform: uppercase;
    }

    .btn-danger  { background: linear-gradient(135deg, #f05050, #c03030); color: #fff; box-shadow: 0 4px 16px rgba(220,50,50,0.5); }
    .btn-danger:hover  { box-shadow: 0 0 24px rgba(220,50,50,0.8); transform: translateY(-1px); }
    .btn-warning { background: linear-gradient(135deg, #ffb703, #e07000); color: #1a0a00; box-shadow: 0 4px 16px rgba(255,183,3,0.4); }
    .btn-warning:hover { box-shadow: 0 0 24px rgba(255,183,3,0.7); transform: translateY(-1px); }
    .btn-info    { background: linear-gradient(135deg, #4a90e2, #2a60c2); color: #fff; box-shadow: 0 4px 16px rgba(74,144,226,0.4); }
    .btn-info:hover    { box-shadow: 0 0 24px rgba(74,144,226,0.7); transform: translateY(-1px); }
    .btn-success { background: linear-gradient(135deg, #2ec4b6, #1a8a80); color: #fff; box-shadow: 0 4px 16px rgba(46,196,182,0.4); }
    .btn-success:hover { box-shadow: 0 0 24px rgba(46,196,182,0.7); transform: translateY(-1px); }

    @media (max-width: 480px) {
      .dialog-card { padding: 24px 18px 20px; }
      .dlg-actions { flex-direction: column; }
      .toast-stack { bottom: 16px; right: 16px; left: 16px; }
      .toast-item  { min-width: unset; }
    }
  `]
})
export class DialogModalComponent {
  readonly ds = inject(DialogService);
}
