import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { PlayerStore } from '@core/state/player.store';
import { GameStore } from '@core/state/game.store';
import { AuthService } from '@core/services/auth.service';
import { NgIf } from '@angular/common';
import { DialogModalComponent } from '@shared/components/dialog-modal/dialog-modal.component';
import { DevTelemetryComponent } from '@shared/components/dev-telemetry/dev-telemetry.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIf, DialogModalComponent, DevTelemetryComponent],
  template: `
    <!-- Dialog + Toast system enterprise (raíz global) -->
    <app-dialog-modal></app-dialog-modal>

    <!-- Panel de telemetría dev (CTRL+SHIFT+D para abrir) -->
    <app-dev-telemetry></app-dev-telemetry>

    <div class="layout-container">
      <!-- Fondo dinámico Pokédex Arena Premium -->
      <div class="bg-vortex">
        <div class="bg-particles"></div>
        <div class="bg-pokedex-overlay"></div>
      </div>

      <!-- Barra de Navegación Premium -->
      <header class="navbar-header glass-card">
        <div class="nav-brand" routerLink="/dashboard">
          <div class="brand-logo">
            <span class="logo-red">POKÉ</span><span class="logo-white">TCG</span>
          </div>
          <span class="brand-badge gold-glow">BETA</span>
        </div>

        <!-- Navegación de Escritorio -->
        <nav class="nav-links">
          <a routerLink="/dashboard" routerLinkActive="active-nav" class="nav-item">
            <span class="nav-icon">⚔️</span> Menú
          </a>
          <a routerLink="/battle" routerLinkActive="active-nav" class="nav-item">
            <span class="nav-icon">🎮</span> Arena
          </a>
          <a routerLink="/cards" routerLinkActive="active-nav" class="nav-item">
            <span class="nav-icon">🎴</span> Colección
          </a>
          <a routerLink="/deck" routerLinkActive="active-nav" class="nav-item">
            <span class="nav-icon">📐</span> Mazos
          </a>
          <a routerLink="/history" routerLinkActive="active-nav" class="nav-item">
            <span class="nav-icon">📜</span> Historial
          </a>
        </nav>

        <!-- Widgets de Perfil de Usuario -->
        <div class="nav-user" *ngIf="playerStore.profile() as user">
          <div class="user-network">
            <span class="status-dot" 
                  [class.dot-ready]="playerStore.connectionMode() === 'online'" 
                  [class.dot-offline]="playerStore.connectionMode() === 'local'"></span>
            <span class="network-label">
              {{ playerStore.connectionMode() === 'online' ? 'Supabase conectado' : 'Modo Offline' }}
            </span>
          </div>
          <div class="user-card glass-card">
            <div class="avatar-stub">
              {{ user.username.charAt(0).toUpperCase() }}
            </div>
            <div class="user-meta">
              <span class="username">{{ user.username }}</span>
              <span class="user-level">NIVEL {{ user.level }}</span>
            </div>
            <button class="btn-logout" (click)="onLogout()" title="Cerrar Sesión">🚪</button>
          </div>
        </div>

        <!-- Botón Menú Móvil -->
        <button class="mobile-menu-btn" (click)="toggleMobileMenu()">
          <span class="hamburger" [class.open]="isMobileMenuOpen()"></span>
        </button>
      </header>

      <!-- Navegación Móvil (Panel Lateral Desplegable) -->
      <div class="mobile-nav-panel glass-card" [class.show]="isMobileMenuOpen()">
        <nav class="mobile-nav-links">
          <a routerLink="/dashboard" (click)="closeMobileMenu()" routerLinkActive="active-nav" class="mobile-nav-item">
            <span>⚔️</span> Menú Principal
          </a>
          <a routerLink="/battle" (click)="closeMobileMenu()" routerLinkActive="active-nav" class="mobile-nav-item">
            <span>🎮</span> Tablero de Combate
          </a>
          <a routerLink="/cards" (click)="closeMobileMenu()" routerLinkActive="active-nav" class="mobile-nav-item">
            <span>🎴</span> Mi Colección
          </a>
          <a routerLink="/deck" (click)="closeMobileMenu()" routerLinkActive="active-nav" class="mobile-nav-item">
            <span>📐</span> Constructor de Mazos
          </a>
          <a routerLink="/history" (click)="closeMobileMenu()" routerLinkActive="active-nav" class="mobile-nav-item">
            <span>📜</span> Perfil e Historial
          </a>
          <!-- Logout Móvil -->
          <a (click)="onLogout(); closeMobileMenu()" class="mobile-nav-item logout-mobile">
            <span>🚪</span> Cerrar Sesión
          </a>
        </nav>
      </div>

      <!-- Contenedor Principal Dinámico (RouterOutlet) -->
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .layout-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      width: 100%;
    }

    .navbar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 80px;
      padding: 0 40px;
      margin: 15px 30px;
      border-radius: var(--radius-md);
      z-index: 100;
      background: rgba(140, 35, 35, 0.45) !important;
      border: 1px solid rgba(240, 80, 80, 0.3) !important;
      box-shadow: 0 8px 32px 0 rgba(40, 5, 5, 0.5), inset 0 0 15px rgba(240, 80, 80, 0.12) !important;
    }

    .nav-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
    }

    .brand-logo {
      font-family: var(--font-title);
      font-weight: 800;
      font-size: 24px;
      letter-spacing: 1px;
    }

    .logo-red {
      color: var(--color-primary);
      text-shadow: 0 0 10px rgba(230, 57, 70, 0.6);
    }

    .logo-white {
      color: var(--text-primary);
    }

    .brand-badge {
      font-size: 10px;
      font-weight: 800;
      color: var(--color-primary-hover) !important;
      background: rgba(255, 23, 68, 0.18) !important;
      padding: 3px 8px;
      border-radius: 4px;
      letter-spacing: 1px;
      border: 1px solid rgba(255, 23, 68, 0.5) !important;
      box-shadow: 0 0 10px rgba(255, 23, 68, 0.35) !important;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .nav-item {
      font-family: var(--font-title);
      font-weight: 700;
      font-size: 15px;
      color: var(--text-secondary);
      padding: 8px 16px;
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1px solid transparent;
    }

    .nav-item:hover {
      color: var(--text-primary);
      background: rgba(230, 57, 70, 0.1);
      border-color: rgba(230, 57, 70, 0.25);
    }

    .active-nav {
      color: var(--color-primary-hover) !important;
      background: rgba(255, 23, 68, 0.15) !important;
      border-color: rgba(255, 23, 68, 0.45) !important;
      box-shadow: 0 0 12px rgba(255, 23, 68, 0.35) !important;
    }

    .nav-user {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .user-network {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--text-muted);
      font-family: var(--font-title);
      font-weight: 500;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .network-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .pulse-green {
      background-color: #2ec4b6;
      box-shadow: 0 0 0 0 rgba(46, 196, 182, 0.7);
      animation: pulseGreen 2s infinite;
    }

    .pulse-orange {
      background-color: #ffb703;
      box-shadow: 0 0 0 0 rgba(255, 183, 3, 0.7);
      animation: pulseOrange 2s infinite;
    }

    @keyframes pulseGreen {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(46, 196, 182, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(46, 196, 182, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(46, 196, 182, 0);
      }
    }

    @keyframes pulseOrange {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(255, 183, 3, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(255, 183, 3, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(255, 183, 3, 0);
      }
    }

    .user-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 14px 6px 8px;
      border-radius: 30px;
      background: rgba(255, 255, 255, 0.03);
    }

    .avatar-stub {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--color-primary) 0%, #b31a2c 100%);
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-title);
      font-weight: 800;
      font-size: 14px;
      box-shadow: 0 4px 10px rgba(230, 57, 70, 0.3);
    }

    .user-meta {
      display: flex;
      flex-direction: column;
    }

    .username {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .user-level {
      font-size: 9px;
      font-weight: 800;
      color: var(--color-legendary);
      letter-spacing: 0.5px;
      margin-top: -1px;
    }

    .btn-logout {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 14px;
      margin-left: 8px;
      padding: 4px;
      border-radius: 4px;
      transition: all var(--transition-fast);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-logout:hover {
      background: rgba(230, 57, 70, 0.15);
      color: var(--color-primary);
      transform: scale(1.1);
    }

    .mobile-menu-btn {
      display: none;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 10px;
      z-index: 110;
    }

    .hamburger {
      display: block;
      width: 24px;
      height: 2px;
      background: var(--text-primary);
      position: relative;
      transition: background 0.3s ease;
    }

    .hamburger::before, .hamburger::after {
      content: '';
      position: absolute;
      width: 24px;
      height: 2px;
      background: var(--text-primary);
      transition: all 0.3s ease;
    }

    .hamburger::before { top: -8px; }
    .hamburger::after { bottom: -8px; }

    .hamburger.open {
      background: transparent;
    }

    .hamburger.open::before {
      transform: rotate(45deg);
      top: 0;
    }

    .hamburger.open::after {
      transform: rotate(-45deg);
      bottom: 0;
    }

    .mobile-nav-panel {
      position: fixed;
      top: 0;
      right: -100%;
      width: 300px;
      height: 100%;
      z-index: 95;
      padding: 120px 30px 40px;
      transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      border-radius: 0;
      border-left: 1px solid var(--glass-border);
      background: rgba(80, 16, 16, 0.97) !important;
    }

    .mobile-nav-panel.show {
      right: 0;
    }

    .mobile-nav-links {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .mobile-nav-item {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 14px 20px;
      border-radius: var(--radius-md);
      font-family: var(--font-title);
      font-weight: 600;
      font-size: 16px;
      transition: all var(--transition-fast);
      border: 1px solid transparent;
      cursor: pointer;
    }

    .mobile-nav-item:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .logout-mobile {
      margin-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.05);
      color: var(--color-primary);
      padding-top: 20px;
    }

    .logout-mobile:hover {
      background: rgba(230, 57, 70, 0.1);
    }

    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 10px 30px 40px;
      z-index: 10;
    }

    /* Consultas de Medios Responsive */
    @media (max-width: 1200px) {
      .navbar-header {
        margin: 15px 20px;
        padding: 0 25px;
      }
      .main-content {
        padding: 10px 20px 30px;
      }
    }

    @media (max-width: 992px) {
      .nav-links, .user-network {
        display: none;
      }
      .mobile-menu-btn {
        display: block;
      }
    }

    @media (max-width: 576px) {
      .navbar-header {
        margin: 10px;
        padding: 0 15px;
        height: 70px;
      }
      .nav-user {
        margin-right: 10px;
      }
      .user-meta {
        display: none;
      }
      .mobile-nav-panel {
        width: 100%;
      }
    }
  `]
})
export class LayoutComponent {
  public readonly playerStore  = inject(PlayerStore);
  private readonly gameStore   = inject(GameStore);
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);
  public readonly isMobileMenuOpen = signal<boolean>(false);

  public toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(val => !val);
  }

  public closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  public async onLogout(): Promise<void> {
    // Limpia store local
    this.playerStore.logout();
    this.gameStore.setAuthenticated(false);
    // Cierra sesión en Supabase Y limpia localStorage (navega a /home internamente)
    await this.authService.signOut();
  }
}
