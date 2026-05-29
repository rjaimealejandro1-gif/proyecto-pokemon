import { PokemonType } from '../enums/pokemon-type.enum';

export const TYPE_ADVANTAGES: Record<PokemonType, Partial<Record<PokemonType, number>>> = {
  [PokemonType.FIRE]: {
    [PokemonType.GRASS]: 2.0,
    [PokemonType.ICE]: 2.0,
    [PokemonType.BUG]: 2.0,
    [PokemonType.STEEL]: 2.0,
    [PokemonType.WATER]: 0.5,
    [PokemonType.FIRE]: 0.5,
    [PokemonType.ROCK]: 0.5,
    [PokemonType.DRAGON]: 0.5
  },
  [PokemonType.WATER]: {
    [PokemonType.FIRE]: 2.0,
    [PokemonType.GROUND]: 2.0,
    [PokemonType.ROCK]: 2.0,
    [PokemonType.WATER]: 0.5,
    [PokemonType.GRASS]: 0.5,
    [PokemonType.DRAGON]: 0.5
  },
  [PokemonType.GRASS]: {
    [PokemonType.WATER]: 2.0,
    [PokemonType.GROUND]: 2.0,
    [PokemonType.ROCK]: 2.0,
    [PokemonType.FIRE]: 0.5,
    [PokemonType.GRASS]: 0.5,
    [PokemonType.POISON]: 0.5,
    [PokemonType.FLYING]: 0.5,
    [PokemonType.BUG]: 0.5,
    [PokemonType.STEEL]: 0.5,
    [PokemonType.DRAGON]: 0.5
  },
  [PokemonType.ELECTRIC]: {
    [PokemonType.WATER]: 2.0,
    [PokemonType.FLYING]: 2.0,
    [PokemonType.ELECTRIC]: 0.5,
    [PokemonType.GRASS]: 0.5,
    [PokemonType.DRAGON]: 0.5,
    [PokemonType.GROUND]: 0.0
  },
  // Por defecto, otros tipos devuelven 1.0 a menos que se especifique
  [PokemonType.NORMAL]: { [PokemonType.ROCK]: 0.5, [PokemonType.STEEL]: 0.5, [PokemonType.GHOST]: 0.0 },
  [PokemonType.ICE]: { [PokemonType.GRASS]: 2.0, [PokemonType.GROUND]: 2.0, [PokemonType.FLYING]: 2.0, [PokemonType.DRAGON]: 2.0, [PokemonType.FIRE]: 0.5, [PokemonType.WATER]: 0.5, [PokemonType.ICE]: 0.5, [PokemonType.STEEL]: 0.5 },
  [PokemonType.FIGHTING]: { [PokemonType.NORMAL]: 2.0, [PokemonType.ICE]: 2.0, [PokemonType.ROCK]: 2.0, [PokemonType.DARK]: 2.0, [PokemonType.STEEL]: 2.0, [PokemonType.POISON]: 0.5, [PokemonType.FLYING]: 0.5, [PokemonType.PSYCHIC]: 0.5, [PokemonType.BUG]: 0.5, [PokemonType.FAIRY]: 0.5, [PokemonType.GHOST]: 0.0 },
  [PokemonType.POISON]: { [PokemonType.GRASS]: 2.0, [PokemonType.FAIRY]: 2.0, [PokemonType.POISON]: 0.5, [PokemonType.GROUND]: 0.5, [PokemonType.ROCK]: 0.5, [PokemonType.GHOST]: 0.5, [PokemonType.STEEL]: 0.0 },
  [PokemonType.GROUND]: { [PokemonType.FIRE]: 2.0, [PokemonType.ELECTRIC]: 2.0, [PokemonType.POISON]: 2.0, [PokemonType.ROCK]: 2.0, [PokemonType.STEEL]: 2.0, [PokemonType.GRASS]: 0.5, [PokemonType.BUG]: 0.5, [PokemonType.FLYING]: 0.0 },
  [PokemonType.FLYING]: { [PokemonType.GRASS]: 2.0, [PokemonType.FIGHTING]: 2.0, [PokemonType.BUG]: 2.0, [PokemonType.ELECTRIC]: 0.5, [PokemonType.ROCK]: 0.5, [PokemonType.STEEL]: 0.5 },
  [PokemonType.PSYCHIC]: { [PokemonType.FIGHTING]: 2.0, [PokemonType.POISON]: 2.0, [PokemonType.PSYCHIC]: 0.5, [PokemonType.STEEL]: 0.5, [PokemonType.DARK]: 0.0 },
  [PokemonType.BUG]: { [PokemonType.GRASS]: 2.0, [PokemonType.PSYCHIC]: 2.0, [PokemonType.DARK]: 2.0, [PokemonType.FIRE]: 0.5, [PokemonType.FIGHTING]: 0.5, [PokemonType.POISON]: 0.5, [PokemonType.FLYING]: 0.5, [PokemonType.GHOST]: 0.5, [PokemonType.STEEL]: 0.5, [PokemonType.FAIRY]: 0.5 },
  [PokemonType.ROCK]: { [PokemonType.FIRE]: 2.0, [PokemonType.ICE]: 2.0, [PokemonType.FLYING]: 2.0, [PokemonType.BUG]: 2.0, [PokemonType.FIGHTING]: 0.5, [PokemonType.GROUND]: 0.5, [PokemonType.STEEL]: 0.5 },
  [PokemonType.GHOST]: { [PokemonType.PSYCHIC]: 2.0, [PokemonType.GHOST]: 2.0, [PokemonType.DARK]: 0.5, [PokemonType.NORMAL]: 0.0 },
  [PokemonType.DRAGON]: { [PokemonType.DRAGON]: 2.0, [PokemonType.STEEL]: 0.5, [PokemonType.FAIRY]: 0.0 },
  [PokemonType.DARK]: { [PokemonType.PSYCHIC]: 2.0, [PokemonType.GHOST]: 2.0, [PokemonType.FIGHTING]: 0.5, [PokemonType.DARK]: 0.5, [PokemonType.FAIRY]: 0.5 },
  [PokemonType.STEEL]: { [PokemonType.ICE]: 2.0, [PokemonType.ROCK]: 2.0, [PokemonType.FAIRY]: 2.0, [PokemonType.FIRE]: 0.5, [PokemonType.WATER]: 0.5, [PokemonType.ELECTRIC]: 0.5, [PokemonType.STEEL]: 0.5 },
  [PokemonType.FAIRY]: { [PokemonType.FIGHTING]: 2.0, [PokemonType.DRAGON]: 2.0, [PokemonType.DARK]: 2.0, [PokemonType.FIRE]: 0.5, [PokemonType.POISON]: 0.5, [PokemonType.STEEL]: 0.5 }
};

export function getEffectivenessMultiplier(attacker: PokemonType, defender: PokemonType): number {
  const advantage = TYPE_ADVANTAGES[attacker];
  if (advantage && advantage[defender] !== undefined) {
    return advantage[defender]!;
  }
  return 1.0;
}
