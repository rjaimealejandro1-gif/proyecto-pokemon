import { Injectable, signal, computed } from '@angular/core';
import { MatchStats } from '../models/battle.model';

export interface MatchResultPayload {
  winnerId: string;
  isVictory: boolean;
  opponentName: string;
  mode: 'ONLINE' | 'VS_IA';
  stats: MatchStats;
}

@Injectable({
  providedIn: 'root'
})
export class ResultStore {
  private readonly _resultData = signal<MatchResultPayload | null>(null);

  public readonly resultData = computed(() => this._resultData());

  public setResult(payload: MatchResultPayload | null): void {
    this._resultData.set(payload);
  }
}
