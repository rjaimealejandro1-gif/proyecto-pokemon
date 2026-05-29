import { Injectable, inject } from '@angular/core';
import { BattleStore } from '../state/battle.store';
import { BattleManagerService } from './battle-manager.service';
import { TurnManagerService } from './turn-manager.service';
import { LoggerService } from '../services/logger.service';

@Injectable({
  providedIn: 'root'
})
export class AiEngineService {
  private readonly battleStore = inject(BattleStore);
  private readonly battleManager = inject(BattleManagerService);
  private readonly turnManager = inject(TurnManagerService);
  private readonly logger = inject(LoggerService);

  public executeAiTurn(): void {
    this.logger.log('🤖 IA Iniciando Turno Táctico...');

    setTimeout(() => {
      this.executeMainPhase();
      
      setTimeout(() => {
        this.executeAttackPhase();
        
        // Terminar turno
        this.turnManager.endTurn('player-ai');
      }, 1500);

    }, 1500);
  }

  private executeMainPhase(): void {
    const battle = this.battleStore.battleState();
    if (!battle) return;

    const ai = battle.player2; // Asumiendo player2 es IA
    if (ai.id !== battle.activePlayerId) return;

    // Estrategia: Invocar la carta más fuerte posible (Mayor ATK o HP) según energía
    const playableCards = ai.hand.filter(c => c.cost <= ai.energy).sort((a, b) => b.attack - a.attack);
    
    // Buscar slots vacíos
    const emptySlots = ai.field.map((c, i) => c === null ? i : -1).filter(i => i !== -1);

    if (playableCards.length > 0 && emptySlots.length > 0) {
      // Jugar la carta más fuerte en el primer slot vacío
      const cardToPlay = playableCards[0];
      const targetSlot = emptySlots[0];
      
      this.logger.log(`🤖 IA Táctica: Invoca [${cardToPlay.name}] en slot ${targetSlot}`);
      this.battleManager.summonCard(cardToPlay.id, targetSlot, 'player-ai');
    } else {
      this.logger.log(`🤖 IA Táctica: No hay cartas jugables o slots vacíos.`);
    }
  }

  private executeAttackPhase(): void {
    const battle = this.battleStore.battleState();
    if (!battle) return;

    const ai = battle.player2;
    const player = battle.player1;
    if (ai.id !== battle.activePlayerId) return;

    const readyAttackers = ai.field.filter(c => c !== null && c.isReadyToAttack);
    const validTargets = player.field.map((c, i) => c !== null ? i : -1).filter(i => i !== -1);

    if (validTargets.length === 0) {
      // Atacar directo al jugador si no tiene defensas
      readyAttackers.forEach(attacker => {
        if (attacker) {
          this.logger.log(`🤖 IA Táctica: ¡Ataque directo con [${attacker.name}]!`);
          this.battleManager.attackPlayerDirectly(attacker.id, 'player-ai');
        }
      });
    } else {
      // Prioridad: Si puede matar, atacar a ese. Sino, atacar al de mayor amenaza o cualquiera.
      readyAttackers.forEach(attacker => {
        if (!attacker) return;
        
        // Encontrar objetivo
        // Tomamos el primer objetivo vivo (simplificación)
        const currentBattle = this.battleStore.battleState()!;
        const currentValidTargets = currentBattle.player1.field.map((c, i) => c !== null ? i : -1).filter(i => i !== -1);
        
        if (currentValidTargets.length > 0) {
          const targetSlot = currentValidTargets[0];
          const defender = currentBattle.player1.field[targetSlot];
          
          if (defender) {
            this.logger.log(`🤖 IA Táctica: [${attacker.name}] ataca a [${defender.name}]`);
            this.battleManager.attackCard(attacker.id, defender.id, 'player-ai');
          }
        } else {
          this.logger.log(`🤖 IA Táctica: ¡Ataque directo con [${attacker.name}]!`);
          this.battleManager.attackPlayerDirectly(attacker.id, 'player-ai');
        }
      });
    }
  }
}
