import { Injectable, inject } from '@angular/core';
import { LoggerService } from '../services/logger.service';
import { RoomManagerService } from './room-manager.service';
import { RealtimeChannelService } from '../services/realtime-channel.service';
import { OnlineActionPayload, OnlineActionType } from '../models/battle-room.model';
import { PlayerStore } from '../state/player.store';
import { BattleStore } from '../state/battle.store';
import { Injector } from '@angular/core';
import { DialogService } from '../services/dialog.service';

@Injectable({
  providedIn: 'root'
})
export class SyncManagerService {
  private readonly logger = inject(LoggerService);
  private readonly roomManager = inject(RoomManagerService);
  private readonly realtime = inject(RealtimeChannelService);
  private readonly playerStore = inject(PlayerStore);
  private readonly injector = inject(Injector);
  private readonly battleStore = inject(BattleStore);
  private readonly dialogService = inject(DialogService);
  
  // Anti-desync: Keep track of processed action IDs to prevent duplicates
  private processedActions = new Set<string>();

  /**
   * Limpia el registro de acciones procesadas para evitar memory leaks entre partidas.
   */
  public reset(): void {
    this.processedActions.clear();
  }

  /**
   * Valida si el jugador activo tiene permitido realizar una acción en este momento.
   * ESTADO AUTORITATIVO
   */
  public canPerformAction(playerIdToCheck?: string): boolean {
    const room = this.roomManager.currentRoom();
    if (!room) return true; // Si no hay sala, es juego local no-sincronizado y pasamos libre
    
    const userId = playerIdToCheck || this.playerStore.profile()?.id || 'player-user'; 
    if (room.activePlayerId !== userId && userId !== 'player-ai') {
      this.logger.warn(`[Anti-Desync] Acción denegada: No es el turno del jugador ${userId}. Turno actual: ${room.activePlayerId}`);
      return false;
    }
    
    return true;
  }

  /**
   * Registra y envía un evento al bus de realtime y previene desync
   */
  public dispatchAction(type: OnlineActionType, data: any, forcePlayerId?: string): boolean {
    if (!this.canPerformAction(forcePlayerId)) return false;
    
    const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const userId = forcePlayerId || this.playerStore.profile()?.id || 'player-user';
    
    const payload: OnlineActionPayload = {
      actionId,
      type,
      playerId: userId,
      timestamp: Date.now(),
      data
    };
    
    this.logger.log(`[SyncManager] Enviando acción online autoritativa: ${type} [${actionId}]`);
    this.processedActions.add(actionId);
    
    // Broadcast a Supabase si estamos en una sala online
    const room = this.roomManager.currentRoom();
    if (room && room.rivalId !== 'player-ai') {
      this.realtime.broadcastGameEvent(room.id, payload).catch(console.error);
    }
    
    return true;
  }

