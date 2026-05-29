import { Injectable, signal, computed } from '@angular/core';
import { MatchState } from '../enums/match-state.enum';

@Injectable({
  providedIn: 'root'
})
export class GameStore {
  // Estado Privado
  private readonly _state = signal<MatchState>(MatchState.MENU);
  private readonly _isAuthenticated = signal<boolean>(false);
  private readonly _activeMatchId = signal<string | null>(null);

  // Signals de Solo Lectura Públicas
  public readonly appState = computed(() => this._state());
  public readonly isAuthenticated = computed(() => this._isAuthenticated());
  public readonly activeMatchId = computed(() => this._activeMatchId());

  // Acciones
  public setAppState(state: MatchState): void {
    this._state.set(state);
  }

  public setAuthenticated(auth: boolean): void {
    this._isAuthenticated.set(auth);
  }

  public setActiveMatch(matchId: string | null): void {
    this._activeMatchId.set(matchId);
    if (matchId) {
      this._state.set(MatchState.PLAYING);
    }
  }
}
