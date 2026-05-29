import { Injectable } from '@angular/core';
import { Card } from '../models/card.model';
import { CardRarity } from '../enums/card-rarity.enum';
import { RARITY_MULTIPLIERS } from '../constants/rarity.constants';
import { getEffectivenessMultiplier } from '../constants/battle.constants';
import { CardEffectsEngineService } from './card-effects-engine.service';
import { inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DamageCalculatorService {
  private readonly effectsEngine = inject(CardEffectsEngineService);

  /**
   * Calcula el HP escalado de una carta basado en su nivel.
   * HP = base_stat_hp * level
   */
  public calculateScaledHp(baseHp: number, level: number): number {
    return baseHp * level;
  }

  /**
   * Calcula el ATK escalado por rareza.
   * ATK = attack_base * multiplicador_rareza
   */
  public calculateScaledAttack(baseAttack: number, cardRarity: CardRarity, card?: Card): number {
    let atk = baseAttack;
    if (card) {
      atk = this.effectsEngine.calculateBuffedAttack(card);
    }
    const multiplier = RARITY_MULTIPLIERS[cardRarity] ?? 1.0;
    return Math.round(atk * multiplier);
  }

  /**
   * Calcula el Daño Final determinista entre un atacante y un defensor.
   * Daño = ATK - (DEF * 0.5)
   * DañoFinal = Daño * MultiplicadorTipo (Efectividad elemental)
   */
  public calculateFinalDamage(attacker: Card, defender: Card): number {
    const atk = this.calculateScaledAttack(attacker.attack, attacker.rarity, attacker);
    const buffedDef = this.effectsEngine.calculateBuffedDefense(defender);
    const def = Math.round(buffedDef * 0.5);
    
    // Daño base garantizando daño mínimo de 10 para evitar combates infinitos
    let baseDamage = Math.max(10, atk - def);
    
    // Si tiene escudo, anula el daño base
    if (this.effectsEngine.hasShield(defender)) {
      baseDamage = 0;
    }
    
    // Multiplicador elemental
    const typeMultiplier = getEffectivenessMultiplier(attacker.type, defender.type);
    let finalDamage = Math.round(baseDamage * typeMultiplier);
    
    // Balanceo estricto: El daño no puede ser negativo y limitamos un golpe de muerte instantánea absoluta
    finalDamage = Math.max(0, finalDamage);
    
    // Aseguramos que un solo ataque de carta nunca supere la vida máxima permitida de un jugador en una jugada estándar
    finalDamage = Math.min(1500, finalDamage);
    
    return finalDamage;
  }
}
