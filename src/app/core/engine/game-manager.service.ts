// Agregando validación de isLoading() y retry logic al game-manager.service.ts
import { Injectable, inject } from '@angular/core';
import { GameStore } from '../state/game.store';
import { BattleStore } from '../state/battle.store';
import { PlayerStore } from '../state/player.store';
import { MatchState } from '../enums/match-state.enum';
import { Router } from '@angular/router';
import { LoggerService } from '../services/logger.service';
import { RoomManagerService } from './room-manager.service';
import { RealtimeChannelService } from '../services/realtime-channel.service';
import { SyncManagerService } from './sync-manager.service';
import { DialogService } from '../services/dialog.service';
import { BattlePhase } from '../enums/battle-phase.enum';

@Injectable({
  providedIn: 'root'
})
export class GameManagerService {
  private readonly gameStore = inject(GameStore);
  private readonly battleStore = inject(BattleStore);
  private readonly playerStore = inject(PlayerStore);
  private readonly router = inject(Router);
  private readonly logger = inject(LoggerService);
  private readonly roomManager = inject(RoomManagerService);
  private readonly realtime = inject(RealtimeChannelService);
  private readonly syncManager = inject(SyncManagerService);
  private readonly dialogService = inject(DialogService);

  private disconnectTimer: any = null;

  /**
   * Inicia una partida local contra la IA.
   * Con validación de carga para evitar race conditions.
   */
  public startSinglePlayerGame(): void {
    // VERIFICAR SI AÚN ESTÁ CARGANDO
    if (this.playerStore.isLoading()) {
      this.logger.log('[GameManager] PlayerStore todavía cargando, reintentando en 300ms...');
      setTimeout(() => this.startSinglePlayerGame(), 300);
      return;
    }

    this.logger.log('[GameManager] Iniciando partida local contra la IA...');
    this.gameStore.setAppState(MatchState.PLAYING);
    
    // Obtener mazo seleccionado
    const selectedDeckId = this.playerStore.selectedDeckId();
    const decks = this.playerStore.decks();
    const activeDeck = decks.find(d => d.id === selectedDeckId) || null;
    
    // LOG DE DEBUG PARA TRACKEAR EL MAZO
    if (activeDeck) {
      this.logger.log(`[GameManager] Mazo seleccionado: ${activeDeck.name} (${activeDeck.cards.length} cartas)`);
    } else {
      this.logger.error('[GameManager] ERROR: No se pudo obtener mazo seleccionado');
      this.logger.log(`[GameManager] Debug info - selectedDeckId: ${selectedDeckId}, decks count: ${decks.length}`);
      if (decks.length > 0) {
        this.logger.log(`[GameManager] Primer mazo disponible: ${decks[0].name} (${decks[0].cards.length} cartas)`);
      }
    }
    
    const profileId = this.playerStore.profile()?.id || 'player-user';

    this.battleStore.initializeBattle(
      activeDeck,
      this.playerStore.connectionMode(),
      this.playerStore.isSynced(),
      this.playerStore.isLoading(),
      profileId
    );

    // Initialize the Room for Anti-desync Architecture (Phase 5)
    this.roomManager.initializeLocalRoom(profileId, 'player-ai');
    
    // Redirigir al tablero de batalla independiente
    this.router.navigate(['/battle/ia']);
  }

  /**
   * Entra en la cola de matchmaking para multijugador online.
   * Con validación de carga para evitar race conditions.
   */
  public enterMatchmaking(): void {
    if (this.playerStore.isLoading()) {
      this.logger.log('[GameManager] PlayerStore todavía cargando, reintentando en 300ms...');
      setTimeout(() => this.enterMatchmaking(), 300);
      return;
    }

    const selectedDeckId = this.playerStore.selectedDeckId();
    const decks = this.playerStore.decks();
    const activeDeck = decks.find(d => d.id === selectedDeckId) || null;
    const profileId = this.playerStore.profile()?.id || 'player-user';

    console.log(`%c[ONLINE_FLOW] enterMatchmaking() — profileId=${profileId} deck=${activeDeck?.name}`, 'color:#00b4d8;font-weight:bold');
    this.logger.log('[GameManager] Entrando a la cola de matchmaking online...');
    this.gameStore.setAppState(MatchState.MATCHMAKING);

    // FIX CRÍTICO: Usar initializeOnlineBattle (sincrono) en lugar de initializeBattle (async PokéAPI)
    // initializeBattle tarda 1-3 segundos y setupMultiplayerMatch se ejecutaba antes de que terminara
    this.battleStore.initializeOnlineBattle(activeDeck, profileId);

    const battleReady = this.battleStore.battleState();
    if (!battleReady) {
      console.error('[ONLINE_FLOW] ERROR: initializeOnlineBattle retornó sin estado. ¿Mazo inválido?');
      this.dialogService.error('Selecciona un mazo válido antes de buscar partida.');
      this.gameStore.setAppState(MatchState.MENU);
      return;
    }

    console.log(`[ONLINE_FLOW] Battle inicializado correctamente. Suscribiendo a matchmaking...`);

    let hasNavigated = false;

    this.realtime.subscribeMatchmaking(profileId, async (roomId, opponentId, isHost) => {
      if (hasNavigated) return;
      hasNavigated = true;

      console.log(`%c[ONLINE_FLOW] 🎮 Match iniciado — Sala=${roomId} Rival=${opponentId} Host=${isHost}`, 'color:#2ec4b6;font-weight:bold;font-size:14px');
      this.logger.log(`[GameManager] ¡Match Encontrado! Sala: ${roomId}. Rival: ${opponentId}. Host: ${isHost}`);

      this.gameStore.setAppState(MatchState.PLAYING);
      const firstPlayerId = isHost ? profileId : opponentId;
      this.roomManager.initializeLocalRoom(profileId, opponentId, firstPlayerId, roomId);

      // setupMultiplayerMatch ahora siempre encuentra un battleState válido (ya no hay race condition)
      this.battleStore.setupMultiplayerMatch(opponentId, 'Rival Online', firstPlayerId);
      console.log(`[ONLINE_FLOW] setupMultiplayerMatch OK — oponent=${opponentId} firstPlayer=${firstPlayerId}`);

      console.log(`[ONLINE_FLOW] Suscribiendo a game-events (sala=${roomId})...`);
      try {
        await this.realtime.subscribeGameEvents(
          roomId,
          profileId,
          (payload) => { this.syncManager.processIncomingAction(payload); },
          (isPresent) => { this.handleRivalPresence(isPresent, profileId); }
        );

        console.log(`[ONLINE_FLOW] Navegando a /battle/online...`);
        this.router.navigate(['/battle/online']);
      } catch (err) {
        console.error('[ONLINE_FLOW] Fallo al suscribirse a la sala:', err);
        this.dialogService.error('Error al conectar con la sala. Intenta de nuevo.');
        this.exitToMenu();
      }
    }, () => {
      this.logger.log('[GameManager] Matchmaking cancelado por Timeout (30s)');
      this.dialogService.warning('No se encontraron oponentes en línea. Intenta de nuevo más tarde.');
      this.exitToMenu();
    });
  }

