import { BattlePhase } from '../enums/battle-phase.enum';

export interface BattleRoom {
  id: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  ownerId: string;
  rivalId: string | null;
  turnNumber: number;
  phase: BattlePhase;
  activePlayerId: string;
  createdAt: number;
  updatedAt: number;
}

export type OnlineActionType = 'PLAY_CARD' | 'ATTACK' | 'END_TURN' | 'DRAW_CARD' | 'APPLY_EFFECT' | 'GAME_OVER' | 'REQUEST_STATE_SYNC' | 'FULL_STATE_SYNC' | 'SYNC_DECK';

export interface OnlineActionPayload {
  actionId: string;
  type: OnlineActionType;
  playerId: string;
  timestamp: number;
  data: any; // Additional data depending on the action
}
