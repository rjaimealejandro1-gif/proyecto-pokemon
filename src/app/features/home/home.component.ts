import { Component, HostListener, signal, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="home-root" [class.scrolled]="scrolled()"
         style="background-image:url('/assets/backgrounds/fondodeinicio.jpg')">
      <div class="bg-overlay"></div>

      <!-- ═══════════════════ NAVBAR ═══════════════════ -->
      <nav class="topnav">
        <div class="topnav__brand">
          <div class="pokeball"></div>
          <span>POKÉMON TCG <strong>WEB</strong></span>
        </div>
        <div class="topnav__actions">
          <button class="btn btn--ghost" routerLink="/auth">Iniciar Sesión</button>
          <button class="btn btn--gold" routerLink="/auth">Registrarse</button>
        </div>
      </nav>

      <!-- ═══════════════════ HERO ═══════════════════ -->
      <section class="hero reveal">
        <div class="hero__badge">🎓 Proyecto Académico Universitario</div>

        <h1 class="hero__title">
          <span class="gold-stroke">POKÉMON</span>
          <span class="hero__title--sub">Trading Card Game Web</span>
        </h1>

        <p class="hero__desc">
          Una plataforma interactiva de combate por turnos que integra multijugador en tiempo real,
          inteligencia artificial, autenticación segura, consumo de API externa y persistencia en la nube.
        </p>

        <div class="hero__buttons">
          <button class="btn btn--primary btn--lg pulse" routerLink="/auth">
            Entrar al Sistema &nbsp;→
          </button>
          <button class="btn btn--outline btn--lg" routerLink="/auth">
            Crear Cuenta
          </button>
        </div>

        <div class="hero__stats">
          <div class="stat"><span class="stat__num">6+</span><span class="stat__label">Fases de desarrollo</span></div>
          <div class="stat__sep"></div>
          <div class="stat"><span class="stat__num">P2P</span><span class="stat__label">Multijugador real</span></div>
          <div class="stat__sep"></div>
          <div class="stat"><span class="stat__num">API</span><span class="stat__label">PokéAPI integrada</span></div>
          <div class="stat__sep"></div>
          <div class="stat"><span class="stat__num">IA</span><span class="stat__label">Motor local autónomo</span></div>
        </div>
      </section>

      <!-- ═══════════════════ ACADEMIC SECTION ═══════════════════ -->
      <section class="section-wrap reveal">
        <div class="section-label">Sobre el proyecto</div>
        <h2 class="section-title">¿Qué es este sistema?</h2>

        <div class="cards-2col">
          <div class="glass-card">
            <div class="glass-card__icon">🎓</div>
            <h3>Presentación del Proyecto</h3>
            <p>
              Aplicación integral que demuestra los conocimientos adquiridos durante el curso:
              diseño de interfaces web, consumo de APIs externas, programación del lado del cliente,
              almacenamiento de datos, lógica de videojuego, autenticación, persistencia de partidas
              y comunicación en tiempo real entre jugadores.
            </p>
          </div>

          <div class="glass-card">
            <div class="glass-card__icon">🎯</div>
            <h3>Propósito General</h3>
            <p>
              Diseñar, implementar y documentar una aplicación web interactiva que integre servicios
              externos, lógica de videojuego, persistencia local y remota, autenticación y multijugador.
              El sistema demuestra la organización de componentes, arquitectura funcional y conexión
              real entre frontend y base de datos.
            </p>
          </div>
        </div>
      </section>

      <!-- ═══════════════════ TECHNOLOGIES ═══════════════════ -->
      <section class="section-wrap reveal">
        <div class="section-label">Stack tecnológico</div>
        <h2 class="section-title">Infraestructura Tecnológica</h2>

        <div class="tech-bento">
          <div class="tech-card tech-card--wide glass-card">
            <div class="tech-card__icon ang">A</div>
            <div>
              <h3>Angular 17+</h3>
              <p>Standalone Components, Signals, Lazy Loading, Guards y arquitectura modular por features.</p>
            </div>
          </div>

          <div class="tech-card glass-card">
            <div class="tech-card__icon supa">S</div>
            <div>
              <h3>Supabase</h3>
              <p>Auth, Realtime WebSockets y base de datos Postgres en la nube.</p>
            </div>
          </div>

          <div class="tech-card glass-card">
            <div class="tech-card__icon poke">P</div>
            <div>
              <h3>PokéAPI</h3>
              <p>Consumo de servicio REST externo para datos de Pokémon, sprites y estadísticas.</p>
            </div>
          </div>

          <div class="tech-card glass-card">
            <div class="tech-card__icon ts">TS</div>
            <div>
              <h3>TypeScript</h3>
              <p>Tipado estricto end-to-end para garantizar cero errores de runtime en producción.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════════════ FEATURES / ACHIEVEMENTS ═══════════════════ -->
      <section class="section-wrap reveal">
        <div class="section-label">Funcionalidades</div>
        <h2 class="section-title">Objetivos Logrados</h2>

        <div class="features-grid">
          <div class="feature-card glass-card">
            <span class="feature-card__icon">⚔️</span>
            <h3>Multijugador P2P</h3>
            <p>Combate en tiempo real sincronizado vía WebSockets entre dos jugadores conectados remotamente.</p>
          </div>

          <div class="feature-card glass-card">
            <span class="feature-card__icon">🤖</span>
            <h3>Inteligencia Artificial</h3>
            <p>Motor lógico local que controla al rival en partidas de práctica, respetando todas las reglas.</p>
          </div>

          <div class="feature-card glass-card">
            <span class="feature-card__icon">💾</span>
            <h3>Persistencia Global</h3>
            <p>Historial, colección de cartas y mazos guardados en la nube y accesibles desde cualquier dispositivo.</p>
          </div>

          <div class="feature-card glass-card">
            <span class="feature-card__icon">🃏</span>
            <h3>Sistema de Cartas</h3>
            <p>Colección de Pokémon obtenibles mediante sobres con rareza, animación de apertura y guardado.</p>
          </div>

          <div class="feature-card glass-card">
            <span class="feature-card__icon">🔐</span>
            <h3>Autenticación Segura</h3>
            <p>Login y registro completo con Supabase Auth, persistencia de sesión y guards de rutas.</p>
          </div>

          <div class="feature-card glass-card">
            <span class="feature-card__icon">🏛️</span>
            <h3>Arquitectura Limpia</h3>
            <p>Separación estricta de features, stores, servicios core y componentes reutilizables.</p>
          </div>
        </div>
      </section>

      <!-- ═══════════════════ ARCHITECTURE ═══════════════════ -->
      <section class="section-wrap reveal">
        <div class="section-label">Diseño del sistema</div>
        <h2 class="section-title">Arquitectura del Sistema</h2>

        <div class="arch-flow">
          <div class="arch-node glass-card">
            <span class="arch-node__icon">👤</span>
            <strong>Cliente Angular</strong>
            <small>UI · Guards · Signals</small>
          </div>
          <div class="arch-arrow">⟶</div>
          <div class="arch-node glass-card">
            <span class="arch-node__icon">☁️</span>
            <strong>Supabase Cloud</strong>
            <small>Auth · DB · Realtime</small>
          </div>
          <div class="arch-arrow">⟶</div>
          <div class="arch-node glass-card">
            <span class="arch-node__icon">🌐</span>
            <strong>PokéAPI</strong>
            <small>REST · Pokémon Data</small>
          </div>
        </div>
      </section>

      <!-- ═══════════════════ CTA FOOTER ═══════════════════ -->
      <footer class="cta-footer reveal">
        <div class="cta-card glass-card">
          <h2>¿Listo para la evaluación?</h2>
          <p>Accede al sistema y prueba el funcionamiento integral del proyecto académico.</p>
          <div class="cta-card__buttons">
            <button class="btn btn--primary btn--lg" routerLink="/auth">Iniciar Sesión</button>
            <button class="btn btn--outline btn--lg" routerLink="/auth">Crear Cuenta</button>
          </div>
        </div>
        <p class="footer-copy">Pokémon TCG Web — Proyecto Académico © 2025</p>
      </footer>

    </div>
  `,
  styles: [`
    /* ── ROOT ── */
    :host {
      display: block;
      --gold:   #ffcb05;
      --blue:   #3c5aa6;
      --red:    #cc0000;
      --glass:  rgba(8, 14, 30, 0.45);
      --glass-b: rgba(255,255,255,0.07);
      --muted:  #94a3b8;
      --white:  #f8fafc;
      --ease:   cubic-bezier(.4,0,.2,1);
      font-family: 'Inter', system-ui, sans-serif;
      color: var(--white);
    }

    /* ── FIXED BACKGROUND OVERLAY ── */
    .bg-overlay {
      position: fixed; inset: 0; z-index: 0;
      pointer-events: none;
      background: linear-gradient(160deg,
        rgba(0,0,0,.88) 0%,
        rgba(10,18,40,.70) 50%,
        rgba(0,0,0,.80) 100%);
    }

    /* ── SCROLL BASE ── */
    .home-root {
      width: 100vw;
      min-height: 100vh;
      overflow-x: hidden;
      overflow-y: auto;
      scroll-behavior: smooth;
      /* background-image applied inline via Angular binding */
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      background-attachment: fixed;
    }

    /* Ensure all content sections appear above the fixed overlay */
    .topnav, .hero, .section-wrap, .cta-footer {
      position: relative;
      z-index: 1;
    }

    /* ── NAVBAR ── */
    .topnav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 200;
      display: flex; justify-content: space-between; align-items: center;
      padding: 18px 6%;
      transition: all .35s var(--ease);
    }
    .scrolled .topnav {
      background: rgba(6,10,22,.82);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid rgba(255,255,255,.06);
      padding: 12px 6%;
    }
    .topnav__brand {
      display: flex; align-items: center; gap: 12px;
      font-size: 1.05rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    }
    .topnav__brand strong { color: var(--gold); }
    .topnav__actions { display: flex; gap: 12px; }

    /* ── POKEBALL ── */
    .pokeball {
      width: 26px; height: 26px; border-radius: 50%;
      border: 2.5px solid white;
      background: linear-gradient(to bottom, var(--red) 50%, white 50%);
      position: relative; flex-shrink: 0;
    }
    .pokeball::before {
      content: ''; position: absolute;
      top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: 8px; height: 8px;
      background: white; border: 2px solid #333; border-radius: 50%;
    }

    /* ── BUTTONS ── */
    .btn {
      padding: 10px 22px; border-radius: 9px; font-size: .9rem;
      font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
      cursor: pointer; border: none; transition: all .28s var(--ease);
    }
    .btn--ghost { background: transparent; color: white; border: 1.5px solid rgba(255,255,255,.25); }
    .btn--ghost:hover { background: rgba(255,255,255,.08); border-color: white; }
    .btn--gold { background: var(--gold); color: #1e293b; }
    .btn--gold:hover { background: #fde047; transform: translateY(-2px); box-shadow: 0 6px 18px rgba(255,203,5,.35); }
    .btn--primary { background: linear-gradient(135deg, var(--blue) 0%, #2563eb 100%); color: white; }
    .btn--primary:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(59,130,246,.45); }
    .btn--outline { background: transparent; color: white; border: 2px solid rgba(255,255,255,.22); }
    .btn--outline:hover { background: rgba(255,255,255,.08); border-color: white; }
    .btn--lg { padding: 15px 36px; font-size: 1.05rem; border-radius: 11px; }

    /* ── GLASS CARD ── */
    .glass-card {
      background: var(--glass);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border: 1px solid var(--glass-b);
      border-radius: 18px;
      box-shadow: 0 8px 32px rgba(0,0,0,.4);
      padding: 28px;
      transition: all .3s var(--ease);
    }

    /* ── HERO ── */
    .hero {
      min-height: 100vh;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      text-align: center;
      padding: 130px 5% 60px;
      gap: 24px;
    }
    .hero__badge {
      background: rgba(59,130,246,.18);
      border: 1px solid rgba(59,130,246,.5);
      color: #93c5fd;
      padding: 7px 18px; border-radius: 30px;
      font-size: .78rem; font-weight: 700; letter-spacing: .18em; text-transform: uppercase;
    }
    .hero__title {
      font-size: clamp(3.2rem, 9vw, 6.5rem);
      font-weight: 900; line-height: 1.05;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      margin: 0;
    }
    .gold-stroke {
      color: var(--gold);
      -webkit-text-stroke: 2px var(--blue);
      text-shadow: 4px 4px 0 var(--blue);
      letter-spacing: .05em;
    }
    .hero__title--sub {
      color: white; font-size: clamp(1.4rem, 4vw, 2.6rem);
      letter-spacing: .35em; font-weight: 300;
    }
    .hero__desc {
      max-width: 680px;
      font-size: 1.15rem; color: var(--muted); line-height: 1.7; font-weight: 300;
    }
    .hero__buttons { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }

    /* Pulse animation on primary CTA */
    .pulse { animation: pulseRing 2.2s infinite; }
    @keyframes pulseRing {
      0%   { box-shadow: 0 0 0 0  rgba(59,130,246,.5); }
      70%  { box-shadow: 0 0 0 16px rgba(59,130,246,0); }
      100% { box-shadow: 0 0 0 0  rgba(59,130,246,0); }
    }

    /* Hero stats strip */
    .hero__stats {
      display: flex; align-items: center; gap: 0;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 14px; overflow: hidden;
      margin-top: 10px;
    }
    .stat { padding: 18px 30px; text-align: center; }
    .stat__num { display: block; font-size: 1.6rem; font-weight: 900; color: var(--gold); }
    .stat__label { display: block; font-size: .75rem; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; margin-top: 2px; }
    .stat__sep { width: 1px; height: 48px; background: rgba(255,255,255,.1); }

    /* ── SECTION COMMON ── */
    .section-wrap {
      max-width: 1200px; margin: 0 auto;
      padding: 80px 5%;
    }
    .section-label {
      font-size: .78rem; font-weight: 700; letter-spacing: .2em;
      text-transform: uppercase; color: var(--gold); margin-bottom: 12px;
    }
    .section-title {
      font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 800;
      margin: 0 0 48px; line-height: 1.2;
      border-bottom: 3px solid var(--gold); display: inline-block; padding-bottom: 10px;
    }

    /* ── 2-COL CARDS ── */
    .cards-2col {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }
    .cards-2col .glass-card h3 { font-size: 1.3rem; margin: 0 0 12px; color: white; }
    .cards-2col .glass-card p  { color: var(--muted); line-height: 1.7; text-align: justify; }
    .glass-card__icon { font-size: 2.2rem; margin-bottom: 16px; display: block; }
    .cards-2col .glass-card:hover {
      border-color: rgba(255,203,5,.25);
      transform: translateY(-5px);
      box-shadow: 0 16px 40px rgba(0,0,0,.5), 0 0 20px rgba(255,203,5,.08);
    }

    /* ── TECH BENTO ── */
    .tech-bento {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      grid-template-rows: auto auto;
      gap: 20px;
    }
    .tech-card { display: flex; align-items: center; gap: 18px; }
    .tech-card--wide { grid-column: 1 / 2; grid-row: 1 / 3; flex-direction: column; justify-content: center; align-items: flex-start; }
    .tech-card h3 { font-size: 1.15rem; margin: 0 0 6px; color: white; }
    .tech-card p  { color: var(--muted); font-size: .9rem; line-height: 1.55; margin: 0; }
    .tech-card__icon {
      width: 52px; height: 52px; border-radius: 13px;
      display: flex; justify-content: center; align-items: center;
      font-size: 1.4rem; font-weight: 900; color: white; flex-shrink: 0;
    }
    .tech-card--wide .tech-card__icon { width: 64px; height: 64px; font-size: 2rem; border-radius: 16px; margin-bottom: 8px; }
    .ang  { background: linear-gradient(135deg, #dd0031, #9c0025); }
    .supa { background: linear-gradient(135deg, #3ecf8e, #1a9e68); }
    .poke { background: linear-gradient(135deg, var(--red), #991b1b); }
    .ts   { background: linear-gradient(135deg, #3178c6, #1d4ed8); }
    .tech-card:hover { transform: translateY(-4px); border-color: rgba(255,255,255,.15); }

    /* ── FEATURES GRID ── */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 22px;
    }
    .feature-card { text-align: center; }
    .feature-card__icon { font-size: 2.8rem; display: block; margin-bottom: 18px; }
    .feature-card h3 { font-size: 1.1rem; color: var(--gold); margin: 0 0 10px; }
    .feature-card p  { color: var(--muted); font-size: .9rem; line-height: 1.6; margin: 0; }
    .feature-card:hover {
      transform: translateY(-7px);
      border-color: rgba(255,203,5,.25);
      box-shadow: 0 14px 36px rgba(0,0,0,.5), 0 0 18px rgba(255,203,5,.07);
    }

    /* ── ARCHITECTURE FLOW ── */
    .arch-flow {
      display: flex; align-items: center; justify-content: center;
      gap: 16px; flex-wrap: wrap;
    }
    .arch-node { text-align: center; flex: 1 1 200px; max-width: 240px; }
    .arch-node__icon { font-size: 2rem; display: block; margin-bottom: 10px; }
    .arch-node strong { display: block; font-size: 1.1rem; margin-bottom: 4px; }
    .arch-node small { color: var(--muted); font-size: .85rem; }
    .arch-arrow { font-size: 2rem; color: var(--gold); flex-shrink: 0; }
    .arch-node:hover { transform: scale(1.04); border-color: rgba(255,203,5,.3); }

    /* ── CTA FOOTER ── */
    .cta-footer {
      padding: 60px 5% 40px;
      text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 24px;
    }
    .cta-card { max-width: 720px; width: 100%; padding: 50px 36px;
      background: linear-gradient(135deg, rgba(10,20,50,.7), rgba(30,58,138,.45));
      border-color: rgba(59,130,246,.25); }
    .cta-card h2 { font-size: 2rem; margin: 0 0 12px; }
    .cta-card p  { color: var(--muted); margin: 0 0 28px; font-size: 1.05rem; }
    .cta-card__buttons { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    .footer-copy { color: rgba(255,255,255,.25); font-size: .8rem; margin: 0; }

    /* ── REVEAL ANIMATION ── */
    .reveal {
      opacity: 0;
      transform: translateY(36px);
      animation: revealUp .8s cubic-bezier(.16,1,.3,1) forwards;
    }
    .reveal:nth-child(2)  { animation-delay: .08s; }
    .reveal:nth-child(3)  { animation-delay: .16s; }
    .reveal:nth-child(4)  { animation-delay: .24s; }
    .reveal:nth-child(5)  { animation-delay: .32s; }
    .reveal:nth-child(6)  { animation-delay: .40s; }
    .reveal:nth-child(7)  { animation-delay: .48s; }

    @keyframes revealUp {
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── RESPONSIVE ── */
    @media (max-width: 900px) {
      .tech-bento {
        grid-template-columns: 1fr 1fr;
      }
      .tech-card--wide { grid-column: 1 / 3; grid-row: auto; flex-direction: row; }
    }
    @media (max-width: 640px) {
      .topnav__actions .btn--ghost { display: none; }
      .hero__stats { flex-wrap: wrap; }
      .stat__sep { display: none; }
      .tech-bento { grid-template-columns: 1fr; }
      .tech-card--wide { grid-column: auto; }
      .arch-arrow { transform: rotate(90deg); }
      .arch-flow { flex-direction: column; }
      .cta-card { padding: 36px 20px; }
    }
  `]
})
export class HomeComponent {
  scrolled = signal(false);

  @HostListener('window:scroll', [])
  onScroll() { this.scrolled.set(window.scrollY > 40); }
}
