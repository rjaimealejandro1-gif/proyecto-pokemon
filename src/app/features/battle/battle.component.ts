import { Component, inject, signal, OnDestroy, OnInit, effect } from '@angular/core';
import { Subscription } from 'rxjs';
import { BattleStore } from '@core/state/battle.store';
import { PlayerStore } from '@core/state/player.store';
import { TurnManagerService } from '@core/engine/turn-manager.service';
import { GameManagerService } from '@core/engine/game-manager.service';
import { BattleManagerService } from '@core/engine/battle-manager.service';
import { CardViewComponent } from '@shared/components/card-view/card-view.component';
import { NgIf, NgFor } from '@angular/common';
import { Router } from '@angular/router';
import { DialogService } from '@core/services/dialog.service';

@Component({
  selector: 'app-battle',
  standalone: true,
  imports: [CardViewComponent, NgIf, NgFor],
  template: `
    <div class="battle-arena-fullscreen" [class.shake-screen]="screenShake()">
      <!-- Error Overlay -->
      <div *ngIf="battleStore.battleLoadError() as errorMsg" class="battle-overlay error-overlay">
        <div class="glass-panel">
          <h2>⚠️ ERROR DE MAZO</h2>
          <p>{{ errorMsg }}</p>
          <div class="actions">
            <button class="btn-secondary" (click)="gameManager.exitToMenu()">VOLVER AL MENÚ</button>
            <button class="btn-primary" (click)="goToConstructor()">IR AL CONSTRUCTOR</button>
          </div>
        </div>
      </div>

      <!-- Loader Overlay -->
      <div *ngIf="(!battleStore.battleState() && !battleStore.battleLoadError()) || battleStore.currentPhase() === 'CONNECTING'" class="battle-overlay loader-overlay">
        <div class="glass-panel spinner-panel">
          <div class="spinner"></div>
          <h2>{{ !battleStore.battleState() ? 'CARGANDO ARENA...' : 'ESPERANDO AL RIVAL...' }}</h2>
          <p>Sincronizando conexión cuántica...</p>
        </div>
      </div>

      <!-- Cinematic Game Over Overlay -->
      <div *ngIf="battleStore.currentPhase() === 'GAME_OVER'" class="battle-overlay game-over-cinematic">
        <h1 class="cinematic-text" [class.victory-text]="battleStore.winnerId() === battleStore.player1()?.id" [class.defeat-text]="battleStore.winnerId() !== battleStore.player1()?.id">
          {{ battleStore.winnerId() === battleStore.player1()?.id ? 'VICTORIA' : 'DERROTA' }}
        </h1>
      </div>

      <!-- Main Game Environment -->
      <ng-container *ngIf="battleStore.battleState() as battle">
        <div class="battle-environment" [class.hidden]="battle.phase === 'CONNECTING'">
          
          <!-- TOP HUD: Opponent -->
          <div class="hud top-hud" *ngIf="battleStore.player2() as opponent"
               [class.targetable-hud]="selectedAttackerId() !== null"
               (click)="onEnemyHudClick()">
            <div class="hud-profile">
              <div class="avatar">👤</div>
              <div class="info">
                <span class="name">{{ opponent.username }}</span>
                <div class="stats">
                  <span class="stat hp">❤️ {{ opponent.lives }}/{{ opponent.maxLives }}</span>
                  <span class="stat energy">💎 {{ opponent.energy }}/{{ opponent.maxEnergy }}</span>
                </div>
              </div>
            </div>
            
            <!-- Floating Text for Opponent Player -->
            <div class="floating-text-container" *ngIf="getFloatingDamagesFor(opponent.id) as dmgs">
              <div class="floating-dmg" *ngFor="let dmg of dmgs">-{{ dmg.amount }}</div>
            </div>

            <button class="btn-surrender" (click)="gameManager.exitToMenu()">RENDIRSE</button>
          </div>

          <!-- 3D BATTLE BOARD -->
          <div class="board-container">
            <div class="battle-board">
              
              <!-- Opponent Zone -->
              <div class="field-zone opponent-zone">
                <div class="slot opponent-slot" 
                     *ngFor="let slot of battle.player2.field; let i = index"
                     [class.occupied]="slot !== null"
                     [class.targetable]="selectedAttackerId() !== null"
                     (click)="onEnemySlotClick(i)">
                  <div class="slot-ground"></div>
                  <app-card-view *ngIf="slot" [card]="slot" class="board-card" [class.dying]="isDying(slot.id)"></app-card-view>
                  
                  <!-- Floating Text for Card -->
                  <div class="floating-text-container" *ngIf="slot && getFloatingDamagesFor(slot.id) as dmgs">
                    <div class="floating-dmg" *ngFor="let dmg of dmgs">-{{ dmg.amount }}</div>
                  </div>
                </div>
              </div>

              <!-- Divider / River -->
              <div class="board-divider">
                <div class="turn-indicator" [class.active-turn]="battle.activePlayerId === battle.player1.id">
                  <span class="turn-text">{{ battle.activePlayerId === battle.player1.id ? 'TU TURNO' : 'TURNO RIVAL' }}</span>
                </div>
              </div>

              <!-- Player Zone -->
              <div class="field-zone player-zone">
                <div class="slot player-slot" 
                     *ngFor="let slot of battle.player1.field; let i = index"
                     [class.occupied]="slot !== null"
                     [class.can-drop]="selectedCardInHand() !== null && slot === null"
                     [class.attacker-selected]="selectedAttackerId() !== null && slot !== null && selectedAttackerId() === slot.id"
                     (click)="onAlliedSlotClick(i)">
                  <div class="slot-ground"></div>
                  <app-card-view *ngIf="slot" [card]="slot" class="board-card" [class.dying]="isDying(slot.id)"></app-card-view>
                  
                  <!-- Floating Text for Card -->
                  <div class="floating-text-container" *ngIf="slot && getFloatingDamagesFor(slot.id) as dmgs">
                    <div class="floating-dmg" *ngFor="let dmg of dmgs">-{{ dmg.amount }}</div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>

          <!-- BOTTOM DOCK: Player HUD + Hand -->
          <div class="player-dock" *ngIf="battleStore.player1() as player">
            <div class="hud bottom-hud">
              <div class="hud-profile">
                <div class="avatar">👑</div>
                <div class="info">
                  <span class="name">Tú</span>
                  <div class="stats">
                    <span class="stat hp">❤️ {{ player.lives }}/{{ player.maxLives }}</span>
                    <span class="stat energy">💎 {{ player.energy }}/{{ player.maxEnergy }}</span>
                  </div>
                </div>
              </div>

              <!-- Floating Text for Active Player -->
              <div class="floating-text-container" *ngIf="getFloatingDamagesFor(player.id) as dmgs">
                <div class="floating-dmg" *ngFor="let dmg of dmgs">-{{ dmg.amount }}</div>
              </div>

              <button class="btn-end-turn" 
                      [disabled]="battle.activePlayerId !== battle.player1.id"
                      (click)="turnManager.endTurn()">
                TERMINAR TURNO
              </button>
            </div>

            <!-- Player Hand -->
            <div class="hand-container">
              <div class="hand-cards">
                <div class="hand-card-wrapper" 
                     *ngFor="let card of player.hand; let i = index"
                     [class.selected]="selectedCardInHand()?.id === card.id"
                     [style.--card-index]="i"
                     [style.--total-cards]="player.hand.length"
                     (click)="onCardInHandClick(card)">
                  <app-card-view [card]="card"></app-card-view>
                </div>
              </div>
            </div>
          </div>

        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .battle-arena-fullscreen {
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at center, #1a1a24 0%, #0a0a0f 100%);
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .hidden { display: none !important; }

    /* OVERLAYS */
    .battle-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(10px);
      z-index: 1000;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .glass-panel {
      background: rgba(30,30,40,0.7);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      color: white;
    }

    .glass-panel h2, .glass-panel h1 { margin-top: 0; color: #ffb703; }
    .glass-panel p { color: #aaa; margin-bottom: 24px; }
    
    .actions { display: flex; gap: 16px; justify-content: center; }
    button {
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary { background: #00b4d8; color: #000; }
    .btn-primary:hover { background: #0096c7; transform: scale(1.05); }
    .btn-secondary { background: #333; color: #fff; }
    .btn-secondary:hover { background: #444; }

    .game-over-cinematic {
      background: rgba(0,0,0,0) !important;
      animation: fade-darken 2.5s forwards ease-in;
      pointer-events: none;
    }
    @keyframes fade-darken {
      0% { background: rgba(0,0,0,0); backdrop-filter: blur(0px); }
      100% { background: rgba(0,0,0,0.95); backdrop-filter: blur(20px); }
    }
    .cinematic-text {
      font-size: 80px;
      font-weight: 900;
      letter-spacing: 10px;
      opacity: 0;
      animation: cinematic-zoom 2s forwards cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.5s;
    }
    .victory-text { color: #00b4d8; text-shadow: 0 0 40px rgba(0,180,216,0.8); }
    .defeat-text { color: #e63946; text-shadow: 0 0 40px rgba(230,57,70,0.8); }
    @keyframes cinematic-zoom {
      0% { transform: scale(0.5); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    .spinner {
      width: 50px; height: 50px;
      border: 4px solid rgba(255,255,255,0.1);
      border-top-color: #00b4d8;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* EFFECTS & ANIMATIONS */
    .shake-screen {
      animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
    }
    @keyframes shake {
      10%, 90% { transform: translate3d(-2px, 0, 0); }
      20%, 80% { transform: translate3d(4px, 0, 0); }
      30%, 50%, 70% { transform: translate3d(-8px, 0, 0); }
      40%, 60% { transform: translate3d(8px, 0, 0); }
    }

    .dying {
      animation: disintegrate 0.6s forwards !important;
      pointer-events: none;
    }
    @keyframes disintegrate {
      0% { transform: scale(1) translateZ(30px); filter: brightness(2) drop-shadow(0 0 20px #e63946); }
      50% { transform: scale(1.1) translateZ(40px) rotate(5deg); opacity: 0.8; filter: brightness(3) contrast(1.5) blur(2px); }
      100% { transform: scale(0) translateZ(0) rotate(-15deg); opacity: 0; filter: blur(10px); }
    }

    .floating-text-container {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .floating-dmg {
      font-size: 32px;
      font-weight: 900;
      color: #ff3333;
      text-shadow: 0 0 10px rgba(255,0,0,0.8), 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
      animation: float-up 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      margin-top: -10px;
    }
    @keyframes float-up {
      0% { transform: translateY(20px) scale(0); opacity: 0; }
      20% { transform: translateY(-10px) scale(1.5); opacity: 1; }
      80% { transform: translateY(-30px) scale(1); opacity: 1; }
      100% { transform: translateY(-50px) scale(0.8); opacity: 0; }
    }

    /* BATTLE ENVIRONMENT */
    .battle-environment {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      position: relative;
    }

    /* HUDS */
    .hud {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 32px;
      background: linear-gradient(180deg, rgba(0,0,0,0.8), transparent);
      z-index: 100;
    }
    .bottom-hud { background: linear-gradient(0deg, rgba(0,0,0,0.8), transparent); }

    .hud-profile { display: flex; align-items: center; gap: 16px; }
    .avatar { font-size: 32px; background: rgba(255,255,255,0.1); padding: 8px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); }
    .info { display: flex; flex-direction: column; gap: 4px; }
    .name { color: white; font-weight: bold; font-size: 18px; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
    .stats { display: flex; gap: 12px; }
    .stat { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; color: white; }
    .hp { background: rgba(230, 57, 70, 0.3); border: 1px solid #e63946; }
    .energy { background: rgba(0, 180, 216, 0.3); border: 1px solid #00b4d8; }

    .btn-surrender { background: rgba(230,57,70,0.2); color: #ffb7b7; border: 1px solid #e63946; }
    .btn-surrender:hover { background: rgba(230,57,70,0.4); }

    .btn-end-turn { background: #00b4d8; color: #000; font-size: 16px; padding: 12px 32px; box-shadow: 0 0 20px rgba(0,180,216,0.4); }
    .btn-end-turn:disabled { background: #333; color: #666; cursor: not-allowed; box-shadow: none; }
    .btn-end-turn:not(:disabled):hover { background: #00d4ff; transform: scale(1.05); }

    /* 3D BOARD CONTAINER */
    .board-container {
      flex: 1;
      perspective: 1200px;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: visible;
      padding: 0 5%;
    }

    .battle-board {
      width: 100%;
      max-width: 1000px;
      height: 600px;
      transform: rotateX(25deg) translateY(-20px);
      transform-style: preserve-3d;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }

    /* Brillo de fondo del tablero */
    .battle-board::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: radial-gradient(ellipse at center, rgba(0, 180, 216, 0.05) 0%, transparent 70%);
      transform: translateZ(-10px);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 20px;
      box-shadow: 0 0 50px rgba(0,0,0,0.5), inset 0 0 50px rgba(0,0,0,0.5);
    }

    .field-zone {
      display: flex;
      justify-content: center;
      gap: 2%;
      height: 40%;
      align-items: center;
      transform-style: preserve-3d;
    }

    .slot {
      width: 16%;
      aspect-ratio: 2.5/3.5;
      position: relative;
      transform-style: preserve-3d;
      transition: all 0.3s ease;
    }

    /* La base holográfica del slot */
    .slot-ground {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      border: 2px dashed rgba(255,255,255,0.2);
      border-radius: 8px;
      transform: translateZ(-1px);
      transition: all 0.3s ease;
      background: rgba(0,0,0,0.2);
    }

    .slot:not(.occupied) .slot-ground:hover {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.4);
    }

    .slot.occupied .slot-ground { display: none; }

    /* Interactive States for Slots */
    .slot.can-drop .slot-ground {
      border-color: #00b4d8;
      background: rgba(0, 180, 216, 0.1);
      box-shadow: 0 0 20px rgba(0, 180, 216, 0.3);
      animation: pulse-drop 1.5s infinite;
    }

    @keyframes pulse-drop {
      0% { box-shadow: 0 0 10px rgba(0, 180, 216, 0.2); }
      50% { box-shadow: 0 0 30px rgba(0, 180, 216, 0.6); }
      100% { box-shadow: 0 0 10px rgba(0, 180, 216, 0.2); }
    }

    .slot.targetable .slot-ground {
      display: block;
      border-color: #e63946;
      border-style: solid;
      background: rgba(230, 57, 70, 0.1);
      animation: pulse-target 1.5s infinite;
      cursor: crosshair;
    }

    .slot.targetable.occupied::before {
      content: '';
      position: absolute;
      top: -10px; left: -10px; right: -10px; bottom: -10px;
      border: 2px solid #e63946;
      border-radius: 12px;
      transform: translateZ(5px);
      animation: pulse-target 1s infinite;
      pointer-events: none;
    }

    @keyframes pulse-target {
      0% { border-color: rgba(230, 57, 70, 0.4); }
      50% { border-color: rgba(230, 57, 70, 1); }
      100% { border-color: rgba(230, 57, 70, 0.4); }
    }

    /* The actual card in the board */
    .board-card {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      transform: translateZ(2px);
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      cursor: pointer;
      animation: summon-card 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes summon-card {
      0% { transform: translateZ(200px) scale(0) rotateX(45deg); opacity: 0; filter: brightness(2) drop-shadow(0 0 50px #00b4d8); }
      100% { transform: translateZ(2px) scale(1) rotateX(0deg); opacity: 1; filter: none; }
    }

    .slot.occupied:hover .board-card {
      transform: translateZ(30px) scale(1.05) rotateX(-5deg);
      box-shadow: 0 20px 30px rgba(0,0,0,0.8);
    }

    .slot.attacker-selected .board-card {
      transform: translateZ(40px) scale(1.1) rotateX(-10deg);
      filter: drop-shadow(0 0 15px #00b4d8);
    }

    /* Board Divider */
    .board-divider {
      height: 10%;
      display: flex;
      justify-content: center;
      align-items: center;
      transform: translateZ(10px);
    }

    .turn-indicator {
      background: rgba(10,10,15,0.8);
      border: 1px solid rgba(255,255,255,0.1);
      padding: 8px 32px;
      border-radius: 20px;
      box-shadow: 0 10px 20px rgba(0,0,0,0.5);
      transition: all 0.3s;
    }

    .turn-indicator.active-turn {
      border-color: #00b4d8;
      box-shadow: 0 0 20px rgba(0, 180, 216, 0.4);
    }

    .turn-text {
      color: white;
      font-weight: 900;
      letter-spacing: 2px;
      font-size: 14px;
    }

    .active-turn .turn-text { color: #00d4ff; }

    /* PLAYER DOCK & HAND */
    .player-dock {
      position: relative;
      height: 220px;
      display: flex;
      flex-direction: column;
      z-index: 200;
    }

    .hand-container {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: flex-end;
      padding-bottom: 20px;
      pointer-events: none;
    }

    .hand-cards {
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      height: 180px;
      pointer-events: auto;
    }

    .hand-card-wrapper {
      width: 130px;
      height: 182px;
      position: absolute;
      transform-origin: bottom center;
      --offset: calc(var(--card-index) - (var(--total-cards) - 1) / 2);
      --angle: calc(var(--offset) * 4deg);
      --tx: calc(var(--offset) * 40px);
      --ty: calc(abs(var(--offset)) * 5px);
      
      transform: translateX(var(--tx)) translateY(var(--ty)) rotate(var(--angle));
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      cursor: pointer;
      box-shadow: -5px 0 15px rgba(0,0,0,0.5);
      border-radius: 8px;
    }

    .hand-card-wrapper:hover {
      transform: translateX(var(--tx)) translateY(-40px) rotate(0deg) scale(1.2);
      z-index: 100 !important;
      box-shadow: 0 20px 40px rgba(0,0,0,0.8);
    }

    .hand-card-wrapper.selected {
      transform: translateX(var(--tx)) translateY(-80px) rotate(0deg) scale(1.3);
      z-index: 200 !important;
      filter: drop-shadow(0 0 20px #00b4d8);
    }
    
    .targetable-hud { cursor: crosshair; }
    .targetable-hud .avatar { border-color: #e63946; box-shadow: 0 0 20px rgba(230, 57, 70, 0.5); }
  `]
})
export class BattleComponent implements OnInit, OnDestroy {
  public readonly battleStore = inject(BattleStore);
  public readonly turnManager = inject(TurnManagerService);
  public readonly gameManager = inject(GameManagerService);
  public readonly battleManager = inject(BattleManagerService);
  private readonly playerStore = inject(PlayerStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);

