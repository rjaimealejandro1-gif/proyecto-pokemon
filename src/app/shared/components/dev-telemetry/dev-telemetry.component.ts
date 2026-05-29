import { Component, inject, signal, HostListener } from '@angular/core';
import { NgIf, NgFor, NgClass, DatePipe } from '@angular/common';
import { SyncLoggerService, SyncEvent } from '@core/services/sync-logger.service';
import { SyncQueueService } from '@core/services/sync-queue.service';
import { PlayerStore } from '@core/state/player.store';

@Component({
  selector: 'app-dev-telemetry',
  standalone: true,
  imports: [NgIf, NgFor, NgClass],
  template: `
    <!-- Toggle button siempre visible en esquina inferior izquierda -->
    <button class="telemetry-toggle" (click)="toggle()" title="Toggle Dev Panel (Ctrl+Shift+D)">
      <span class="toggle-icon">{{ isOpen() ? '◀' : '📊' }}</span>
    </button>

    <!-- Panel colapsable -->
    <aside class="telemetry-panel" [class.open]="isOpen()" *ngIf="isOpen()">
      <!-- Header -->
      <div class="tp-header">
        <div class="tp-title">
          <span class="tp-lens"></span>
          <span>TELEMETRÍA ENTERPRISE</span>
        </div>
        <button class="tp-close" (click)="toggle()">✖</button>
      </div>

      <!-- Métricas rápidas -->
      <div class="tp-metrics-row">
        <div class="tp-metric">
          <span class="tp-metric-label">MODO</span>
          <span class="tp-metric-val"
                [class.val-green]="store.connectionMode() === 'online'"
                [class.val-red]="store.connectionMode() !== 'online'">
            {{ store.connectionMode() === 'online' ? '🟢 ONLINE' : '🔴 OFFLINE' }}
          </span>
        </div>
        <div class="tp-metric">
          <span class="tp-metric-label">SUPABASE</span>
          <span class="tp-metric-val"
                [class.val-green]="store.avgSupabaseLatency() < 300"
                [class.val-yellow]="store.avgSupabaseLatency() >= 300 && store.avgSupabaseLatency() < 800"
                [class.val-red]="store.avgSupabaseLatency() >= 800">
            {{ store.avgSupabaseLatency() > 0 ? store.avgSupabaseLatency() + 'ms' : '—' }}
          </span>
        </div>
        <div class="tp-metric">
          <span class="tp-metric-label">POKÉAPI</span>
          <span class="tp-metric-val"
                [class.val-green]="store.avgPokeApiLatency() < 400"
                [class.val-yellow]="store.avgPokeApiLatency() >= 400 && store.avgPokeApiLatency() < 900"
                [class.val-red]="store.avgPokeApiLatency() >= 900">
            {{ store.avgPokeApiLatency() > 0 ? store.avgPokeApiLatency() + 'ms' : '—' }}
          </span>
        </div>
        <div class="tp-metric">
          <span class="tp-metric-label">COLA</span>
          <span class="tp-metric-val"
                [class.val-yellow]="store.pendingOpsCount() > 0"
                [class.val-green]="store.pendingOpsCount() === 0">
            {{ store.pendingOpsCount() === 0 ? '✓ OK' : store.pendingOpsCount() + ' pendientes' }}
          </span>
        </div>
        <div class="tp-metric">
          <span class="tp-metric-label">SEÑALES</span>
          <span class="tp-metric-val val-green">
            {{ store.isLoading() ? '⏳ LOADING' : '✓ READY' }}
          </span>
        </div>
        <div class="tp-metric">
          <span class="tp-metric-label">MAZOS</span>
          <span class="tp-metric-val">{{ store.decks().length }}</span>
        </div>
        <div class="tp-metric">
          <span class="tp-metric-label">CARTAS</span>
          <span class="tp-metric-val">{{ store.collection().length }}</span>
        </div>
        <div class="tp-metric">
          <span class="tp-metric-label">EVENTOS</span>
          <span class="tp-metric-val">{{ syncLogger.totalEvents() }}</span>
        </div>
      </div>

      <!-- Log de eventos -->
      <div class="tp-log-header">
        <span>ÚLTIMOS EVENTOS</span>
        <button class="tp-clear-btn" (click)="syncLogger.clearLog()">LIMPIAR</button>
      </div>
      <div class="tp-log-scroll">
        <div class="tp-log-empty" *ngIf="syncLogger.recentEvents().length === 0">
          Sin eventos aún. Las operaciones de sync aparecerán aquí.
        </div>
        <div class="tp-log-row"
             *ngFor="let ev of syncLogger.recentEvents()"
             [ngClass]="getRowClass(ev)">
          <span class="ev-time">{{ ev.timestampShort }}</span>
          <span class="ev-op">{{ ev.operation }}</span>
          <span class="ev-table" *ngIf="ev.table">{{ ev.table }}</span>
          <span class="ev-latency" *ngIf="ev.latencyMs !== undefined">{{ ev.latencyMs }}ms</span>
          <span class="ev-detail" *ngIf="ev.detail">{{ ev.detail }}</span>
          <span class="ev-status">{{ ev.success === true ? '✓' : ev.success === false ? '✗' : '' }}</span>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    /* Toggle button */
    .telemetry-toggle {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 9000;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(100, 20, 20, 0.9);
      border: 2px solid rgba(240, 80, 80, 0.55);
      color: #f07070;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(200, 40, 40, 0.4);
      transition: all 0.25s;
    }
    .telemetry-toggle:hover {
      background: rgba(150, 30, 30, 0.95);
      box-shadow: 0 0 20px rgba(240, 80, 80, 0.6);
      transform: scale(1.08);
    }
    .toggle-icon { font-size: 14px; }

    /* Panel */
    .telemetry-panel {
      position: fixed;
      bottom: 80px;
      left: 24px;
      width: 520px;
      max-height: 60vh;
      z-index: 8999;
      background: rgba(50, 8, 8, 0.97);
      border: 1.5px solid rgba(240, 80, 80, 0.45);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(100, 10, 10, 0.8);
      animation: panelIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      font-family: 'Courier New', monospace;
      font-size: 11px;
    }

    @keyframes panelIn {
      from { transform: translateY(20px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    /* Header */
    .tp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(240, 80, 80, 0.2);
      background: rgba(80, 15, 15, 0.95);
    }
    .tp-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-title);
      font-size: 11px;
      font-weight: 800;
      color: #f07070;
      letter-spacing: 1px;
    }
    .tp-lens {
      width: 12px; height: 12px;
      border-radius: 50%;
      background: radial-gradient(circle, #f07070 0%, #c03030 70%);
      box-shadow: 0 0 6px #f05050;
    }
    .tp-close {
      background: none; border: none;
      color: rgba(240, 80, 80, 0.6);
      cursor: pointer; font-size: 12px;
      transition: color 0.2s;
    }
    .tp-close:hover { color: #f05050; }

    /* Métricas */
    .tp-metrics-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1px;
      padding: 8px 10px;
      border-bottom: 1px solid rgba(240, 80, 80, 0.15);
    }
    .tp-metric {
      display: flex;
      flex-direction: column;
      gap: 2px;
      background: rgba(80, 10, 10, 0.6);
      padding: 5px 8px;
      border-radius: 5px;
      min-width: 70px;
    }
    .tp-metric-label {
      font-size: 8px;
      color: rgba(240, 120, 120, 0.5);
      letter-spacing: 0.5px;
      font-weight: 700;
    }
    .tp-metric-val {
      font-size: 11px;
      font-weight: 700;
      color: #ffb3b3;
    }
    .val-green  { color: #2ec4b6 !important; }
    .val-yellow { color: #ffb703 !important; }
    .val-red    { color: #f05050 !important; }

    /* Log */
    .tp-log-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px;
      font-size: 9px;
      font-weight: 700;
      color: rgba(240, 100, 100, 0.5);
      letter-spacing: 0.8px;
      border-bottom: 1px solid rgba(240, 80, 80, 0.1);
    }
    .tp-clear-btn {
      background: rgba(240, 80, 80, 0.1);
      border: 1px solid rgba(240, 80, 80, 0.25);
      color: #f07070;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8px;
      cursor: pointer;
      font-family: var(--font-title);
      font-weight: 700;
      letter-spacing: 0.5px;
      transition: all 0.2s;
    }
    .tp-clear-btn:hover {
      background: rgba(240, 80, 80, 0.25);
    }

    .tp-log-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 4px 6px;
    }
    .tp-log-scroll::-webkit-scrollbar { width: 4px; }
    .tp-log-scroll::-webkit-scrollbar-track { background: rgba(50, 5, 5, 0.5); }
    .tp-log-scroll::-webkit-scrollbar-thumb { background: rgba(240, 80, 80, 0.3); border-radius: 2px; }

    .tp-log-empty {
      padding: 20px;
      text-align: center;
      color: rgba(240, 100, 100, 0.3);
      font-style: italic;
    }

    .tp-log-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 6px;
      border-radius: 4px;
      border-left: 2px solid transparent;
      transition: background 0.15s;
      min-height: 22px;
    }
    .tp-log-row:hover { background: rgba(240, 80, 80, 0.06); }
    .tp-log-row.row-ok     { border-left-color: #2ec4b6; }
    .tp-log-row.row-fail   { border-left-color: #f05050; background: rgba(240, 80, 80, 0.04); }
    .tp-log-row.row-warn   { border-left-color: #ffb703; }
    .tp-log-row.row-neutral { border-left-color: rgba(240, 80, 80, 0.25); }

    .ev-time    { color: rgba(240, 140, 140, 0.5); font-size: 9px; white-space: nowrap; min-width: 85px; }
    .ev-op      { color: #f07070; font-weight: 700; font-size: 10px; min-width: 120px; }
    .ev-table   { color: #ffb3b3; font-size: 9px; opacity: 0.7; }
    .ev-latency { color: #2ec4b6; font-size: 9px; white-space: nowrap; margin-left: auto; }
    .ev-detail  { color: rgba(255, 220, 220, 0.6); font-size: 9px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ev-status  { font-size: 10px; margin-left: 4px; }

    @media (max-width: 600px) {
      .telemetry-panel { width: calc(100vw - 48px); left: 12px; }
    }
  `]
})
export class DevTelemetryComponent {
  readonly syncLogger = inject(SyncLoggerService);
  readonly syncQueue  = inject(SyncQueueService);
  readonly store      = inject(PlayerStore);

  readonly isOpen = signal<boolean>(false);

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // CTRL+SHIFT+D — toggle panel
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
      event.preventDefault();
      this.toggle();
    }
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  getRowClass(ev: SyncEvent): string {
    if (ev.success === true)  return 'row-ok';
    if (ev.success === false) return 'row-fail';
    const warnOps = ['FALLBACK_LOCAL', 'TIMEOUT_WARNING', 'NETWORK_OFFLINE', 'QUEUE_SYNC_FAILED'];
    if (warnOps.includes(ev.operation)) return 'row-warn';
    return 'row-neutral';
  }
}
