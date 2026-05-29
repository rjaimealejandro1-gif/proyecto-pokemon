import { MatchState } from '../enums/match-state.enum';

export interface Match {
  id: string;
  player1Id: string;
  player2Id: string | null;
  status: MatchState;
  gameState: string;  // Serializado en JSON
  winnerId: string | null;
  createdAt: string;
  updatedAt: string;
}
