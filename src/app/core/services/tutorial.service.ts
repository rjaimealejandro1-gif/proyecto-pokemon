import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SqliteService } from './sqlite.service';

const LS_KEY = 'tcg_tutorial_completed';

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  targetId?: string;
  route?: string;
  characterImg: string;
  charPosition: 'left' | 'right';
}

@Injectable({
  providedIn: 'root'
})
export class TutorialService {
  private readonly router = inject(Router);
  private readonly sqlite = inject(SqliteService);

  public readonly isActive = signal<boolean>(false);
  public readonly currentStepIndex = signal<number>(0);
  public readonly currentStep = signal<TutorialStep | null>(null);

  public readonly steps: TutorialStep[] = [
    {
      id: 'welcome',
      title: 'BIENVENIDO AL TÁCTICO',
      text: 'Saludos, duelista. Soy tu inteligencia táctica. Te guiaré brevemente por las instalaciones antes de tu primer despliegue en la Arena.',
      characterImg: 'intrucciones2.png',
      charPosition: 'left'
    },
    {
      id: 'dash-play',
      title: 'ZONA DE DESPLIEGUE',
      text: '"JUGAR ONLINE" te empareja contra duelistas reales via Supabase. "ENTRENAMIENTO" es combate contra la IA local, sin necesidad de conexión.',
      targetId: 'tut-btn-online',
      characterImg: 'intrucciones.png',
      charPosition: 'right'
    },
    {
      id: 'dash-nav',
      title: 'SISTEMAS TÁCTICOS',
      text: 'El menú lateral te da acceso a tu Colección de cartas, el Constructor de Mazos, el Leaderboard global y el Manual del Duelista.',
      targetId: 'tut-btn-collection',
      characterImg: 'intrucciones2.png',
      charPosition: 'left'
    },
    {
      id: 'collection-intro',
      title: 'ENCICLOPEDIA DE CARTAS',
      text: 'Aquí está tu arsenal. Cada carta tiene HP, ATK y DEF. Las de rareza Épica y Legendaria poseen Habilidades especiales como Curación o Veneno.',
      route: '/cards',
      targetId: 'tut-collection-grid',
      characterImg: 'intrucciones.png',
      charPosition: 'right'
    },
    {
      id: 'deck-intro',
      title: 'CONSTRUCTOR DE MAZOS',
      text: 'Forja tu estrategia aquí. Tu mazo debe tener exactamente 20 cartas. Balancea tropas económicas con unidades pesadas para no quedarte sin energía.',
      route: '/deck',
      targetId: 'tut-deck-list',
      characterImg: 'intrucciones2.png',
      charPosition: 'left'
    },
    {
      id: 'combat-rules',
      title: 'REGLAS DE COMBATE',
      text: 'En batalla usas energía para invocar unidades. Si el rival no tiene defensas, atacas directamente su HP. La debilidad elemental (Fuego vs Planta, etc.) causa el doble de daño.',
      route: '/dashboard',
      targetId: 'tut-btn-online',
      characterImg: 'intrucciones.png',
      charPosition: 'right'
    },
    {
      id: 'farewell',
      title: 'PREPARACIÓN COMPLETADA',
      text: '¡El campo de batalla te espera, duelista! Construye tu mazo, desafía a otros jugadores online y escala en el Leaderboard. ¡Demuestra tu valor táctico!',
      characterImg: 'intrucciones2.png',
      charPosition: 'left'
    }
  ];

  constructor() { }

  /**
   * Verificación INMEDIATA usando localStorage.
   * localStorage es síncrono y siempre disponible — no depende de SQLite.
   * Solo muestra el tutorial si NUNCA se ha marcado como completado.
   */
  public checkAndStartTutorial(): void {
    // Verificación instantánea via localStorage (sin async, sin timing issues)
    const alreadyDone = localStorage.getItem(LS_KEY);
    if (alreadyDone === 'true') {
      return; // Usuario existente → no molestar
    }

    // Usuario nuevo → mostrar tras breve pausa cinematográfica
    setTimeout(() => {
      this.startTutorial();
    }, 1500);
  }

  public startTutorial(): void {
    this.isActive.set(true);
    this.currentStepIndex.set(0);
    this.applyStep(this.steps[0]);
  }

  public nextStep(): void {
    const nextIdx = this.currentStepIndex() + 1;
    if (nextIdx >= this.steps.length) {
      this.finishTutorial();
    } else {
      this.currentStepIndex.set(nextIdx);
      this.applyStep(this.steps[nextIdx]);
    }
  }

  public finishTutorial(): void {
    this.isActive.set(false);
    this.currentStep.set(null);

    // Guardar en localStorage (inmediato, siempre funciona)
    localStorage.setItem(LS_KEY, 'true');

    // Guardar también en SQLite como respaldo (fire and forget)
    try {
      if (this.sqlite.isReady()) {
        this.sqlite.execute(
          `INSERT OR REPLACE INTO kv_store (id, data) VALUES ('tutorial_completed', 'true')`
        );
      }
    } catch (e) {
      console.warn('[TutorialService] SQLite backup save failed (localStorage already saved)', e);
    }

    this.router.navigate(['/dashboard'], { replaceUrl: true });
  }

  private applyStep(step: TutorialStep): void {
    this.currentStep.set(step);
    if (step.route) {
      this.router.navigate([step.route]);
    }
  }
}
