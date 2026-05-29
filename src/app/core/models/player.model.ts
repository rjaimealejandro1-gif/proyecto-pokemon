import { Card } from './card.model';

export interface Player {
  id: string;
  username: string;
  lives: number;
  maxLives: number;
  energy: number;
  maxEnergy: number;
  deck: Card[];
  hand: Card[];
  field: (Card | null)[];  // Arreglo de 5 slots
  discardPile: Card[];
}
