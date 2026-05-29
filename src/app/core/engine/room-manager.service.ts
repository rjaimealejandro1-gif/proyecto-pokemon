import { Injectable, signal, inject } from '@angular/core';
import { BattleRoom } from '../models/battle-room.model';
import { LoggerService } from '../services/logger.service';
import { BattlePhase } from '../enums/battle-phase.enum';

@Injectable({
  providedIn: 'root'
})
export class RoomManagerService {
  private readonly logger = inject(LoggerService);
  
  // State for the current room
  public readonly currentRoom = signal<BattleRoom | null>(null);

  /**
   * Initializes a room, preparing for online matchmaking
   */
  public initializeLocalRoom(ownerId: string, rivalId: string, firstPlayerId?: string, explicitRoomId?: string): BattleRoom {
    this.logger.log(`[RoomManager] Inicializando Sala: Owner=${ownerId}, Rival=${rivalId}`);
    
    const startingPlayerId = firstPlayerId || ownerId;
    const roomId = explicitRoomId || `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (explicitRoomId) {
      console.log(`[GAME_ROOM] explicitRoomId recibido`);
      console.log(`[GAME_ROOM] initializeLocalRoom usando ID REAL: ${roomId}`);
    }

    const room: BattleRoom = {
      id: roomId,
      status: 'PLAYING',
      ownerId,
      rivalId,
      turnNumber: 1,
      phase: BattlePhase.PLAYER_TURN,
      activePlayerId: startingPlayerId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.currentRoom.set(room);
    return room;
  }

  public updateRoomState(updatedRoom: Partial<BattleRoom>): void {
    const current = this.currentRoom();
    if (!current) return;
    
    this.currentRoom.set({
      ...current,
      ...updatedRoom,
      updatedAt: Date.now()
    });
    
    this.logger.log(`[RoomManager] Estado de la sala actualizado: ${updatedRoom.phase || 'N/A'}`);
  }

  public exitRoom(): void {
    this.logger.log(`[RoomManager] Saliendo de la sala...`);
    this.currentRoom.set(null);
  }
}
