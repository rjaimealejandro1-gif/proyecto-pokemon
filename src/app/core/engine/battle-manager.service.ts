import { Injectable, inject } from '@angular/core';
import { BattleStore } from '../state/battle.store';
import { DamageCalculatorService } from './damage-calculator.service';
import { TurnManagerService } from './turn-manager.service';
import { LoggerService } from '../services/logger.service';
import { Card } from '../models/card.model';
import { BattlePhase } from '../enums/battle-phase.enum';
import { SyncManagerService } from './sync-manager.service';
import { DialogService } from '../services/dialog.service';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BattleManagerService {
  private readonly battleStore = inject(BattleStore);
  private readonly damageCalc = inject(DamageCalculatorService);
  private readonly turnManager = inject(TurnManagerService);
  private readonly logger = inject(LoggerService);
  private readonly syncManager = inject(SyncManagerService);
  private readonly dialog = inject(DialogService);

  // Event bus for visual animations (decoupled from state)
  public readonly onCombatEvent = new Subject<{
    type: 'DAMAGE' | 'HEAL' | 'DESTROY' | 'ATTACK_DIRECT',
    targetId: string, // card id or 'PLAYER_1'/'PLAYER_2'
    amount: number
  }>();

  /**
   * Invoca una carta de la mano a un slot específico del tablero.
   */
  public summonCard(cardId: string, slotIndex: number, forcePlayerId?: string, isRemote = false): boolean {
    if (!this.syncManager.canPerformAction(forcePlayerId) && !isRemote) return false;
    
    const battle = this.battleStore.battleState();
    if (!battle) return false;

    const activePlayer = battle.activePlayerId === battle.player1.id ? battle.player1 : battle.player2;

    // Verificar si es su turno y fase principal
    if (battle.phase !== BattlePhase.PLAYER_TURN) {
      this.logger.warn('Invocar fallido: No estás en tu turno de acción.');
      return false;
    }

    // Encontrar la carta en la mano
    const card = activePlayer.hand.find(c => c.id === cardId);
    if (!card) {
      this.logger.error(`[BattleManager] ERROR CRÍTICO: No se encontró la carta [${cardId}] en la mano de ${activePlayer.username}. ¡Sincronización fallida o ID inválido!`);
      // Evitar congelar la partida: rechazar explícitamente la invocación pero dejar que fluya
      return false;
    }

    // Verificar energía suficiente
    if (activePlayer.energy < card.cost) {
      this.logger.warn(`Energía insuficiente. Costo: ${card.cost}, Energía: ${activePlayer.energy}`);
      return false;
    }

    // Verificar slot vacío
    if (activePlayer.field[slotIndex] !== null) {
      this.logger.warn(`El slot ${slotIndex} del tablero ya está ocupado.`);
      return false;
    }

    // Invocar carta
    const updatedHand = activePlayer.hand.filter(c => c.id !== cardId);
    const updatedField = [...activePlayer.field];
    updatedField[slotIndex] = { ...card, isReadyToAttack: false }; // No ataca en el turno de invocación

    const updatedPlayer = {
      ...activePlayer,
      hand: updatedHand,
      field: updatedField,
      energy: activePlayer.energy - card.cost
    };

    let nextBattle = { ...battle };
    if (battle.activePlayerId === battle.player1.id) {
      nextBattle.player1 = updatedPlayer;
      if (nextBattle.matchStats) nextBattle.matchStats.p1CardsPlayed++;
    } else {
      nextBattle.player2 = updatedPlayer;
      if (nextBattle.matchStats) nextBattle.matchStats.p2CardsPlayed++;
    }
    
    this.battleStore.setBattleState(nextBattle);

    // Dispatch a SyncManager si no es un evento remoto
    if (!isRemote) {
      this.syncManager.dispatchAction('PLAY_CARD', { cardId, slotIndex }, forcePlayerId);
    }

    this.logger.log(`Carta [${card.name}] invocada con éxito en slot ${slotIndex}.`);
    return true;
  }

  /**
   * Ejecuta un ataque de una carta aliada en campo a una carta enemiga en campo.
   */
  public attackCard(attackerCardId: string, targetCardId: string, forcePlayerId?: string, isRemote = false): boolean {
    if (!this.syncManager.canPerformAction(forcePlayerId) && !isRemote) return false;

    const battle = this.battleStore.battleState();
    if (!battle) return false;

    if (battle.phase !== BattlePhase.PLAYER_TURN) {
      this.logger.warn('Acción no permitida: No estás en tu turno de acción.');
      return false;
    }

    const activePlayer = battle.activePlayerId === battle.player1.id ? battle.player1 : battle.player2;
    const opponentPlayer = battle.activePlayerId === battle.player1.id ? battle.player2 : battle.player1;

    // Encontrar atacante
    const attacker = activePlayer.field.find(c => c !== null && c.id === attackerCardId);
    if (!attacker) {
      this.logger.error(`[BattleManager] ERROR CRÍTICO: El atacante [${attackerCardId}] no existe en el campo de ${activePlayer.username}.`);
      return false;
    }

    if (!attacker.isReadyToAttack) {
      this.logger.warn(`La carta [${attacker.name}] ya atacó o acaba de ser invocada.`);
      return false;
    }

    // Encontrar defensor
    const defenderIndex = opponentPlayer.field.findIndex(c => c !== null && c.id === targetCardId);
    if (defenderIndex === -1) {
      this.logger.error(`[BattleManager] ERROR CRÍTICO: El defensor [${targetCardId}] no existe en el campo de ${opponentPlayer.username}.`);
      return false;
    }
    const defender = opponentPlayer.field[defenderIndex]!;

    // Calcular daño final
    const damage = this.damageCalc.calculateFinalDamage(attacker, defender);
    this.logger.log(`[${attacker.name}] ataca a [${defender.name}] infligiendo ${damage} de daño elemental.`);
    if (!forcePlayerId || forcePlayerId === 'player-user') {
      this.dialog.warning(`¡${attacker.name} inflige ${damage} a ${defender.name}!`);
    } else {
      this.dialog.warning(`¡IA ataca a tu ${defender.name} por ${damage} daño!`);
    }

    // Aplicar daño
    this.onCombatEvent.next({ type: 'DAMAGE', targetId: defender.id, amount: damage });

    const updatedOpponentField = [...opponentPlayer.field];
    const newHp = defender.hp - damage;

    if (newHp <= 0) {
      // Carta eliminada
      updatedOpponentField[defenderIndex] = null;
      opponentPlayer.discardPile.push({ ...defender, hp: 0 });
      this.logger.log(`Carta [${defender.name}] ha sido debilitada y enviada a la pila de descarte.`);
      
      // Emitir evento de destrucción para la UI
      setTimeout(() => this.onCombatEvent.next({ type: 'DESTROY', targetId: defender.id, amount: 0 }), 500);

      if (!forcePlayerId || forcePlayerId === 'player-user') {
        this.dialog.success(`¡Has destruido a ${defender.name}!`);
      } else {
        this.dialog.error(`¡Tu ${defender.name} fue destruido!`);
      }
    } else {
      // Sobrevive
      updatedOpponentField[defenderIndex] = { ...defender, hp: newHp };
    }

    // Deshabilitar ataque de esta carta en este turno
    const updatedActiveField = activePlayer.field.map(c => 
      c !== null && c.id === attackerCardId ? { ...c, isReadyToAttack: false } : c
    );

    const updatedActive = { ...activePlayer, field: updatedActiveField };
    const updatedOpponent = { ...opponentPlayer, field: updatedOpponentField };

    let nextBattle = { ...battle };
    if (battle.activePlayerId === battle.player1.id) {
      nextBattle.player1 = updatedActive;
      nextBattle.player2 = updatedOpponent;
      if (nextBattle.matchStats) {
        nextBattle.matchStats.p1DamageDealt += damage;
        if (newHp <= 0) nextBattle.matchStats.p1CardsDestroyed++;
      }
    } else {
      nextBattle.player1 = updatedOpponent;
      nextBattle.player2 = updatedActive;
      if (nextBattle.matchStats) {
        nextBattle.matchStats.p2DamageDealt += damage;
        if (newHp <= 0) nextBattle.matchStats.p2CardsDestroyed++;
      }
    }

    this.battleStore.setBattleState(nextBattle);

    // Dispatch a SyncManager
    if (!isRemote) {
      this.syncManager.dispatchAction('ATTACK', { attackerCardId, targetCardId, damage }, forcePlayerId);
    }

    return true;
  }

  /**
   * Ataca directamente a los puntos de vida (HP) del jugador rival si no tiene cartas en campo.
   */
  public attackPlayerDirectly(attackerCardId: string, forcePlayerId?: string, isRemote = false): boolean {
    if (!this.syncManager.canPerformAction(forcePlayerId) && !isRemote) return false;

    const battle = this.battleStore.battleState();
    if (!battle) return false;

    if (battle.phase !== BattlePhase.PLAYER_TURN) {
      this.logger.warn('Acción no permitida: No estás en tu turno de acción.');
      return false;
    }

    const activePlayer = battle.activePlayerId === battle.player1.id ? battle.player1 : battle.player2;
    const opponentPlayer = battle.activePlayerId === battle.player1.id ? battle.player2 : battle.player1;

    // Verificar si el rival tiene cartas en campo
    const hasOpponentCards = opponentPlayer.field.some(c => c !== null);
    if (hasOpponentCards) {
      this.logger.warn('No puedes atacar directamente al jugador si tiene monstruos defendiendo en el campo.');
      return false;
    }

    // Encontrar atacante
    const attackerIndex = activePlayer.field.findIndex(c => c !== null && c.id === attackerCardId);
    if (attackerIndex === -1) {
      this.logger.error(`[BattleManager] ERROR CRÍTICO: El atacante [${attackerCardId}] no existe en el campo para el Ataque Directo.`);
      return false;
    }
    const attacker = activePlayer.field[attackerIndex]!;

    if (!attacker.isReadyToAttack) {
      this.logger.warn(`La carta [${attacker.name}] ya atacó este turno.`);
      return false;
    }

    // Daño a Vidas (Estilo Arcade)
    const damageToLives = 1; // 1 Vida por ataque directo normal (se puede escalar por rareza después)
    const newPlayerLives = Math.max(0, opponentPlayer.lives - damageToLives);

    this.logger.log(`¡ATAQUE DIRECTO! [${attacker.name}] ataca directamente a ${opponentPlayer.username} quitándole ${damageToLives} Vida(s).`);

    // Emitir evento para pantalla roja/shake
    this.onCombatEvent.next({ type: 'ATTACK_DIRECT', targetId: opponentPlayer.id, amount: damageToLives });

    if (!forcePlayerId || forcePlayerId === 'player-user') {
      this.dialog.success(`¡Ataque Directo! El rival pierde 1 VIDA.`);
    } else {
      this.dialog.error(`¡Ataque Directo! Pierdes 1 VIDA.`);
    }

    // Deshabilitar ataque de esta carta en este turno
    const updatedActiveField = activePlayer.field.map(c => 
      c !== null && c.id === attackerCardId ? { ...c, isReadyToAttack: false } : c
    );

    // Actualizar estados
    const updatedActive = { ...activePlayer, field: updatedActiveField };
    const updatedOpponent = { ...opponentPlayer, lives: newPlayerLives };

    let nextBattle: any;
    if (battle.activePlayerId === battle.player1.id) {
      nextBattle = { ...battle, player1: updatedActive, player2: updatedOpponent };
      if (nextBattle.matchStats) nextBattle.matchStats.p1DamageDealt += damageToLives * 100; // Arbitrary conversion for stats
    } else {
      nextBattle = { ...battle, player1: updatedOpponent, player2: updatedActive };
      if (nextBattle.matchStats) nextBattle.matchStats.p2DamageDealt += damageToLives * 100;
    }

    this.battleStore.setBattleState(nextBattle);
    
    // Dispatch a SyncManager
    if (!isRemote) {
      this.syncManager.dispatchAction('ATTACK', { attackerCardId, target: 'PLAYER', damage: damageToLives }, forcePlayerId);
    }

    // Verificar condición de victoria
    if (newPlayerLives <= 0) {
      this.turnManager.triggerGameOver(activePlayer.id);
    }

    return true;
  }
}