  // Estado local para la invocación
  protected readonly selectedCardInHand = signal<any | null>(null);
  protected readonly selectedAttackerId = signal<string | null>(null);

  // Animaciones y Efectos
  protected readonly floatingDamages = signal<{id: string, targetId: string, amount: number}[]>([]);
  protected readonly dyingCards = signal<Set<string>>(new Set());
  protected readonly screenShake = signal<boolean>(false);
  private eventSub!: Subscription;

  constructor() {
    if (!this.battleStore.battleState()) {
      const selectedDeckId = this.playerStore.selectedDeckId();
      const decks = this.playerStore.decks();
      const activeDeck = decks.find(d => d.id === selectedDeckId) || null;
      
      this.battleStore.initializeBattle(
        activeDeck,
        this.playerStore.connectionMode(),
        this.playerStore.isSynced(),
        this.playerStore.isLoading(),
        this.playerStore.profile()?.id
      );
    }

    // Effect for GAME_OVER transition
    effect(() => {
      if (this.battleStore.currentPhase() === 'GAME_OVER') {
        setTimeout(() => {
          this.router.navigate(['/result'], { replaceUrl: true });
        }, 2500);
      }
    });
  }

  ngOnInit(): void {
    // Suscribirse a eventos de combate visual
    this.eventSub = this.battleManager.onCombatEvent.subscribe(event => {
      if (event.type === 'DAMAGE' || event.type === 'ATTACK_DIRECT') {
        const dmgId = Math.random().toString();
        this.floatingDamages.update(prev => [...prev, { id: dmgId, targetId: event.targetId, amount: event.amount }]);
        
        // Efecto visual directo en pantalla si el ataque es a vidas
        if (event.type === 'ATTACK_DIRECT') {
          this.screenShake.set(true);
          setTimeout(() => this.screenShake.set(false), 400);
        }

        // Limpiar dmg después de animación (1.2s)
        setTimeout(() => {
          this.floatingDamages.update(prev => prev.filter(f => f.id !== dmgId));
        }, 1200);
      }

      if (event.type === 'DESTROY') {
        // Añadir a lista de dying para disparar animación
        this.dyingCards.update(set => {
          const newSet = new Set(set);
          newSet.add(event.targetId);
          return newSet;
        });
        
        // Quitar después de la animación de destrucción (0.6s)
        setTimeout(() => {
          this.dyingCards.update(set => {
            const newSet = new Set(set);
            newSet.delete(event.targetId);
            return newSet;
          });
        }, 600);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.eventSub) this.eventSub.unsubscribe();
    // Si el componente se destruye (ej: navegación atrás), forzar cleanup
    this.gameManager.exitToMenu();
  }

  // --- Funciones para Template ---
  public getFloatingDamagesFor(targetId: string) {
    const list = this.floatingDamages().filter(d => d.targetId === targetId);
    return list.length > 0 ? list : null;
  }

  public isDying(cardId: string): boolean {
    return this.dyingCards().has(cardId);
  }

  public goToConstructor(): void {
    this.router.navigate(['/deck']);
  }

  // --- Selección de Acciones en Combate ---
  public onCardInHandClick(card: any): void {
    const battle = this.battleStore.battleState();
    if (!battle) return;

    // Solo puede interactuar en su turno
    if (battle.activePlayerId !== battle.player1.id || battle.phase !== 'PLAYER_TURN') {
      return;
    }

    this.selectedAttackerId.set(null);

    // Toggle de selección
    if (this.selectedCardInHand()?.id === card.id) {
      this.selectedCardInHand.set(null);
    } else {
      this.selectedCardInHand.set(card);
    }
  }

  public onAlliedSlotClick(slotIndex: number): void {
    const battle = this.battleStore.battleState();
    if (!battle || battle.activePlayerId !== battle.player1.id || battle.phase !== 'PLAYER_TURN') return;

    const selectedCard = this.selectedCardInHand();
    const slotCard = battle.player1.field[slotIndex];

    if (selectedCard && !slotCard) {
      // Invocación
      const success = this.battleManager.summonCard(selectedCard.id, slotIndex);
      if (success) {
        this.selectedCardInHand.set(null);
      }
    } else if (!selectedCard && slotCard) {
      // Seleccionar para atacar
      if (!slotCard.isReadyToAttack) {
        this.dialog.warning(`La carta [${slotCard.name}] no puede atacar ahora.`);
        return; 
      }

      if (this.selectedAttackerId() === slotCard.id) {
        this.selectedAttackerId.set(null);
      } else {
        this.selectedAttackerId.set(slotCard.id);
      }
    }
  }

  public onEnemySlotClick(slotIndex: number): void {
    const battle = this.battleStore.battleState();
    if (!battle || battle.activePlayerId !== battle.player1.id || battle.phase !== 'PLAYER_TURN') return;

    const attackerId = this.selectedAttackerId();
    if (!attackerId) return;

    const targetCard = battle.player2.field[slotIndex];
    if (targetCard) {
      const success = this.battleManager.attackCard(attackerId, targetCard.id);
      if (success) {
        this.selectedAttackerId.set(null);
      }
    } else {
      // Si el slot está vacío, pero no hay cartas en todo el campo enemigo, ataca a la cara
      const hasOpponentCards = battle.player2.field.some(c => c !== null);
      if (!hasOpponentCards) {
        const success = this.battleManager.attackPlayerDirectly(attackerId);
        if (success) {
          this.selectedAttackerId.set(null);
        }
      } else {
        this.dialog.error('Debes destruir a los monstruos defensores primero.');
        this.selectedAttackerId.set(null);
      }
    }
  }

  public onEnemyHudClick(): void {
    const battle = this.battleStore.battleState();
    if (!battle || battle.activePlayerId !== battle.player1.id || battle.phase !== 'PLAYER_TURN') return;

    const attackerId = this.selectedAttackerId();
    if (!attackerId) return;

    const hasOpponentCards = battle.player2.field.some(c => c !== null);
    if (!hasOpponentCards) {
      const success = this.battleManager.attackPlayerDirectly(attackerId);
      if (success) {
        this.selectedAttackerId.set(null);
      }
    } else {
      this.dialog.error('Debes destruir a los monstruos defensores primero.');
      this.selectedAttackerId.set(null);
    }
  }
}
