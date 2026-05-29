import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SqliteService } from './sqlite.service';
import { delay } from 'rxjs';

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  targetId?: string;       // ID del DOM a iluminar
  route?: string;          // Ruta en la que debe suceder
  characterImg: string;    // 'intrucciones.png' o 'intrucciones 2.png'
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
      text: 'Desde aquí accedes a los combates. "Online" te emparejará contra duelistas reales (requiere conexión Supabase), mientras que "Entrenamiento" es combate local contra la IA.',
      targetId: 'tut-btn-online',
      characterImg: 'intrucciones.png',
      charPosition: 'right'
    },
    {
      id: 'dash-nav',
      title: 'SISTEMAS TÁCTICOS',
      text: 'A tu izquierda tienes los módulos clave: gestión de mazos, tu colección completa y el registro de tu desempeño táctico (Leaderboard/Historial).',
      targetId: 'tut-btn-collection',
      characterImg: 'intrucciones2.png',
      charPosition: 'left'
    },
    {
      id: 'collection-intro',
      title: 'ENCICLOPEDIA DE CARTAS',
      text: 'Esta es tu colección. Cada carta tiene un Costo de Energía, Daño (ATK) y Vida (HP). Las cartas Raras y Épicas pueden tener Habilidades especiales (como Curación o Veneno).',
      route: '/cards',
      targetId: 'tut-collection-grid',
      characterImg: 'intrucciones.png',
      charPosition: 'right'
    },
    {
      id: 'deck-intro',
      title: 'CONSTRUCTOR DE MAZOS',
      text: 'Aquí forjas tu estrategia. Un mazo legal debe contener exactamente 20 cartas. Deberás balancear monstruos baratos con cartas pesadas para no quedarte sin energía.',
      route: '/deck',
      targetId: 'tut-deck-list',
      characterImg: 'intrucciones2.png',
      charPosition: 'left'
    },
    {
      id: 'combat-rules',
      title: 'REGLAS DE ENFRENTAMIENTO',
      text: 'En combate, usarás energía para invocar tropas. Puedes atacar directamente al rival si no tiene defensas. La debilidad elemental (ej. Fuego vs Planta) causa el doble de daño.',
      route: '/dashboard',
      targetId: 'tut-btn-manual',
      characterImg: 'intrucciones.png',
      charPosition: 'right'
    },
    {
      id: 'farewell',
      title: 'PREPARACIÓN COMPLETADA',
      text: 'El entrenamiento ha concluido. Modifica tu mazo y entra a la Arena. ¡Demuestra tu valor estratégico, duelista!',
      characterImg: 'intrucciones2.png',
      charPosition: 'left'
    }
  ];

  public currentStep = signal<TutorialStep | null>(null);

  constructor() { }

  /**
   * Revisa si el usuario ya hizo el tutorial. Si no, lo inicia.
   * Solo muestra el tutorial cuando hay confirmación EXPLÍCITA de que es nuevo usuario.
   * En caso de cualquier error o DB no lista → NO mostrar (seguro para usuarios existentes).
   */
  public async checkAndStartTutorial(): Promise<void> {
    // Esperar a que SQLite esté listo (hasta 5 segundos)
    let attempts = 0;
    while (!this.sqlite.isReady() && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    // Si SQLite nunca estuvo listo, abortamos silenciosamente
    if (!this.sqlite.isReady()) {
      console.warn('[TutorialService] SQLite no disponible, omitiendo tutorial.');
      return;
    }

    try {
      const res = this.sqlite.query(`SELECT data FROM kv_store WHERE id = 'tutorial_completed'`);
      // Solo mostramos si explícitamente NO existe el registro (usuario nuevo)
      if (res.length > 0) {
        // Existe el registro → usuario existente, no mostrar
        return;
      }
      // No existe el registro → usuario nuevo, mostrar tutorial
    } catch (e) {
      // Error de BD → asumir usuario existente, NO mostrar
      console.warn('[TutorialService] Error al verificar tutorial, omitiendo.', e);
      return;
    }
    
    // Solo llega aquí si es nuevo usuario confirmado
    setTimeout(() => {
      this.startTutorial();
    }, 1200);
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
    try {
      this.sqlite.execute(
        `INSERT OR REPLACE INTO kv_store (id, data) VALUES ('tutorial_completed', 'true')`
      );
    } catch (e) {
      console.error('[TutorialService] Fallo al guardar progreso del tutorial', e);
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
