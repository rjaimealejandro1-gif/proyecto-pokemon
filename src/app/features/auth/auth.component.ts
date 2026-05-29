import { Component, signal, inject, ViewEncapsulation, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '@core/services/auth.service';
import { SupabaseService } from '@core/services/supabase.service';
import { GameStore } from '@core/state/game.store';
import { PlayerStore } from '@core/state/player.store';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [NgIf, RouterLink],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="auth-page"
         style="background-image:url('/assets/backgrounds/fondologin.jpg')">

      <!-- Cinematic overlay: gradiente + glow ambiental -->
      <div class="auth-overlay"></div>
      <div class="auth-glow-orb auth-glow-orb--blue"></div>
      <div class="auth-glow-orb auth-glow-orb--purple"></div>

      <div class="auth-panel">

        <!-- ══ LOGO ══ -->
        <div class="auth-logo">
          <div class="auth-pokeball">
            <div class="pokeball-shine"></div>
          </div>
          <div class="auth-logo__text">
            <span class="auth-logo__pokemon">POKÉMON</span>
            <span class="auth-logo__tcg">TCG &nbsp;·&nbsp; ARENA WEB</span>
          </div>
        </div>

        <!-- ══ BANNER: Sin conexión a internet ══ -->
        <div class="auth-banner auth-banner--offline" *ngIf="networkError()">
          <span class="banner-icon">🌐</span>
          <div style="flex:1">
            <strong>Sin conexión a internet</strong>
            <p>No se puede contactar con Supabase.<br>
               Verifica tu red o usa el <b>Modo Invitado</b> para jugar offline.</p>
            <div class="connect-test" *ngIf="connectResult()">
              <code>{{ connectResult() }}</code>
            </div>
          </div>
          <button class="btn-test-conn" (click)="testConnection()" [disabled]="testingConn()" title="Probar conexión real a Supabase">
            {{ testingConn() ? '⏳' : '🔁 Probar' }}
          </button>
        </div>

        <!-- ══ BANNER: Supabase no configurado ══ -->
        <div class="auth-banner auth-banner--warn" *ngIf="!supabaseAvailable && !networkError()">
          <span class="banner-icon">🔌</span>
          <span>Supabase no configurado — solo disponible el Modo Invitado (offline).</span>
        </div>

        <!-- ══ BANNER: Error ══ -->
        <div class="auth-banner auth-banner--error" *ngIf="errorMsg()">
          <span class="banner-icon">⚠️</span>
          <span>{{ errorMsg() }}</span>
        </div>

        <!-- ══ BANNER: Éxito ══ -->
        <div class="auth-banner auth-banner--success" *ngIf="successMsg()">
          <span class="banner-icon">✅</span>
          <span>{{ successMsg() }}</span>
        </div>

        <!-- ══ LOADING ══ -->
        <div class="auth-loading" *ngIf="loading()">
          <div class="pokeball-spin-loader"></div>
          <p>Conectando con Supabase...</p>
        </div>

        <ng-container *ngIf="!loading()">

          <!-- ══ TABS ══ -->
          <div class="auth-tabs">
            <button [class.active]="isLogin()"  (click)="setMode(true)"  id="tab-login">
              🔑 Iniciar Sesión
            </button>
            <button [class.active]="!isLogin()" (click)="setMode(false)" id="tab-register">
              ✨ Registrarse
            </button>
          </div>

          <!-- ══ FORMULARIO ══ -->
          <form class="auth-form" (submit)="onSubmit($event)">

            <div class="field" *ngIf="!isLogin()">
              <label for="username">⚔️ &nbsp;Nombre de Entrenador</label>
              <input id="username" type="text" placeholder="Ash Ketchum..."
                     [value]="username()"
                     (input)="username.set(asStr($event))" required autocomplete="nickname" />
            </div>

            <div class="field">
              <label for="email">📧 &nbsp;Correo Electrónico</label>
              <input id="email" type="email" placeholder="entrenador@pokemon.com"
                     [value]="email()"
                     (input)="email.set(asStr($event))" required autocomplete="email" />
            </div>

            <div class="field">
              <label for="password">🔒 &nbsp;Contraseña</label>
              <input id="password" type="password" placeholder="Mínimo 6 caracteres"
                     [value]="password()"
                     (input)="password.set(asStr($event))" required autocomplete="current-password" />
            </div>

            <div class="field" *ngIf="!isLogin()">
              <label for="confirm">🔒 &nbsp;Confirmar Contraseña</label>
              <input id="confirm" type="password" placeholder="Repite tu contraseña"
                     [value]="confirm()"
                     (input)="confirm.set(asStr($event))" required autocomplete="new-password" />
            </div>

            <button type="submit" class="btn-submit" id="auth-submit-btn"
                    [disabled]="networkError() && supabaseAvailable">
              {{ isLogin() ? '⚔️  Entrar a la Arena' : '🌟  Crear Cuenta' }}
            </button>
          </form>

          <!-- ══ DIVIDER ══ -->
          <div class="auth-divider">
            <span></span><small>O CONTINÚA CON</small><span></span>
          </div>

          <!-- ══ MODO INVITADO ══ -->
          <button class="btn-guest" id="auth-guest-btn" (click)="playGuest()">
            🎮 &nbsp;Modo Invitado <small>(Sin cuenta · Offline)</small>
          </button>

        </ng-container>

        <!-- ══ DIAGNÓSTICO DE RED (visible en dev si hay problema) ══ -->
        <div class="auth-network-status" *ngIf="networkError()">
          <span class="net-dot net-dot--offline"></span>
          navigator.onLine = {{ browserOnline() }} &nbsp;|&nbsp;
          Supabase DNS = {{ supabaseReachable() ? '✅' : '❌' }}
        </div>

        <!-- ══ BACK ══ -->
        <div class="auth-back">
          <button class="btn-back" id="auth-back-home-btn" routerLink="/home">
            ← Volver al Inicio
          </button>
        </div>

        <p class="auth-footer-note">
          Pokémon TCG Web — Proyecto Académico
        </p>
      </div>
    </div>
  `,
  styles: [`
    /* Connectivity test result */
    .connect-test {
      margin-top: 6px; padding: 4px 8px;
      background: rgba(0,0,0,0.3); border-radius: 6px;
      font-size: 0.72rem; color: #cbd5e1;
    }
    .btn-test-conn {
      flex-shrink: 0; align-self: flex-start; margin-top: 2px;
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
      color: #cbd5e1; font-size: 0.75rem; padding: 5px 10px;
      border-radius: 7px; cursor: pointer; white-space: nowrap;
      transition: background 0.2s;
    }
    .btn-test-conn:hover:not(:disabled) { background: rgba(255,255,255,0.15); }
    .btn-test-conn:disabled { opacity: 0.5; cursor: wait; }

    /* ═══════════════════════════════════════════════════
       LAYOUT BASE
    ═══════════════════════════════════════════════════ */
    .auth-page {
      min-height: 100vh; width: 100%;
      display: flex; justify-content: center; align-items: center;
      padding: 24px;
      background-size: cover;
      background-position: center top;
      background-repeat: no-repeat;
      background-attachment: fixed;
      position: relative;
      overflow: hidden;
      font-family: 'Inter', system-ui, sans-serif;
    }

    /* ── Overlay cinematográfico: menos oscuro, con gradient suave ── */
    .auth-overlay {
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background:
        linear-gradient(180deg,
          rgba(0,0,0,0.30) 0%,
          rgba(4,8,28,0.52) 40%,
          rgba(4,8,28,0.62) 100%);
    }

    /* ── Orbes de luz ambiental ── */
    .auth-glow-orb {
      position: fixed; border-radius: 50%; pointer-events: none;
      filter: blur(80px); z-index: 0; opacity: 0.35;
      animation: orbPulse 6s ease-in-out infinite alternate;
    }
    .auth-glow-orb--blue {
      width: 500px; height: 500px;
      background: radial-gradient(circle, rgba(59,130,246,0.6), transparent 70%);
      top: -150px; left: -120px;
      animation-delay: 0s;
    }
    .auth-glow-orb--purple {
      width: 420px; height: 420px;
      background: radial-gradient(circle, rgba(139,92,246,0.55), transparent 70%);
      bottom: -100px; right: -80px;
      animation-delay: 2.5s;
    }
    @keyframes orbPulse {
      from { transform: scale(1);   opacity: 0.30; }
      to   { transform: scale(1.18); opacity: 0.48; }
    }

    /* ═══════════════════════════════════════════════════
       PANEL PRINCIPAL — Glassmorphism Avanzado
    ═══════════════════════════════════════════════════ */
    .auth-panel {
      position: relative; z-index: 2;
      width: 100%; max-width: 428px;

      /* Glassmorphism real: alta transparencia, blur fuerte */
      background: rgba(6, 11, 28, 0.52);
      backdrop-filter: blur(28px) saturate(180%);
      -webkit-backdrop-filter: blur(28px) saturate(180%);

      /* Borde con glow sutil */
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-top: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 24px;
      padding: 40px 36px;

      /* Sombra profunda + glow azul/Pokémon */
      box-shadow:
        0 32px 80px rgba(0, 0, 0, 0.55),
        0 0 0 1px rgba(59,130,246, 0.08),
        0 0 60px rgba(59,130,246, 0.12),
        inset 0 1px 0 rgba(255,255,255,0.08);

      color: #f1f5f9;
      animation: panelEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes panelEnter {
      from { opacity: 0; transform: translateY(24px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ═══════════════════════════════════════════════════
       LOGO
    ═══════════════════════════════════════════════════ */
    .auth-logo {
      display: flex; align-items: center; gap: 14px;
      justify-content: center; margin-bottom: 30px;
    }

    .auth-pokeball {
      width: 40px; height: 40px; border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.85); flex-shrink: 0;
      background: linear-gradient(to bottom, #cc0000 50%, white 50%);
      position: relative;
      box-shadow: 0 0 16px rgba(204,0,0,0.5), 0 0 30px rgba(204,0,0,0.2);
      animation: pokeballGlow 2.5s ease-in-out infinite alternate;
    }
    @keyframes pokeballGlow {
      from { box-shadow: 0 0 12px rgba(204,0,0,0.4), 0 0 20px rgba(204,0,0,0.15); }
      to   { box-shadow: 0 0 24px rgba(204,0,0,0.7), 0 0 40px rgba(204,0,0,0.3); }
    }
    .auth-pokeball::before {
      content: ''; position: absolute;
      top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 11px; height: 11px;
      background: white; border: 2.5px solid #222; border-radius: 50%;
      z-index: 1;
    }
    .pokeball-shine {
      position: absolute; top: 3px; left: 4px;
      width: 10px; height: 6px;
      background: rgba(255,255,255,0.35);
      border-radius: 50%; transform: rotate(-30deg);
    }

    .auth-logo__text { display: flex; flex-direction: column; line-height: 1; }
    .auth-logo__pokemon {
      font-size: 1.6rem; font-weight: 900; color: #ffcb05;
      letter-spacing: 0.08em;
      text-shadow:
        0 0 20px rgba(255,203,5,0.7),
        2px 2px 0 rgba(60,90,166,0.8),
        -1px -1px 0 rgba(60,90,166,0.6);
    }
    .auth-logo__tcg {
      font-size: 0.72rem; font-weight: 400; color: #94a3b8;
      letter-spacing: 0.35em; text-transform: uppercase; margin-top: 2px;
    }

    /* ═══════════════════════════════════════════════════
       BANNERS
    ═══════════════════════════════════════════════════ */
    .auth-banner {
      display: flex; gap: 10px; align-items: flex-start;
      padding: 12px 14px; border-radius: 12px;
      font-size: 0.84rem; margin-bottom: 16px; line-height: 1.5;
      animation: bannerSlide 0.3s ease both;
    }
    @keyframes bannerSlide {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .banner-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 1px; }
    .auth-banner strong { display: block; margin-bottom: 2px; }
    .auth-banner p { margin: 0; font-size: 0.8rem; opacity: 0.85; }

    .auth-banner--offline {
      background: rgba(239,68,68,0.10);
      border: 1px solid rgba(239,68,68,0.30);
      color: #fca5a5;
    }
    .auth-banner--warn {
      background: rgba(251,191,36,0.10);
      border: 1px solid rgba(251,191,36,0.28);
      color: #fcd34d;
    }
    .auth-banner--error {
      background: rgba(239,68,68,0.10);
      border: 1px solid rgba(239,68,68,0.30);
      color: #fca5a5;
    }
    .auth-banner--success {
      background: rgba(34,197,94,0.10);
      border: 1px solid rgba(34,197,94,0.28);
      color: #86efac;
    }

    /* ═══════════════════════════════════════════════════
       LOADING
    ═══════════════════════════════════════════════════ */
    .auth-loading {
      display: flex; flex-direction: column; align-items: center;
      gap: 14px; padding: 28px 0; color: #64748b;
      font-size: 0.88rem;
    }
    .pokeball-spin-loader {
      width: 48px; height: 48px; border-radius: 50%;
      border: 4px solid rgba(255,255,255,0.15);
      border-top-color: #ffcb05;
      border-right-color: #cc0000;
      animation: spinLoader 0.9s linear infinite;
    }
    @keyframes spinLoader { to { transform: rotate(360deg); } }

    /* ═══════════════════════════════════════════════════
       TABS
    ═══════════════════════════════════════════════════ */
    .auth-tabs {
      display: flex;
      background: rgba(0,0,0,0.30);
      border-radius: 12px; padding: 4px; margin-bottom: 24px;
      border: 1px solid rgba(255,255,255,0.07);
      gap: 4px;
    }
    .auth-tabs button {
      flex: 1; background: transparent; border: none; color: #475569;
      padding: 10px 6px; border-radius: 9px;
      font-weight: 700; font-size: 0.82rem;
      cursor: pointer; transition: all 0.25s ease;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .auth-tabs button:hover:not(.active) {
      color: #94a3b8; background: rgba(255,255,255,0.04);
    }
    .auth-tabs button.active {
      background: linear-gradient(135deg, #cc0000, #991b1b);
      color: white;
      box-shadow: 0 4px 14px rgba(204,0,0,0.4), 0 0 20px rgba(204,0,0,0.2);
    }

    /* ═══════════════════════════════════════════════════
       FORMULARIO
    ═══════════════════════════════════════════════════ */
    .auth-form { display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label {
      font-size: 0.7rem; font-weight: 700; color: #475569;
      text-transform: uppercase; letter-spacing: 0.1em;
    }
    .field input {
      background: rgba(0,0,0,0.28);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px; padding: 12px 14px;
      color: #f1f5f9; font-size: 0.95rem;
      outline: none; transition: all 0.22s ease;
      backdrop-filter: blur(4px);
    }
    .field input::placeholder { color: #334155; }
    .field input:focus {
      border-color: rgba(255,203,5,0.5);
      background: rgba(255,203,5,0.04);
      box-shadow: 0 0 0 3px rgba(255,203,5,0.08), 0 0 16px rgba(255,203,5,0.12);
    }

    /* Botón submit */
    .btn-submit {
      margin-top: 8px; width: 100%;
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%);
      color: white; border: none; border-radius: 12px;
      padding: 14px; font-size: 1rem; font-weight: 800;
      cursor: pointer; letter-spacing: 0.04em; text-transform: uppercase;
      transition: all 0.25s ease;
      box-shadow: 0 6px 20px rgba(37,99,235,0.35), 0 0 40px rgba(37,99,235,0.15);
      position: relative; overflow: hidden;
    }
    .btn-submit::before {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
      opacity: 0; transition: opacity 0.25s;
    }
    .btn-submit:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 28px rgba(37,99,235,0.5), 0 0 50px rgba(37,99,235,0.2);
    }
    .btn-submit:hover::before { opacity: 1; }
    .btn-submit:disabled {
      opacity: 0.5; cursor: not-allowed; transform: none;
    }

    /* Divider */
    .auth-divider {
      display: flex; align-items: center; gap: 12px; margin: 18px 0;
    }
    .auth-divider span { flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
    .auth-divider small {
      color: #334155; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.12em;
      white-space: nowrap;
    }

    /* Botón invitado */
    .btn-guest {
      width: 100%;
      background: rgba(255,203,5,0.06);
      border: 1px solid rgba(255,203,5,0.22);
      color: #fbbf24;
      padding: 12px; border-radius: 12px;
      font-weight: 700; font-size: 0.88rem;
      cursor: pointer; transition: all 0.25s ease; letter-spacing: 0.03em;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-guest small { font-weight: 400; color: #92400e; font-size: 0.78rem; }
    .btn-guest:hover {
      background: rgba(255,203,5,0.14);
      border-color: rgba(255,203,5,0.45);
      box-shadow: 0 0 20px rgba(255,203,5,0.15);
      transform: translateY(-1px);
    }

    /* Estado de red (diagnóstico) */
    .auth-network-status {
      display: flex; align-items: center; gap: 8px;
      margin-top: 12px; padding: 8px 12px;
      background: rgba(0,0,0,0.25); border-radius: 8px;
      font-size: 0.72rem; color: #475569; font-family: monospace;
    }
    .net-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .net-dot--online  { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
    .net-dot--offline { background: #ef4444; box-shadow: 0 0 6px #ef4444; }

    /* Back */
    .auth-back { text-align: center; margin-top: 18px; }
    .btn-back {
      background: transparent; border: none;
      color: #334155; font-size: 0.78rem; cursor: pointer;
      transition: color 0.2s ease; letter-spacing: 0.02em;
    }
    .btn-back:hover { color: #64748b; }

    .auth-footer-note {
      text-align: center; margin-top: 10px;
      font-size: 0.7rem; color: #1e293b; letter-spacing: 0.05em;
    }

    /* ═══════════════════════════════════════════════════
       RESPONSIVE
    ═══════════════════════════════════════════════════ */
    @media (max-width: 480px) {
      .auth-panel { padding: 28px 20px; }
      .auth-logo__pokemon { font-size: 1.35rem; }
      .btn-submit { font-size: 0.92rem; }
    }
    @media (max-width: 360px) {
      .auth-panel { padding: 22px 16px; border-radius: 18px; }
    }
  `]
})
export class AuthComponent implements OnInit {
  private readonly authService   = inject(AuthService);
  private readonly supabase      = inject(SupabaseService);
  private readonly router        = inject(Router);
  private readonly gameStore     = inject(GameStore);
  private readonly playerStore   = inject(PlayerStore);

  // ── Signals de formulario ──
  readonly isLogin    = signal(true);
  readonly email      = signal('');
  readonly password   = signal('');
  readonly confirm    = signal('');
  readonly username   = signal('');
  readonly loading    = signal(false);
  readonly errorMsg   = signal<string | null>(null);
  readonly successMsg = signal<string | null>(null);

  // ── Signals de diagnóstico de red ──
  readonly networkError      = signal(false);
  readonly browserOnline     = signal(navigator.onLine);
  readonly supabaseReachable = signal<boolean | null>(null);
  readonly testingConn       = signal(false);
  readonly connectResult     = signal<string | null>(null);

  /** Indica si Supabase está disponible (cliente inicializado). */
  readonly supabaseAvailable = !!this.supabase.client;

  private _onlineHandler  = () => { this.browserOnline.set(true);  this.networkError.set(false); this.errorMsg.set(null); console.log('[AuthComponent] 🟢 Conexión restaurada'); };
  private _offlineHandler = () => { this.browserOnline.set(false); this.networkError.set(true);  console.warn('[AuthComponent] 🔴 Conexión perdida'); };

  ngOnInit(): void {
    // Diagnóstico de red al cargar
    this.browserOnline.set(navigator.onLine);
    if (!navigator.onLine) {
      this.networkError.set(true);
      console.warn('[AuthComponent] navigator.onLine = false → sin internet real');
    }
    window.addEventListener('online',  this._onlineHandler);
    window.addEventListener('offline', this._offlineHandler);

    // Test de conectividad automático al arrancar
    this.testConnection(true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('online',  this._onlineHandler);
    window.removeEventListener('offline', this._offlineHandler);
  }

  /** Prueba la conectividad real con Supabase vía fetch() directo. */
  async testConnection(silent = false): Promise<void> {
    if (this.testingConn()) return;
    this.testingConn.set(true);
    this.connectResult.set(null);

    const result = await this.supabase.testConnectivity();
    this.testingConn.set(false);

    const summary = result.ok
      ? `✅ Supabase OK (HTTP ${result.status}, ${result.durationMs}ms)`
      : `❌ ${result.error ?? `HTTP ${result.status}`} (${result.durationMs}ms) | navigator.onLine=${result.navigatorOnline}`;

    console.log(`[AuthComponent] 🧪 testConnection: ${summary}`);

    if (!result.ok) {
      this.networkError.set(true);
      if (!silent) this.connectResult.set(summary);
      else this.connectResult.set(summary); // siempre mostrar en el banner
    } else {
      this.networkError.set(false);
      this.connectResult.set(null);
    }
  }

  setMode(login: boolean): void {
    this.isLogin.set(login);
    this.errorMsg.set(null);
    this.successMsg.set(null);
  }

  asStr(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMsg.set(null);
    this.successMsg.set(null);

    // Verificar red antes de intentar
    if (!navigator.onLine) {
      this.networkError.set(true);
      this.errorMsg.set('Sin conexión a internet. Usa el Modo Invitado para jugar offline.');
      return;
    }

    if (!this.supabaseAvailable) {
      this.errorMsg.set('Supabase no está configurado. Usa el Modo Invitado.');
      return;
    }

    if (!this.email() || !this.password()) {
      this.errorMsg.set('Por favor completa todos los campos.');
      return;
    }

    if (this.isLogin()) {
      await this.doLogin();
    } else {
      await this.doRegister();
    }
  }

  private async doLogin(): Promise<void> {
    this.loading.set(true);
    console.log(`[AuthComponent] 🔑 doLogin() → ${this.email()}`);

    const { error } = await this.authService.signIn(this.email(), this.password());
    this.loading.set(false);

    if (error) {
      // Detectar error de red específicamente
      if (error.includes('fetch') || error.includes('network') || error.includes('Failed')) {
        this.networkError.set(true);
        this.errorMsg.set('Error de conexión con Supabase. Verifica tu internet.');
      } else {
        this.errorMsg.set(this.translateError(error));
      }
      return;
    }

    console.log('[AuthComponent] ✅ Login exitoso → navegando a /dashboard');
    this.gameStore.setAuthenticated(true);
    await this.playerStore.loadUserData();
    this.router.navigate(['/dashboard']);
  }

  private async doRegister(): Promise<void> {
    if (this.password() !== this.confirm()) {
      this.errorMsg.set('Las contraseñas no coinciden.');
      return;
    }
    if (this.password().length < 6) {
      this.errorMsg.set('La contraseña debe tener mínimo 6 caracteres.');
      return;
    }
    if (!this.username()) {
      this.errorMsg.set('Debes elegir un Nombre de Entrenador.');
      return;
    }

    this.loading.set(true);
    console.log(`[AuthComponent] 📝 doRegister() → ${this.email()}`);

    const { error, isNew } = await this.authService.signUp(
      this.email(), this.password(), this.username()
    );
    this.loading.set(false);

    if (error) {
      if (error.includes('fetch') || error.includes('network') || error.includes('Failed')) {
        this.networkError.set(true);
        this.errorMsg.set('Error de conexión con Supabase. Verifica tu internet.');
      } else {
        this.errorMsg.set(this.translateError(error));
      }
      return;
    }

    if (isNew) {
      console.log('[AuthComponent] ✅ Registro exitoso (sesión inmediata) → /tutorial');
      this.gameStore.setAuthenticated(true);
      await this.playerStore.loadUserData();
      this.router.navigate(['/tutorial']);
    } else {
      console.log('[AuthComponent] 📧 Registro exitoso → requiere confirmación de email');
      this.successMsg.set(
        '¡Registro exitoso! Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.'
      );
      this.setMode(true);
    }
  }

  playGuest(): void {
    console.log('[AuthComponent] 🎮 Modo Invitado activado');
    this.loading.set(true);
    setTimeout(async () => {
      this.gameStore.setAuthenticated(true);
      this.playerStore.logout();
      this.router.navigate(['/dashboard']);
      this.loading.set(false);
    }, 600);
  }

  private translateError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (msg.includes('Email not confirmed'))       return 'Debes confirmar tu correo antes de iniciar sesión.';
    if (msg.includes('User already registered'))   return 'Este correo ya tiene una cuenta registrada.';
    if (msg.includes('Password should be'))        return 'La contraseña debe tener mínimo 6 caracteres.';
    if (msg.includes('Unable to validate'))        return 'Sesión expirada. Intenta iniciar sesión nuevamente.';
    if (msg.includes('fetch') || msg.includes('NetworkError') || msg.includes('Failed to fetch'))
      return 'Sin conexión a internet. Verifica tu red e intenta de nuevo.';
    return msg;
  }
}
