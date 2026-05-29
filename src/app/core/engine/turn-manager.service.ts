import { Injectable, inject } from '@angular/core';
import { BattleStore } from '../state/battle.store';
import { BattlePhase } from '../enums/battle-phase.enum';
import { LoggerService } from '../services/logger.service';
import { AiEngineService } from './ai-engine.service';
import { CardEffectsEngineService } from './card-effects-engine.service';
import { SyncManagerService } from './sync-manager.service';
import { RoomManagerService } from './room-manager.service';
import { Injector } from '@angular/core';
import { SqliteService } from '../services/sqlite.service';
import { ResultStore } from '../state/result.store';

@Injectable({
  providedIn: 'root'
})
export class TurnManagerService {
  private readonly battleStore = inject(BattleStore);
  private readonly logger = inject(LoggerService);
  private readonly injector = inject(Injector);
  private readonly syncManager = inject(SyncManagerService);
  private readonly roomManager = inject(RoomManagerService);
  private readonly sqlite = inject(SqliteService);
  private readonly resultStore = inject(ResultStore);

  /**
   * Finaliza el turno del jugador activo y cede el control al rival.
   */
  public endTurn(forcePlayerId?: string, isRemote = false): void {
    if (!this.syncManager.canPerformAction(forcePlayerId) && !isRemote) return;
    
    const battle = this.battleStore.battleState();
    if (!battle || battle.phase === BattlePhase.GAME_OVER) return;

    // Cambiar de jugador activo
    const nextPlayerId = battle.activePlayerId === battle.player1.id 
      ? battle.player2.id 
      : battle.player1.id;

    this.battleStore.setBattleState({
      ...battle,
      activePlayerId: nextPlayerId,
      phase: BattlePhase.PLAYER_TURN
    });

    this.roomManager.updateRoomState({
      activePlayerId: nextPlayerId,
      phase: BattlePhase.PLAYER_TURN,
      turnNumber: battle.turnNumber + 1
    });

    if (!isRemote) {
      const stateHash = this.syncManager.generateStateHash();
      this.syncManager.dispatchAction('END_TURN', { stateHash }, forcePlayerId);
    }

    this.logger.log(`Turno finalizado. Próximo jugador activo: ${nextPlayerId}`);
    
    this.startNewTurn(nextPlayerId);
  }

  /**
   * Inicia un nuevo turno, aumentando maná, robando cartas y reseteando ataques.
   */
  public startNewTurn(playerId: string): void {
    const battle = this.battleStore.battleState();
    if (!battle) return;

    const isPlayer1 = battle.player1.id === playerId;
    const activePlayer = isPlayer1 ? battle.player1 : battle.player2;
    const nextMaxEnergy = Math.min(10, activePlayer.maxEnergy + 1);

    const updatedPlayer = { ...activePlayer };
    updatedPlayer.maxEnergy = nextMaxEnergy;
    updatedPlayer.energy = nextMaxEnergy;

    // Reset isReadyToAttack for cards on the field so they can attack this turn
    updatedPlayer.field = updatedPlayer.field.map(card => {
      if (card) {
        return { ...card, isReadyToAttack: true };
      }
      return null;
    });

    if (updatedPlayer.deck && updatedPlayer.deck.length > 0) {
      const drawnCard = { ...updatedPlayer.deck[0] };
      const updatedDeck = updatedPlayer.deck.slice(1);
      
      let updatedHand = [...updatedPlayer.hand];
      if (updatedHand.length < 7) {
        updatedHand.push(drawnCard);
        this.logger.log(`[TurnManager] ${activePlayer.username} roba carta: ${drawnCard.name}`);
      } else {
        this.logger.log(`[TurnManager] Mano llena para ${activePlayer.username}. Carta descartada.`);
      }

      updatedPlayer.deck = updatedDeck;
      updatedPlayer.hand = updatedHand;
    } else {
      this.logger.log(`[TurnManager] No quedan cartas en el mazo de ${activePlayer.username}`);
    }

    this.battleStore.setBattleState({
      ...battle,
      player1: isPlayer1 ? updatedPlayer : battle.player1,
      player2: isPlayer1 ? battle.player2 : updatedPlayer,
      phase: BattlePhase.PLAYER_TURN
    });

    const effectsEngine = this.injector.get(CardEffectsEngineService);
    effectsEngine.processTurnEffects(activePlayer.id);

    this.logger.log(`Nuevo turno iniciado para ${activePlayer.username}. Max Energía: ${nextMaxEnergy}`);

    if (activePlayer.id === 'player-ai') {
      const aiEngine = this.injector.get(AiEngineService);
      setTimeout(() => aiEngine.executeAiTurn(), 1000);
    }
  }

  public triggerGameOver(winnerId: string): void {
    const battle = this.battleStore.battleState();
    if (!battle) return;

    this.battleStore.setBattleState({
      ...battle,
      phase: BattlePhase.GAME_OVER,
      winnerId
    });

    this.logger.log(`PARTIDA FINALIZADA. Ganador: ${winnerId}`);

    // Update matchStats duration and turns
    const isAi = battle.player2.id === 'player-ai' || battle.player1.id === 'player-ai';
    const durationMs = battle.matchStats ? Date.now() - battle.matchStats.startTime : 0;
    const finalStats = battle.matchStats || {
      totalTurns: battle.turnNumber,
      p1DamageDealt: 0,
      p2DamageDealt: 0,
      p1CardsDestroyed: 0,
      p2CardsDestroyed: 0,
      p1CardsPlayed: 0,
      p2CardsPlayed: 0,
      matchDurationMs: 0,
      startTime: Date.now()
    };
    finalStats.totalTurns = battle.turnNumber;
    finalStats.matchDurationMs = durationMs;

    const isP1Winner = winnerId === battle.player1.id;
    const isVictory = isP1Winner; // Assuming player1 is always the user

    this.resultStore.setResult({
      winnerId,
      isVictory,
      opponentName: battle.player2.username,
      mode: isAi ? 'VS_IA' : 'ONLINE',
      stats: finalStats
    });

    // Si es partida contra IA, guardar en SQLite
    if (isAi) {
      const matchId = `offline-${Date.now()}`;
      
      const matchData = {
        playerScore: isVictory ? 1 : 0,
        aiScore: isVictory ? 0 : 1,
        turns: battle.turnNumber
      };

      try {
        this.sqlite.execute(
          `INSERT INTO local_matches (id, mode, result, data, created_at) VALUES (?, ?, ?, ?, ?)`,
          [matchId, 'VS_IA', isVictory ? 'VICTORIA' : 'DERROTA', JSON.stringify(matchData), Date.now()]
        );
        this.logger.log(`[SQLite] Partida offline guardada correctamente.`);
      } catch (e) {
        this.logger.error(`[SQLite] Error guardando partida offline.`, e);
      }
    }
  }
}
