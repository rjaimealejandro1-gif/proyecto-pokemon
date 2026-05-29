import { CardRarity } from '../enums/card-rarity.enum';

export const RARITY_COSTS = {
  [CardRarity.COMMON]: 1,
  [CardRarity.RARE]: 2,
  [CardRarity.EPIC]: 4,
  [CardRarity.LEGENDARY]: 6
};

export const RARITY_MULTIPLIERS = {
  [CardRarity.COMMON]: 1.0,
  [CardRarity.RARE]: 1.2,
  [CardRarity.EPIC]: 1.5,
  [CardRarity.LEGENDARY]: 2.0
};
