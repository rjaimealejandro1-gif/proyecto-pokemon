import { Injectable, inject } from '@angular/core';
import { BattleStore } from '../state/battle.store';
import { LoggerService } from '../services/logger.service';
import { Card, StatusEffect } from '../models/card.model';

@Injectable({
  providedIn: 'root'
})
export class CardEffectsEngineService {
  private readonly battleStore = inject(BattleStore);
  private readonly logger = inject(LoggerService);

  /**
   * Aplica un efecto de estado a una carta.
   */
  public applyEffect(card: Card, effect: StatusEffect): Card {
    const newCard = { ...card };
    newCard.statusEffects = [...(newCard.statusEffects || []), effect];
    this.logger.log(`Efecto de Habilidad: Aplicado [${effect.type}] a [${card.name}] por ${effect.duration} turnos.`);
    return newCard;
  }

  /**
   * Procesa los efectos de estado de todas las cartas de un jugador al inicio de su turno.
   */
  public processTurnEffects(playerId: string): void {
    const battle = this.battleStore.battleState();
    if (!battle) return;

    const player = battle.player1.id === playerId ? battle.player1 : battle.player2;
    const opponent = battle.player1.id === playerId ? battle.player2 : battle.player1;
    
    let hasChanges = false;
    
    const updatedField = player.field.map(card => {
      if (!card) return null;
      const result = this.processEffectsForCard(card, player);
      if (result !== card) hasChanges = true;
      return result;
    });

    if (hasChanges) {
      const updatedPlayer = { ...player, field: updatedField };
      const nextBattle = battle.player1.id === playerId 
        ? { ...battle, player1: updatedPlayer, player2: opponent }
        : { ...battle, player1: opponent, player2: updatedPlayer };

      this.battleStore.setBattleState(nextBattle);
    }
  }

  private processEffectsForCard(card: Card, player: any): Card | null {
    if (!card.statusEffects || card.statusEffects.length === 0) return card;

    let newCard = { ...card };
    const remainingEffects: StatusEffect[] = [];
    let isDead = false;

    for (const effect of (newCard.statusEffects || [])) {
      if (effect.type === 'POISON') {
        newCard.hp -= effect.value;
        this.logger.log(`Efecto: [${newCard.name}] sufre ${effect.value} daño por veneno.`);
        if (newCard.hp <= 0) isDead = true;
      } else if (effect.type === 'HEAL') {
        newCard.hp = Math.min(newCard.maxHp, newCard.hp + effect.value);
        this.logger.log(`Efecto: [${newCard.name}] se cura ${effect.value} HP.`);
      }

      if (effect.duration > 1) {
        remainingEffects.push({ ...effect, duration: effect.duration - 1 });
      }
    }

    if (isDead) {
      this.logger.log(`[${newCard.name}] ha sido debilitado por efectos de estado.`);
      // Enviamos a discard pile localmente si es posible
      player.discardPile.push({ ...newCard, hp: 0 });
      return null;
    }

    newCard.statusEffects = remainingEffects;
    return newCard;
  }

  public calculateBuffedAttack(card: Card): number {
    let atk = card.attack;
    card.statusEffects?.forEach(e => {
      if (e.type === 'ATK_UP') atk += e.value;
    });
    return atk;
  }

  public calculateBuffedDefense(card: Card): number {
    let def = card.defense;
    card.statusEffects?.forEach(e => {
      if (e.type === 'DEF_UP') def += e.value;
    });
    return def;
  }
  
  public isStunned(card: Card): boolean {
    return card.statusEffects?.some(e => e.type === 'STUN') ?? false;
  }
  
  public hasShield(card: Card): boolean {
    return card.statusEffects?.some(e => e.type === 'SHIELD') ?? false;
  }
}
