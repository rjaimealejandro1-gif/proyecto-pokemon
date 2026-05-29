import { PokemonType } from '../enums/pokemon-type.enum';
import { CardRarity } from '../enums/card-rarity.enum';

export interface StatusEffect {
  type: 'POISON' | 'STUN' | 'SHIELD' | 'HEAL' | 'ATK_UP' | 'DEF_UP';
  value: number; // Cantidad de daño, curación o buff
  duration: number; // Turnos restantes
}

export interface Card {
  id: string;
  name: string;
  imageUrl: string;
  type: PokemonType;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  rarity: CardRarity;
  cost: number;
  level: number;
  ability?: string;
  description?: string;
  isReadyToAttack: boolean;
  ownerId?: string;
  statusEffects?: StatusEffect[];
}