  /**
   * Abandona la partida actual y regresa al menú de inicio.
   */
  public exitToMenu(): void {
    this.logger.log('[GameManager] Regresando al menú principal...');
    
    // FASE 8: Cleanup Enterprise
    this.realtime.unsubscribeMatchmaking();
    const currentRoom = this.roomManager.currentRoom();
    if (currentRoom) {
      this.realtime.unsubscribeGameEvents(currentRoom.id);
    }
    
    this.gameStore.setAppState(MatchState.MENU);
    this.gameStore.setActiveMatch(null);
    this.battleStore.setBattleState(null);
    this.roomManager.exitRoom();
    this.syncManager.reset();
    
    this.router.navigate(['/dashboard']);
  }

  /**
   * Maneja la desconexión / reconexión del rival (FASE 8)
   */
  private handleRivalPresence(isPresent: boolean, myId: string): void {
    if (isPresent) {
      const battle = this.battleStore.battleState();
      
      // Barrier Sync: Si estábamos esperando que llegue a la sala (CONNECTING), enviamos nuestro mazo.
      // La partida comenzará (PLAYER_TURN) cuando recibamos el mazo del rival en SyncManagerService.
      if (battle && battle.phase === BattlePhase.CONNECTING) {
        console.log(`%c[BARRIER_SYNC] ✅ Ambos en sala. Enviando SYNC_DECK...`, 'color:#ffb703;font-weight:bold');
        console.log(`[GAME_ROOM] Barrier Sync completado`);
        this.logger.log('[GameManager] Barrier Sync completado. Enviando SYNC_DECK al oponente...');

        this.realtime.unsubscribeMatchmaking();

        // Enviar nuestro estado real (mazo, mano, vidas) al rival
        const myData = {
          deck: battle.player1.deck,
          hand: battle.player1.hand,
          field: battle.player1.field,
          lives: battle.player1.lives,
          energy: battle.player1.energy
        };
        console.log(`[SYNC_DECK] Enviando snapshot de mazo:`, {
          hand: myData.hand.length,
          deck: myData.deck.length,
          field: myData.field.filter(Boolean).length
        });
        console.log(`[GAME_ROOM] intentando enviar SYNC_DECK`);
        this.syncManager.dispatchAction('SYNC_DECK', myData, this.playerStore.profile()?.id);
      }
      
      if (this.disconnectTimer) {
        clearTimeout(this.disconnectTimer);
        this.disconnectTimer = null;
        console.log(`[PRESENCE] Rival recuperado correctamente. Grace period cancelado.`);
        this.dialogService.success('El rival se ha reconectado. La batalla continúa.');
      }
    } else {
      // Si el rival nunca llegó (aún estamos en CONNECTING)
      const battle = this.battleStore.battleState();
      if (battle && battle.phase === BattlePhase.CONNECTING) {
        if (!this.disconnectTimer) {
          this.dialogService.info('Esperando a que el rival cargue la partida... (15s)');
          this.disconnectTimer = setTimeout(() => {
            this.logger.log('[GameManager] Timeout: El rival nunca entró a la arena.');
            this.dialogService.warning('El rival no pudo conectarse a la arena.');
            this.exitToMenu();
            this.disconnectTimer = null;
          }, 15000);
        }
        return; // Salir aquí para no disparar Winner by Disconnect todavía, solo volver al menú.
      }

      // Si ya empezó la partida y se desconecta
      if (!this.disconnectTimer) {
        console.log(`[PRESENCE] Rival desconectado. Grace period iniciado... (60s)`);
        this.dialogService.warning('El rival se ha desconectado. Esperando reconexión... (60s)');
        this.disconnectTimer = setTimeout(() => {
          this.logger.log('[GameManager] Timeout de reconexión expirado (60s). Winner by Disconnect.');
          const b = this.battleStore.battleState();
          if (b && b.phase !== BattlePhase.GAME_OVER) {
            this.battleStore.setBattleState({
              ...b,
              phase: BattlePhase.GAME_OVER, 
              winnerId: myId
            });
            this.dialogService.success('VICTORIA POR DESCONEXIÓN DEL RIVAL');
          }
          this.disconnectTimer = null;
        }, 60000);
      }
    }
  }
}