import { Injectable, signal, computed, inject } from '@angular/core';
import { Battle } from '../models/battle.model';
import { Card } from '../models/card.model';
import { Deck } from '../models/deck.model';
import { BattlePhase } from '../enums/battle-phase.enum';
import { CardRarity } from '../enums/card-rarity.enum';
import { PokemonType } from '../enums/pokemon-type.enum';
import { PokeApiService } from '../services/pokeapi.service';

@Injectable({
  providedIn: 'root'
})
export class BattleStore {
  // Estado Privado (Batalla Activa)
  private readonly _battle = signal<Battle | null>(null);
  private readonly _isAiGame = signal<boolean>(true);
  private readonly _battleLoadError = signal<string | null>(null);
  private readonly pokeApiService = inject(PokeApiService);

  // Signals de Solo Lectura Públicas
  public readonly battleState = computed(() => this._battle());
  public readonly isAiGame = computed(() => this._isAiGame());
  public readonly battleLoadError = computed(() => this._battleLoadError());

  // Shortcuts computed para simplificar vistas
  public readonly player1 = computed(() => this._battle()?.player1 ?? null);
  public readonly player2 = computed(() => this._battle()?.player2 ?? null);
  public readonly activePlayerId = computed(() => this._battle()?.activePlayerId ?? null);
  public readonly currentPhase = computed(() => this._battle()?.phase ?? BattlePhase.PLAYER_TURN);
  public readonly turnNumber = computed(() => this._battle()?.turnNumber ?? 0);
  public readonly winnerId = computed(() => this._battle()?.winnerId ?? null);