  /**
   * Genera un hash determinista del estado de batalla para prevenir desyncs.
   */
  public generateStateHash(): string {
    const battle = this.battleStore.battleState();
    if (!battle) return '';
    // Simplificado: Hashing de HP y Vidas
    const p1Hp = battle.player1.field.reduce((sum: number, c: any) => sum + (c?.hp || 0), 0);
    const p2Hp = battle.player2.field.reduce((sum: number, c: any) => sum + (c?.hp || 0), 0);
    const data = `${battle.player1.lives}-${p1Hp}|${battle.player2.lives}-${p2Hp}|${battle.turnNumber}`;
    // Simple string hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit int
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Procesa una acción entrante desde Supabase Realtime (Fase 7.3)
   */
  public async processIncomingAction(payload: any): Promise<void> {
    const action = payload as OnlineActionPayload;
    if (!action || !action.actionId || !action.type) return;

    // Si ya la procesamos (ej. fue re-enviada o somos el emisor)
    if (this.processedActions.has(action.actionId)) return;
    
    const myId = this.playerStore.profile()?.id;
    if (action.playerId === myId) return; // Ignorar nuestras propias acciones que vuelven por broadcast

    this.logger.log(`[SyncManager] Acción remota recibida: ${action.type} [${action.actionId}] de ${action.playerId}`);
    this.processedActions.add(action.actionId);

    // Dynamic import to avoid circular dependency
    const { BattleManagerService } = await import('./battle-manager.service');
    const { TurnManagerService } = await import('./turn-manager.service');
    
    const battleManager = this.injector.get(BattleManagerService);
    const turnManager = this.injector.get(TurnManagerService);

    const isRemote = true;

    try {
      switch (action.type) {
        case 'PLAY_CARD':
          battleManager.summonCard(action.data.cardId, action.data.slotIndex, action.playerId, isRemote);
          break;
        case 'ATTACK':
          if (action.data.target === 'PLAYER') {
            battleManager.attackPlayerDirectly(action.data.attackerCardId, action.playerId, isRemote);
          } else {
            battleManager.attackCard(action.data.attackerCardId, action.data.targetCardId, action.playerId, isRemote);
          }
          break;
        case 'END_TURN':
          turnManager.endTurn(action.playerId, isRemote);
          
          // Anti-Desync: Verificar Hash
          if (action.data && action.data.stateHash) {
            const localHash = this.generateStateHash();
            if (localHash !== action.data.stateHash) {
              this.logger.error(`[Anti-Desync FATAL] ¡Desincronización detectada! Local: ${localHash}, Remoto: ${action.data.stateHash}`);
              // Emitimos solicitud de Full State Sync
              this.dispatchAction('REQUEST_STATE_SYNC', {}, this.playerStore.profile()?.id);
            } else {
              this.logger.log(`[Anti-Desync] Sincronización perfecta verificada (Hash: ${localHash})`);
            }
          }
          break;
        case 'REQUEST_STATE_SYNC':
          // Si somos el Host, mandamos el estado completo
          const currentRoom = this.roomManager.currentRoom();
          if (currentRoom && currentRoom.ownerId === myId) {
            this.logger.warn(`[Anti-Desync] Generando Full State Snapshot para el cliente desincronizado...`);
            const snapshot = this.battleStore.battleState();
            this.dispatchAction('FULL_STATE_SYNC', { snapshot }, myId);
          }
          break;
        case 'FULL_STATE_SYNC':
          // Recibimos el estado autoritativo y sobreescribimos
          if (action.data && action.data.snapshot) {
            this.logger.warn(`[Anti-Desync] Aplicando Full State Snapshot del Host...`);
            this.battleStore.setBattleState(action.data.snapshot);
            this.dialogService.success('Partida resincronizada con éxito.');
          }
          break;
        case 'SYNC_DECK':
          // Recibimos el estado inicial real del oponente
          const battleState = this.battleStore.battleState();
          if (battleState && action.data) {
            const opponentCards = action.data.hand || [];
            // Forzamos que las cartas recibidas le pertenezcan al jugador 2 localmente
            opponentCards.forEach((c: any) => c.ownerId = action.playerId);
            const opponentDeck = action.data.deck || [];
            opponentDeck.forEach((c: any) => c.ownerId = action.playerId);
            const opponentField = action.data.field || [null, null, null, null, null];
            opponentField.forEach((c: any) => { if(c) c.ownerId = action.playerId; });

            const updatedBattle = {
              ...battleState,
              player2: {
                ...battleState.player2,
                hand: opponentCards,
                deck: opponentDeck,
                field: opponentField,
                lives: action.data.lives ?? battleState.player2.lives,
                energy: action.data.energy ?? battleState.player2.energy
              }
            };
            
            // Si estábamos en CONNECTING, significa que completamos el Handshake y la sincronización de mazos
            if (updatedBattle.phase === 'CONNECTING') {
              updatedBattle.phase = 'PLAYER_TURN' as any;
              updatedBattle.turnNumber = 1;
              this.battleStore.setBattleState(updatedBattle);
              this.logger.log(`[SyncManager] SYNC_DECK exitoso. Comenzando la partida.`);
              this.dialogService.success('Mazos sincronizados. ¡Comienza el duelo!');
              
              // Disparar los efectos iniciales de turno si somos el jugador activo
              if (updatedBattle.activePlayerId === myId) {
                turnManager.startNewTurn(myId);
              }
            } else {
              this.battleStore.setBattleState(updatedBattle);
            }
          }
          break;
        default:
          this.logger.warn(`[SyncManager] Acción desconocida recibida: ${action.type}`);
      }
    } catch (err) {
      this.logger.error(`[SyncManager] Error ejecutando acción remota:`, err);
    }
  }
}
