import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * FASE 3 — Tutorial Interactivo (PLACEHOLDER)
 * Este componente se completará en la Fase 3 con diálogos, resaltados y pasos guiados.
 * Por ahora solo actúa como punto de llegada para usuarios nuevos después del registro.
 */
@Component({
  selector: 'app-tutorial',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="tutorial-root">
      <div class="tutorial-card">
        <div class="tutorial-icon">🎓</div>
        <h1 class="tutorial-title">¡Bienvenido, Entrenador!</h1>
        <p class="tutorial-desc">
          Estás a punto de entrar al mundo de Pokémon TCG Web.<br>
          En la próxima fase habilitaremos el tutorial interactivo completo con:<br>
          apertura de sobres, explicación del sistema de mazos y tu primer combate.
        </p>

        <div class="tutorial-steps">
          <div class="step">
            <span class="step-icon">🃏</span>
            <span class="step-text">Recibirás 3 sobres de inicio con Pokémon aleatorios.</span>
          </div>
          <div class="step">
            <span class="step-icon">⚔️</span>
            <span class="step-text">Aprenderás a construir tu primer mazo de 20 cartas.</span>
          </div>
          <div class="step">
            <span class="step-icon">🤖</span>
            <span class="step-text">Jugarás tu primera batalla de práctica contra la IA.</span>
          </div>
        </div>

        <button class="btn-enter" routerLink="/dashboard">
          Entrar al Dashboard →
        </button>
      </div>
    </div>
  `,
  styles: [`
    .tutorial-root {
      min-height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .tutorial-card {
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 203, 5, 0.2);
      border-radius: 24px;
      padding: 50px 40px;
      max-width: 560px;
      width: 100%;
      text-align: center;
      box-shadow: 0 0 40px rgba(255, 203, 5, 0.08);
      color: #f8fafc;
    }
    .tutorial-icon { font-size: 4rem; margin-bottom: 16px; display: block; }
    .tutorial-title {
      font-size: 2rem; font-weight: 900; color: #ffcb05;
      text-shadow: 0 0 20px rgba(255,203,5,0.3);
      margin: 0 0 16px;
    }
    .tutorial-desc {
      color: #94a3b8; line-height: 1.7; margin: 0 0 32px; font-size: 1rem;
    }
    .tutorial-steps {
      display: flex; flex-direction: column; gap: 16px;
      margin-bottom: 36px; text-align: left;
    }
    .step {
      display: flex; align-items: flex-start; gap: 14px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px; padding: 14px 18px;
    }
    .step-icon { font-size: 1.4rem; flex-shrink: 0; }
    .step-text { color: #e2e8f0; font-size: 0.95rem; line-height: 1.5; }
    .btn-enter {
      background: linear-gradient(135deg, #3c5aa6, #2563eb);
      color: white; border: none;
      padding: 14px 36px; border-radius: 12px;
      font-size: 1.1rem; font-weight: 700; cursor: pointer;
      letter-spacing: 0.05em;
      transition: all 0.3s ease;
    }
    .btn-enter:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 25px rgba(59,130,246,0.4);
    }
  `]
})
export class TutorialComponent {}