  // Inicializar Batalla Dinámica con mazo real del jugador
  public initializeBattle(
    deck: Deck | null,
    connectionMode: 'online' | 'local',
    isSynced: boolean,
    isStoreLoading: boolean,
    realPlayerId?: string
  ): void {
    this._battleLoadError.set(null);

    const deckName = deck ? deck.name : 'Ninguno';
    const cardCount = deck && deck.cards ? deck.cards.length : 0;
    const origin = connectionMode === 'online' ? 'Supabase Cloud' : 'LocalStorage';
    const isMockFallback = !deck || cardCount !== 20;

    console.group('%c🛡️ DETALLES DE CARGA DE MAZO PARA COMBATE 🛡️', 'color: #ffb703; font-weight: bold; font-size: 13px;');
    console.log(`%c* Mazo seleccionado: %c${deckName}`, 'color: #ffffff;', 'color: #ffd166; font-weight: bold;');
    console.log(`%c* Cantidad de cartas: %c${cardCount} / 20`, 'color: #ffffff;', cardCount === 20 ? 'color: #2ec4b6; font-weight: bold;' : 'color: #e63946; font-weight: bold;');
    console.log(`%c* Origen del Mazo: %c${origin}`, 'color: #ffffff;', 'color: #00b4d8; font-weight: bold;');
    console.log(`%c* Sincronización en la Nube: %c${isSynced ? 'RESPALDADO OK ✨' : 'SOLO LOCAL 💾'}`, 'color: #ffffff;', isSynced ? 'color: #2ec4b6;' : 'color: #ffb703;');
    console.log(`%c* Carga de PokéAPI en curso: %c${isStoreLoading ? 'SÍ ⏳' : 'NO ✅'}`, 'color: #ffffff;', isStoreLoading ? 'color: #ffb703;' : 'color: #2ec4b6;');
    console.log(`%c* Fallback a Mazo Mock: %c${isMockFallback ? 'SÍ ⚠️ (Mazo inválido o incompleto)' : 'NO ⚔️'}`, 'color: #ffffff;', isMockFallback ? 'color: #e63946; font-weight: bold;' : 'color: #2ec4b6; font-weight: bold;');
    console.groupEnd();

    if (isStoreLoading) {
      this._battle.set(null); // Mantener cargando
      return;
    }

    if (isMockFallback) {
      let errorMsg = '';
      if (!deck) {
        errorMsg = 'No se ha seleccionado ningún mazo real. La Liga Pokémon requiere una baraja válida.';
      } else if (cardCount === 0) {
        errorMsg = `El mazo [${deckName}] está completamente vacío. Por reglamento oficial, debes incluir exactamente 20 cartas.`;
      } else {
        errorMsg = `El mazo [${deckName}] está incompleto. Contiene ${cardCount} de las 20 cartas requeridas para competir.`;
      }
      this._battleLoadError.set(errorMsg);
      this._battle.set(null);
      return;
    }

    const playerCards = deck!.cards;
    this._battle.set(null); // Poner en null para activar la pantalla de carga

    // Generar cartas de IA (Gengar, Eevee, Mewtwo, Snorlax) de forma dinámica desde PokéAPI
    const p1Id = realPlayerId || 'player-user';
    const opponentIds = [94, 133, 150, 143];
    this.pokeApiService.getPokemonListAsCards(opponentIds).subscribe({
      next: (oppCards) => {
        const gengar = { ...oppCards.find(c => c.id === 'poke-94')! };
        const eevee = { ...oppCards.find(c => c.id === 'poke-133')! };
        const mewtwo = { ...oppCards.find(c => c.id === 'poke-150')! };
        const snorlax = { ...oppCards.find(c => c.id === 'poke-143')! };

        const opponentCards = [gengar, eevee, mewtwo, snorlax];
        opponentCards.forEach(c => {
          if (c) {
            c.ownerId = 'player-ai';
            c.isReadyToAttack = true;
          }
        });

        // Clonar y barajar cartas del jugador
        const shuffledPlayerCards = playerCards.map(c => ({ ...c }));
        // Mezcla simple Fisher-Yates
        for (let i = shuffledPlayerCards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledPlayerCards[i], shuffledPlayerCards[j]] = [shuffledPlayerCards[j], shuffledPlayerCards[i]];
        }

        // Asignar dueño a las cartas del jugador
        shuffledPlayerCards.forEach(c => {
          c.ownerId = p1Id;
          c.isReadyToAttack = true;
        });

        // Tomar 2 cartas para el campo inicial (si el mazo tiene suficientes cartas)
        const field1 = shuffledPlayerCards.slice(0, Math.min(2, shuffledPlayerCards.length));
        // Tomar 2 cartas para la mano inicial
        const hand1 = shuffledPlayerCards.slice(2, Math.min(4, shuffledPlayerCards.length));
        // El resto queda en el mazo
        const deck1 = shuffledPlayerCards.slice(4);

        // Desactivar ready state en mano y mazo
        hand1.forEach(c => c.isReadyToAttack = false);
        deck1.forEach(c => c.isReadyToAttack = false);

        // Oponente IA
        mewtwo.isReadyToAttack = false;
        snorlax.isReadyToAttack = false;

        const battle: Battle = {
          matchId: 'real-match-' + Math.random().toString(36).substr(2, 9),
          player1: {
            id: p1Id,
            username: 'Tú (Maestro)',
            lives: 5,
            maxLives: 5,
            energy: 6,
            maxEnergy: 6,
            deck: deck1,
            hand: hand1,
            field: [field1[0] || null, field1[1] || null, null, null, null],
            discardPile: []
          },
          player2: {
            id: 'player-ai',
            username: 'IA Entrenador (Rival)',
            lives: 5,
            maxLives: 5,
            energy: 4,
            maxEnergy: 6,
            deck: [],
            hand: [mewtwo, snorlax],
            field: [null, gengar, eevee, null, null],
            discardPile: []
          },
          activePlayerId: p1Id,
          phase: BattlePhase.PLAYER_TURN,
          turnNumber: 3,
          winnerId: null,
          matchStats: {
            totalTurns: 0,
            p1DamageDealt: 0,
            p2DamageDealt: 0,
            p1CardsDestroyed: 0,
            p2CardsDestroyed: 0,
            p1CardsPlayed: 0,
            p2CardsPlayed: 0,
            matchDurationMs: 0,
            startTime: Date.now()
          }
        };

        this._battle.set(battle);
        this._isAiGame.set(true);
      },
      error: (err) => {
        console.error('Error al inicializar batalla con cartas reales', err);
        this._battleLoadError.set('Error de red al obtener detalles de cartas de la PokéAPI.');
      }
    });
  }

  /**
   * Inicializa la batalla para modo ONLINE.
   * NO requiere PokéAPI. Solo prepara el tablero del jugador local
   * con sus cartas reales. El oponente se carga luego via SYNC_DECK.
   */
  public initializeOnlineBattle(deck: any, realPlayerId: string): void {
    this._battleLoadError.set(null);
    const p1Id = realPlayerId;
    const playerCards = [...(deck?.cards ?? [])];

    if (!playerCards.length) {
      this._battleLoadError.set('No se ha seleccionado ningún mazo válido para el modo Online.');
      return;
    }

    // Barajar cartas
    for (let i = playerCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerCards[i], playerCards[j]] = [playerCards[j], playerCards[i]];
    }
    playerCards.forEach((c: any) => {
      c.ownerId = p1Id;
      c.isReadyToAttack = false;
    });

    const field1 = playerCards.slice(0, 2);
    const hand1 = playerCards.slice(2, 5);
    const deck1 = playerCards.slice(5);
    field1.forEach((c: any) => c.isReadyToAttack = true);

    const battle: Battle = {
      matchId: 'online-' + Math.random().toString(36).substr(2, 9),
      player1: {
        id: p1Id,
        username: 'Tú (Maestro)',
        lives: 5,
        maxLives: 5,
        energy: 6,
        maxEnergy: 6,
        deck: deck1,
        hand: hand1,
        field: [field1[0] || null, field1[1] || null, null, null, null],
        discardPile: []
      },
      // player2 vacío — se rellena con SYNC_DECK
      player2: {
        id: 'opponent-pending',
        username: 'Buscando rival...',
        lives: 5,
        maxLives: 5,
        energy: 6,
        maxEnergy: 6,
        deck: [],
        hand: [],
        field: [null, null, null, null, null],
        discardPile: []
      },
      activePlayerId: p1Id, // se sobreescribe en setupMultiplayerMatch
      phase: BattlePhase.CONNECTING,
      turnNumber: 0,
      winnerId: null,
      matchStats: {
        totalTurns: 0,
        p1DamageDealt: 0,
        p2DamageDealt: 0,
        p1CardsDestroyed: 0,
        p2CardsDestroyed: 0,
        p1CardsPlayed: 0,
        p2CardsPlayed: 0,
        matchDurationMs: 0,
        startTime: Date.now()
      }
    };

    this._battle.set(battle);
    this._isAiGame.set(false);
    console.log(`%c[ONLINE_FLOW] initializeOnlineBattle() OK — Player1=${p1Id} hand=${hand1.length} deck=${deck1.length}`, 'color:#2ec4b6;font-weight:bold');
  }

  public setupMultiplayerMatch(opponentId: string, opponentUsername: string, firstPlayerId: string): void {
    const battle = this._battle();
    if (!battle) return;

    this._battle.set({
      ...battle,
      player2: {
        ...battle.player2,
        id: opponentId,
        username: opponentUsername,
        deck: [],
        hand: [],
        field: [null, null, null, null, null],
        discardPile: []
      },
      activePlayerId: firstPlayerId,
      phase: BattlePhase.CONNECTING,
      turnNumber: 0
    });
    
    this._isAiGame.set(false);
  }

  // Inicializar Batalla MOCK (Para la Fase 1)
  public initializeMockBattle(realPlayerId?: string): void {
    const p1Id = realPlayerId || 'player-user';
    // Definimos IDs para el jugador y el rival de forma dinámica desde PokéAPI
    const userIds = [6, 25, 9, 3]; // Charizard, Pikachu, Blastoise, Venusaur
    const opponentIds = [94, 133, 150, 143]; // Gengar, Eevee, Mewtwo, Snorlax

    const allIds = [...userIds, ...opponentIds];

    this._battle.set(null); // Poner en null para activar la pantalla de carga

    this.pokeApiService.getPokemonListAsCards(allIds).subscribe({
      next: (cards) => {
        // Encontrar cartas por ID numérico en base a su modelo mapeado
        const charizard = cards.find(c => c.id === 'poke-6')!;
        const pikachu = cards.find(c => c.id === 'poke-25')!;
        const blastoise = cards.find(c => c.id === 'poke-9')!;
        const venusaur = cards.find(c => c.id === 'poke-3')!;

        const gengar = cards.find(c => c.id === 'poke-94')!;
        const eevee = cards.find(c => c.id === 'poke-133')!;
        const mewtwo = cards.find(c => c.id === 'poke-150')!;
        const snorlax = cards.find(c => c.id === 'poke-143')!;

        // Asignamos dueños y flags de batalla
        const userCards = [charizard, pikachu, blastoise, venusaur];
        const opponentCards = [gengar, eevee, mewtwo, snorlax];

        userCards.forEach(c => {
          if (c) {
            c.ownerId = p1Id;
            c.isReadyToAttack = true;
          }
        });
        opponentCards.forEach(c => {
          if (c) {
            c.ownerId = 'player-ai';
            c.isReadyToAttack = true;
          }
        });

        // Aseguramos que Blastoise y Venusaur no tengan turno listo para atacar todavía
        blastoise.isReadyToAttack = false;
        venusaur.isReadyToAttack = false;

        const mockBattle: Battle = {
          matchId: 'real-match-' + Math.random().toString(36).substr(2, 9),
          player1: {
            id: p1Id,
            username: 'Tú (Maestro)',
            lives: 5,
            maxLives: 5,
            energy: 6,
            maxEnergy: 6,
            deck: [],
            hand: [blastoise, venusaur], // Blastoise y Venusaur en mano
            field: [charizard, pikachu, null, null, null], // Charizard y Pikachu en campo
            discardPile: []
          },
          player2: {
            id: 'player-ai',
            username: 'IA Entrenador (Rival)',
            lives: 5,
            maxLives: 5,
            energy: 4,
            maxEnergy: 6,
            deck: [],
            hand: [mewtwo, snorlax],
            field: [null, gengar, eevee, null, null], // Gengar y Eevee en campo
            discardPile: []
          },
          activePlayerId: p1Id,
          phase: BattlePhase.PLAYER_TURN,
          turnNumber: 3,
          winnerId: null,
          matchStats: {
            totalTurns: 0,
            p1DamageDealt: 0,
            p2DamageDealt: 0,
            p1CardsDestroyed: 0,
            p2CardsDestroyed: 0,
            p1CardsPlayed: 0,
            p2CardsPlayed: 0,
            matchDurationMs: 0,
            startTime: Date.now()
          }
        };

        this._battle.set(mockBattle);
        this._isAiGame.set(true);
      },
      error: (err) => {
        console.error('Error loading cards for active battle from PokeAPI', err);
      }
    });
  }

  // Acciones (Stubs para la Fase 1)
  public setBattleState(battle: Battle | null): void {
    this._battle.set(battle);
  }

  public setAiGame(isAi: boolean): void {
    this._isAiGame.set(isAi);
  }

  public updatePlayerLives(playerId: string, lives: number): void {
    this._battle.update(b => {
      if (!b) return null;
      if (b.player1.id === playerId) {
        return { ...b, player1: { ...b.player1, lives: Math.max(0, lives) } };
      } else if (b.player2.id === playerId) {
        return { ...b, player2: { ...b.player2, lives: Math.max(0, lives) } };
      }
      return b;
    });
  }

  public updatePlayerEnergy(playerId: string, energy: number): void {
    this._battle.update(b => {
      if (!b) return null;
      if (b.player1.id === playerId) {
        return { ...b, player1: { ...b.player1, energy } };
      } else if (b.player2.id === playerId) {
        return { ...b, player2: { ...b.player2, energy } };
      }
      return b;
    });
  }

  public setPhase(phase: BattlePhase): void {
    this._battle.update(b => b ? { ...b, phase } : null);
  }
}
