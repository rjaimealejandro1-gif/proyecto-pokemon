import { Player } from './player.model';
import { BattlePhase } from '../enums/battle-phase.enum';

export interface MatchStats {
  totalTurns: number;
  p1DamageDealt: number;
  p2DamageDealt: number;
  p1CardsDestroyed: number;
  p2CardsDestroyed: number;
  p1CardsPlayed: number;
  p2CardsPlayed: number;
  matchDurationMs: number;
  startTime: number;
}

export interface Battle {
  matchId: string;
  player1: Player;
  player2: Player;
  activePlayerId: string;
  phase: BattlePhase;
  turnNumber: number;
  winnerId: string | null;
  matchStats?: MatchStats;
}
