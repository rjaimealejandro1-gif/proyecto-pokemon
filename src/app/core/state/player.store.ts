// PlayerStore — Estado enterprise del jugador con sincronización híbrida Supabase + localStorage
import { Injectable, signal, computed, inject } from '@angular/core';
import { Deck } from '../models/deck.model';
import { Card } from '../models/card.model';
import { SupabaseService } from '../services/supabase.service';
import { StorageService } from '../services/storage.service';
import { PokeApiService } from '../services/pokeapi.service';
import { SyncLoggerService } from '../services/sync-logger.service';
import { SyncQueueService } from '../services/sync-queue.service';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  level: number;
  xp: number;
  victories: number;
  defeats: number;
}

@Injectable({
  providedIn: 'root'
})
export class PlayerStore {
  private readonly supabase = inject(SupabaseService);
  private readonly storage = inject(StorageService);
  private readonly pokeApi = inject(PokeApiService);
  private readonly syncLogger = inject(SyncLoggerService);
  private readonly syncQueue = inject(SyncQueueService);

  // Lista base inicial de Pokémon para nuevos usuarios o juego sin internet
  private readonly starterPokemonIds = [1, 4, 7, 25, 133, 3, 6, 9, 94, 150, 143, 39, 149, 151];

  // Estado Privado (Signals)
  private readonly _profile = signal<UserProfile | null>(null);
  private readonly _decks = signal<Deck[]>([]);
  private readonly _selectedDeckId = signal<string | null>(null);
  private readonly _collection = signal<Card[]>([]);
  private readonly _connectionMode = signal<'online' | 'local'>('local');
  private readonly _isSynced = signal<boolean>(false);
  private readonly _isLoading = signal<boolean>(true);

  // Public Signals
  public readonly profile = computed(() => this._profile());
  public readonly decks = computed(() => this._decks());
  public readonly selectedDeckId = computed(() => this._selectedDeckId());
  public readonly collection = computed(() => this._collection());
  public readonly connectionMode = computed(() => this._connectionMode());
  public readonly isSynced = computed(() => this._isSynced());
  public readonly isLoading = computed(() => this._isLoading());

  // Expone los eventos de sync del logger (para el panel de telemetría en UI)
  public readonly syncEvents = computed(() => this.syncLogger.recentEvents());
  public readonly avgSupabaseLatency = computed(() => this.syncLogger.avgSupabaseLatency());
  public readonly avgPokeApiLatency = computed(() => this.syncLogger.avgPokeApiLatency());

  // Expone el estado de la cola de sync offline
  public readonly isOnline        = computed(() => this.syncQueue.isOnline());
  public readonly pendingOpsCount = computed(() => this.syncQueue.pendingCount());
  public readonly hasPendingOps   = computed(() => this.syncQueue.hasPending());

  public readonly winRate = computed(() => {
    const p = this._profile();
    if (!p) return 0;
    const total = p.victories + p.defeats;
    return total === 0 ? 0 : Math.round((p.victories / total) * 100);
  });

  constructor() {
    this.logDebug('[PlayerStore] Instancia creada');
    this.initializeLocalState();
    this.loadUserData();
    // Registrar ejecutores en la cola de sync (patrón enterprise: los stores registran sus propias ops)
    this._registerSyncExecutors();
  }

  private isValidUUID(uuid: string): boolean {
    if (!uuid) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback standard RFC4122 v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Carga inmediatamente el caché local para evitar parpadeos visuales (Offline-First).
   */
  private initializeLocalState(): void {
    this.logDebug('[PlayerStore] Iniciando inicialización de estado local');
    const cachedProfile = this.storage.getItem<UserProfile>('poke_profile');
    if (cachedProfile) {
      this.logDebug('[PlayerStore] Perfil cargado desde localStorage', cachedProfile);
      this._profile.set(cachedProfile);
    } else {
      this.logDebug('[PlayerStore] Creando perfil por defecto');
      this._profile.set({
        id: 'local-user-id',
        username: 'MaestroPokemon',
        email: 'entrenador@pokemon.com',
        level: 1,
        xp: 0,
        victories: 0,
        defeats: 0
      });
    }

    let cachedDecks = this.storage.getItem<Deck[]>('poke_decks');
    let cachedSelectedDeck = this.storage.getItem<string>('poke_selected_deck_id');

    // Validar y sanitizar decks en caché
    let decksUpdated = false;
    if (cachedDecks && Array.isArray(cachedDecks)) {
      cachedDecks = cachedDecks.map(d => {
        if (!this.isValidUUID(d.id)) {
          const newId = this.generateUUID();
          if (cachedSelectedDeck === d.id) {
            cachedSelectedDeck = newId;
          }
          decksUpdated = true;
          return { ...d, id: newId };
        }
        return d;
      });

      if (decksUpdated) {
        this.storage.setItem('poke_decks', cachedDecks);
        if (cachedSelectedDeck) {
          this.storage.setItem('poke_selected_deck_id', cachedSelectedDeck);
        }
      }
    }

    if (cachedDecks) {
      this.logDebug('[PlayerStore] Decks cargados desde localStorage', cachedDecks);
      this._decks.set(cachedDecks);
    }

    if (cachedSelectedDeck) {
      this.logDebug('[PlayerStore] SelectedDeckId cargado desde localStorage', cachedSelectedDeck);
      this._selectedDeckId.set(cachedSelectedDeck);
    }
  }

  /**
   * Carga y sincroniza la información de Supabase si existe una sesión válida.
   * Si no, mantiene el flujo offline-first local con elegancia.
   */
  public async loadUserData(): Promise<void> {
    const startTime = performance.now();
    this.logDebug('[PlayerStore] Iniciando carga de datos de usuario');
    
    this._isLoading.set(true);
    
    try {
      const client = this.supabase.client;
      if (!client) {
        this.logDebug('[PlayerStore] Supabase no inicializado - usando fallback offline');
        this.fallbackOffline('Supabase no inicializado');
        return;
      }

      this.logDebug('[PlayerStore] Verificando autenticación de Supabase');
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) {
        this.logDebug('[PlayerStore] No hay sesión activa - usando fallback offline');
        this.fallbackOffline('Sin sesión activa en Supabase');
        return;
      }

      this.logDebug('[PlayerStore] Usuario autenticado', user);
      this._connectionMode.set('online');

      // 1. Obtener o crear Perfil de Supabase
      this.logDebug('[PlayerStore] Obteniendo/creando perfil de usuario');
      const { data: dbProfile, error: profileErr } = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      let currentProfile: UserProfile;

      if (profileErr || !dbProfile) {
        this.logDebug('[PlayerStore] Creando nuevo perfil en Supabase');
        const local = this._profile();
        const username = user.user_metadata?.['username'] || local?.username || 'Entrenador';
        const newProfile = {
          id: user.id,
          username,
          avatar: '',
          level: local?.level || 1,
          victories: local?.victories || 0,
          defeats: local?.defeats || 0
        };

        const { data: inserted, error: insErr } = await client
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();

        if (insErr) throw insErr;
        
        currentProfile = {
          id: inserted.id,
          username: inserted.username,
          email: user.email || '',
          level: inserted.level,
          xp: 0,
          victories: inserted.victories,
          defeats: inserted.defeats
        };
      } else {
        this.logDebug('[PlayerStore] Perfil existente encontrado en Supabase');
        currentProfile = {
          id: dbProfile.id,
          username: dbProfile.username,
          email: user.email || '',
          level: dbProfile.level,
          xp: 0,
          victories: dbProfile.victories,
          defeats: dbProfile.defeats
        };
      }

      this._profile.set(currentProfile);
      this.storage.setItem('poke_profile', currentProfile);
      this.logDebug('[PlayerStore] Perfil actualizado', currentProfile);

      // 2. Obtener colección del jugador
      this.logDebug('[PlayerStore] Obteniendo colección de cartas');
      const { data: dbCollection, error: collErr } = await client
        .from('player_collection')
        .select('*')
        .eq('user_id', user.id);

      let collectionPokemonIds: string[] = [];

      if (collErr || !dbCollection || dbCollection.length === 0) {
        this.logDebug('[PlayerStore] Colección vacía sembrando inicial');
        // Sembrar colección inicial en la base de datos
        const collectionRows = this.starterPokemonIds.map(pid => ({
          user_id: user.id,
          pokemon_id: `poke-${pid}`,
          rarity: pid > 140 ? 'LEGENDARY' : pid > 90 ? 'EPIC' : 'COMMON'
        }));

        await client.from('player_collection').insert(collectionRows);
        collectionPokemonIds = collectionRows.map(r => r.pokemon_id);
        this.logDebug('[PlayerStore] Colección sembrada', collectionRows);
      } else {
        collectionPokemonIds = dbCollection.map(r => r.pokemon_id);
        this.logDebug('[PlayerStore] Colección cargada desde Supabase', dbCollection);
      }

      // Consumir detalles completos de cartas en paralelo a través de PokeAPI
      this.logDebug('[PlayerStore] Cargando detalles de cartas desde PokéAPI', collectionPokemonIds);
      this.pokeApi.getPokemonListAsCards(collectionPokemonIds).subscribe({
        next: (cards) => {
          const loadTime = performance.now() - startTime;
          this.logDebug('[PlayerStore] Colección PokéAPI cargada', { count: cards.length, time: `${loadTime.toFixed(1)}ms` });
          this._collection.set(cards);
          this._isLoading.set(false);
          this._isSynced.set(true);
          this.logDebug('[PlayerStore] Estado de carga completado: isLoading=false, isSynced=true');
        },
        error: (err) => {
          const loadTime = performance.now() - startTime;
          this.logDebug('[PlayerStore] Error al cargar colección PokéAPI', { error: err, time: `${loadTime.toFixed(1)}ms` });
          console.error('Error al mapear colección PokéAPI', err);
          this._isLoading.set(false);
        }
      });

      // 3. Obtener mazos del jugador - SECCIÓN CRÍTICA CON RACE CONDITION
      this.logDebug('[PlayerStore] Obteniendo mazos del usuario');
      const { data: dbDecks, error: decksErr } = await client
        .from('decks')
        .select('*')
        .eq('user_id', user.id);

      if (!decksErr && dbDecks && dbDecks.length > 0) {
        this.logDebug('[PlayerStore] Mazos encontrados en Supabase', { count: dbDecks.length, decks: dbDecks });
        
        // CRÍTICO: ARREGLANDO RACE CONDITION - USANDO PROMISE.ALL() EN LUGAR DE SUBSCRIPTIONS
        this.logDebug('[PlayerStore] Iniciando carga paralela de mazos con PokéAPI');
        
        const deckPromises = dbDecks.map(async (dbDeck): Promise<Deck> => {
          this.logDebug('[PlayerStore] Procesando mazo individual', { deckId: dbDeck.id, deckName: dbDeck.name });
          
          const { data: dbCards, error: dcErr } = await client
            .from('deck_cards')
            .select('*')
            .eq('deck_id', dbDeck.id);

          if (!dcErr && dbCards && dbCards.length > 0) {
            const quantityMap = new Map<string, number>();
            dbCards.forEach(c => quantityMap.set(c.pokemon_id, c.quantity));
            
            const uniquePokemonIds = Array.from(quantityMap.keys());
            this.logDebug('[PlayerStore] IDs únicos de Pokémon en mazo', { deckId: dbDeck.id, pokemonIds: uniquePokemonIds, quantities: quantityMap });
            
            try {
              // CONVERTIR Observable TO Promise
              const cards = await this.pokeApi
                .getPokemonListAsCards(uniquePokemonIds)
                .toPromise();
              
              if (!cards) {
                this.logDebug('[PlayerStore] PokéAPI devolvió datos vacíos para mazo', { deckId: dbDeck.id });
                return {
                  id: dbDeck.id,
                  name: dbDeck.name,
                  userId: dbDeck.user_id,
                  cards: []
                };
              }

              const fullDeckCards: Card[] = [];
              cards.forEach(card => {
                const qty = quantityMap.get(card.id) || 1;
                for (let i = 0; i < qty; i++) {
                  fullDeckCards.push({ ...card });
                }
              });

              this.logDebug('[PlayerStore] Mazo procesado exitosamente', { 
                deckId: dbDeck.id, 
                cardCount: fullDeckCards.length,
                deckName: dbDeck.name
              });

              return {
                id: dbDeck.id,
                name: dbDeck.name,
                userId: dbDeck.user_id,
                cards: fullDeckCards,
                createdAt: dbDeck.created_at
              };
            } catch (pokeError: unknown) {
              this.logDebug('[PlayerStore] Error al procesar mazo con PokéAPI', { 
                deckId: dbDeck.id, 
                error: pokeError instanceof Error ? pokeError.message : String(pokeError) 
              });
              return {
                id: dbDeck.id,
                name: dbDeck.name,
                userId: dbDeck.user_id,
                cards: []
              };
            }
          } else {
            this.logDebug('[PlayerStore] Mazo vacío encontrado', { deckId: dbDeck.id });
            return {
              id: dbDeck.id,
              name: dbDeck.name,
              userId: dbDeck.user_id,
              cards: []
            };
          }
        });

        this.logDebug('[PlayerStore] Esperando a que todos los mazos se procesen...');
        const loadedDecks = await Promise.all(deckPromises);
        
        this.logDebug('[PlayerStore] Todos los mazos procesados', { 
          totalDecks: loadedDecks.length,
          decks: loadedDecks.map(d => ({ id: d.id, name: d.name, cardCount: d.cards.length }))
        });

        this._decks.set(loadedDecks);
        this.storage.setItem('poke_decks', loadedDecks);

        if (loadedDecks.length > 0 && !this._selectedDeckId()) {
          this._selectedDeckId.set(loadedDecks[0].id);
          this.storage.setItem('poke_selected_deck_id', loadedDecks[0].id);
          this.logDebug('[PlayerStore] SelectedDeckId establecido automáticamente', { 
            deckId: loadedDecks[0].id, 
            deckName: loadedDecks[0].name 
          });
        } else if (loadedDecks.length > 0) {
          this.logDebug('[PlayerStore] SelectedDeckId ya estaba establecido', { 
            currentId: this._selectedDeckId()
          });
        }
        
        const loadTime = performance.now() - startTime;
        this._isLoading.set(false);
        this._isSynced.set(true);
        this.logDebug('[PlayerStore] Carga de usuario completada exitosamente', { 
          totalTime: `${loadTime.toFixed(1)}ms`,
          isLoading: false,
          isSynced: true,
          deckCount: loadedDecks.length
        });
      } else {
        this.logDebug('[PlayerStore] No hay mazos en Supabase, verificando localStorage');
        const localDecks = this.storage.getItem<Deck[]>('poke_decks') || [];
        if (localDecks.length > 0) {
          this.logDebug('[PlayerStore] Sincronizando mazos locales a Supabase', { count: localDecks.length });
          for (const d of localDecks) {
            await this.uploadDeckToSupabase(user.id, d.id, d.name, d.cards);
          }
          this._decks.set(localDecks);
          this.logDebug('[PlayerStore] Mazos locales sincronizados y establecidos', { count: localDecks.length });
          
          if (!this._selectedDeckId() && localDecks.length > 0) {
            this._selectedDeckId.set(localDecks[0].id);
            this.storage.setItem('poke_selected_deck_id', localDecks[0].id);
          }
          
          this._isLoading.set(false);
          this._isSynced.set(true);
        } else {
          this.logDebug('[PlayerStore] Creando mazo inicial oficial');
          const defaultDeckId = this.generateUUID();
          this.pokeApi.getPokemonListAsCards([25, 1, 4, 7, 133]).subscribe({
            next: async (cards) => {
              const starterDeckCards: Card[] = [];
              for (let i = 0; i < 4; i++) {
                cards.forEach(c => starterDeckCards.push({ ...c }));
              }

              const starterDeck: Deck = {
                id: defaultDeckId,
                name: 'Mazo Eléctrico Inicial',
                userId: user.id,
                cards: starterDeckCards
              };

              await this.uploadDeckToSupabase(user.id, defaultDeckId, starterDeck.name, starterDeckCards);
              this._decks.set([starterDeck]);
              this._selectedDeckId.set(defaultDeckId);
              this.storage.setItem('poke_decks', [starterDeck]);
              this.storage.setItem('poke_selected_deck_id', defaultDeckId);
              const loadTime = performance.now() - startTime;
              this._isLoading.set(false);
              this._isSynced.set(true);
              this.logDebug('[PlayerStore] Mazo inicial creado y cargado', { 
                deckId: defaultDeckId,
                deckName: 'Mazo Eléctrico Inicial',
                cardCount: starterDeckCards.length,
                totalTime: `${loadTime.toFixed(1)}ms`
              });
            },
            error: (err) => {
              const loadTime = performance.now() - startTime;
              this.logDebug('[PlayerStore] Error al cargar mazo inicial oficial', { error: err, time: `${loadTime.toFixed(1)}ms` });
              this._isLoading.set(false);
            }
          });
        }
      }
    } catch (e) {
      const loadTime = performance.now() - startTime;
      this.logDebug('[PlayerStore] Error crítico durante carga de usuario', { 
        error: e instanceof Error ? e.message : String(e), 
        time: `${loadTime.toFixed(1)}ms` 
      });
      console.error('Error al inicializar sesión en la nube, operando en modo offline local:', e instanceof Error ? e.message : String(e));
      this.fallbackOffline('Fallo de red o conexión a base de datos');
    }
  }

  /**
   * Registra los ejecutores de operaciones en el SyncQueueService.
   * Se llama UNA vez desde el constructor. No afecta el flujo existente.
   */
  private _registerSyncExecutors(): void {
    // SAVE_DECK: persiste las cartas de un mazo en Supabase
    this.syncQueue.registerExecutor('SAVE_DECK', async (op) => {
      try {
        const { deckId, cards } = op.payload as { deckId: string; cards: { card_id: string; quantity: number }[] };
        const userId = this._profile()?.id;
        if (!userId) return false;
        const sb = this.supabase.client;
        await sb.from('deck_cards').delete().eq('deck_id', deckId);
        if (cards.length > 0) {
          await sb.from('deck_cards').insert(cards.map(c => ({ deck_id: deckId, card_id: c.card_id, quantity: c.quantity })));
        }
        return true;
      } catch { return false; }
    });

    // RENAME_DECK: actualiza nombre de mazo en Supabase
    this.syncQueue.registerExecutor('RENAME_DECK', async (op) => {
      try {
        const { deckId, name } = op.payload as { deckId: string; name: string };
        const { error } = await this.supabase.client.from('decks').update({ name }).eq('id', deckId);
        return !error;
      } catch { return false; }
    });

    // DELETE_DECK: elimina mazo en Supabase
    this.syncQueue.registerExecutor('DELETE_DECK', async (op) => {
      try {
        const { deckId } = op.payload as { deckId: string };
        const sb = this.supabase.client;
        await sb.from('deck_cards').delete().eq('deck_id', deckId);
        const { error } = await sb.from('decks').delete().eq('id', deckId);
        return !error;
      } catch { return false; }
    });

    // CREATE_DECK: crea un nuevo mazo en Supabase
    this.syncQueue.registerExecutor('CREATE_DECK', async (op) => {
      try {
        const { deckId, name, userId } = op.payload as { deckId: string; name: string; userId: string };
        const { error } = await this.supabase.client.from('decks').insert({ id: deckId, name, user_id: userId });
        return !error;
      } catch { return false; }
    });
  }

  private logDebug(message: string, data?: any): void {
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
    if (data) {
      console.log(`[%cPlayerStore${timestamp}%c] ${message}`, 'color: #ff4336; font-weight: bold;', 'color: reset;', data);
    } else {
      console.log(`[%cPlayerStore${timestamp}%c] ${message}`, 'color: #ff4336; font-weight: bold;', 'color: reset;');
    }
  }

  /**
   * Cae en cascada hacia almacenamiento offline (localStorage) si Supabase no está disponible.
   */
  private fallbackOffline(reason: string): void {
    this.logDebug('[PlayerStore] Entrando en modo offline', { reason });
    this._connectionMode.set('local');
    this._isSynced.set(false);

    // Cargar colección inicial de PokeAPI localmente
    this.pokeApi.getPokemonListAsCards(this.starterPokemonIds).subscribe({
      next: (cards) => {
        this.logDebug('[PlayerStore] Colección PokéAPI cargada en modo offline', { count: cards.length });
        this._collection.set(cards);
        this._isLoading.set(false);
      },
      error: () => this._isLoading.set(false)
    });

    const localDecks = this.storage.getItem<Deck[]>('poke_decks');
    if (!localDecks || localDecks.length === 0) {
      // Crear mazo local por defecto
      const defaultDeckId = this.generateUUID();
      this.pokeApi.getPokemonListAsCards([25, 1, 4, 7, 133]).subscribe(cards => {
        const starterDeckCards: Card[] = [];
        for (let i = 0; i < 4; i++) {
          cards.forEach(c => starterDeckCards.push({ ...c }));
        }

        const localDeck: Deck = {
          id: defaultDeckId,
          name: 'Mazo Inicial Local',
          userId: 'local-user-id',
          cards: starterDeckCards
        };

        this._decks.set([localDeck]);
        this._selectedDeckId.set(defaultDeckId);
        this.storage.setItem('poke_decks', [localDeck]);
        this.storage.setItem('poke_selected_deck_id', defaultDeckId);
        this.logDebug('[PlayerStore] Mazo local por defecto creado');
      });
    } else {
      this.logDebug('[PlayerStore] Mazos locales encontrados en modo offline', { count: localDecks.length });
      this._isLoading.set(false);
    }
  }

  /**
   * Guarda un mazo localmente en caché y opcionalmente en Supabase si está logueado.
   */
  public async saveDeck(deckId: string, name: string, cards: Card[]): Promise<boolean> {
    const prof = this._profile();
    if (!prof) {
      console.warn('[PlayerStore] Intento de guardar mazo sin perfil activo. Fallback a LocalStorage cancelado.');
      return false;
    }

    const current = this._decks();
    const existingIndex = current.findIndex(d => d.id === deckId);
    const updated: Deck = {
      id: deckId,
      name,
      userId: prof.id,
      cards
    };

    let updatedDecks: Deck[];
    if (existingIndex >= 0) {
      updatedDecks = [...current];
      updatedDecks[existingIndex] = updated;
    } else {
      updatedDecks = [...current, updated];
    }

    this._decks.set(updatedDecks);
    this.storage.setItem('poke_decks', updatedDecks);
    console.log(`[LocalStorage Sync] Mazo [${name}] (${cards.length} cartas) guardado en local.`);

    if (this._connectionMode() === 'online') {
      const startTime = performance.now();
      try {
        await this.uploadDeckToSupabase(prof.id, deckId, name, cards);
        const latency = performance.now() - startTime;
        console.log(`[Supabase Sync] Sincronización Exitosa de mazo [${name}]. Latencia de respuesta: ${latency.toFixed(1)}ms. Escrita en tablas: decks y deck_cards.`);
        this._isSynced.set(true);
        return true;
      } catch (err) {
        const latency = performance.now() - startTime;
        console.error(`[Supabase Sync Error] Falla al guardar mazo en la nube después de ${latency.toFixed(1)}ms. Error:`, err);
        console.warn('[Offline Fallback] Operando en Modo Offline Local Temporal. Cambios persistidos únicamente en LocalStorage.');
        this._isSynced.set(false);
        return false;
      }
    } else {
      console.log('[Offline Mode] Conexión local activa. Saltando sincronización con Supabase.');
    }
    return true;
  }

  /**
   * Sube los datos de un mazo de manera atómica a Supabase.
   */
  private async uploadDeckToSupabase(userId: string, deckId: string, name: string, cards: Card[]): Promise<void> {
    const client = this.supabase.client;
    if (!client) {
      throw new Error('Cliente de Supabase no disponible.');
    }

    // 1. Guardar o actualizar registro de mazo (Tabla: decks)
    const { error: deckErr } = await client.from('decks').upsert({
      id: deckId,
      user_id: userId,
      name: name
    });
    if (deckErr) throw deckErr;

    // 2. Limpiar cartas viejas del mazo (Tabla: deck_cards)
    const { error: delErr } = await client.from('deck_cards').delete().eq('deck_id', deckId);
    if (delErr) throw delErr;

    if (cards.length === 0) return;

    // 3. Contar cantidades para evitar duplicados y respetar restricciones PK
    const quantityMap = new Map<string, number>();
    cards.forEach(c => {
      quantityMap.set(c.id, (quantityMap.get(c.id) || 0) + 1);
    });

    const deckCardsRows = Array.from(quantityMap.entries()).map(([pokemonId, qty]) => ({
      deck_id: deckId,
      pokemon_id: pokemonId,
      quantity: Math.min(qty, 4) // El constraint limita la cantidad máxima a 4
    }));

    // 4. Insertar las cartas del mazo asociadas (Tabla: deck_cards)
    const { error: insErr } = await client.from('deck_cards').insert(deckCardsRows);
    if (insErr) throw insErr;
  }

  /**
   * Sincroniza forzosamente datos locales a la nube (Útil tras un login).
   */
  public async syncLocalDataToCloud(): Promise<void> {
    const prof = this._profile();
    if (!prof || this._connectionMode() !== 'online') return;

    try {
      const localDecks = this.storage.getItem<Deck[]>('poke_decks') || [];
      for (const d of localDecks) {
        await this.uploadDeckToSupabase(prof.id, d.id, d.name, d.cards);
      }
      
      // Sincronizar estadísticas
      const client = this.supabase.client;
      if (client) {
        await client.from('profiles').upsert({
          id: prof.id,
          username: prof.username,
          level: prof.level,
          victories: prof.victories,
          defeats: prof.defeats
        });
      }

      this._isSynced.set(true);
    } catch (e) {
      console.error('Error al inicializar sesión en la nube, operando en modo offline local:', e instanceof Error ? e.message : String(e));
      this.fallbackOffline('Fallo de red o conexión a base de datos');
    }
  }

  // Setters y Acciones del perfil

  public setProfile(profile: UserProfile | null): void {
    this._profile.set(profile);
    if (profile) {
      this.storage.setItem('poke_profile', profile);
    }
  }

  public updateXP(amount: number): void {
    this._profile.update(p => {
      if (!p) return null;
      let newXp = p.xp + amount;
      let newLevel = p.level;
      const xpNeeded = p.level * 1000;
      if (newXp >= xpNeeded) {
        newXp -= xpNeeded;
        newLevel += 1;
      }
      const updated = { ...p, xp: newXp, level: newLevel };
      this.storage.setItem('poke_profile', updated);
      this.syncProfileToCloud(updated);
      return updated;
    });
  }

  public registerWin(): void {
    this._profile.update(p => {
      if (!p) return null;
      const updated = { ...p, victories: p.victories + 1 };
      this.storage.setItem('poke_profile', updated);
      this.syncProfileToCloud(updated);
      return updated;
    });
  }

  public registerLoss(): void {
    this._profile.update(p => {
      if (!p) return null;
      const updated = { ...p, defeats: p.defeats + 1 };
      this.storage.setItem('poke_profile', updated);
      this.syncProfileToCloud(updated);
      return updated;
    });
  }

  private async syncProfileToCloud(profile: UserProfile): Promise<void> {
    if (this._connectionMode() === 'online') {
      const client = this.supabase.client;
      if (!client) return;
      try {
        await client.from('profiles').upsert({
          id: profile.id,
          username: profile.username,
          level: profile.level,
          victories: profile.victories,
          defeats: profile.defeats
        });
      } catch (err) {
        console.error('Error al sincronizar estadísticas del perfil', err);
        this._isSynced.set(false);
      }
    }
  }

  public setDecks(decks: Deck[]): void {
    this._decks.set(decks);
    this.storage.setItem('poke_decks', decks);
  }

  public selectDeck(deckId: string): void {
    this._selectedDeckId.set(deckId);
    this.storage.setItem('poke_selected_deck_id', deckId);
    this.logDebug('[PlayerStore] Mazo activo cambiado manualmente', { deckId });
  }

  /**
   * Crea una nueva baraja en blanco y la sincroniza con localStorage y Supabase.
   */
  public async createNewDeck(name: string): Promise<string> {
    const prof = this._profile();
    if (!prof) {
      throw new Error('[PlayerStore] No se puede crear un mazo sin un perfil activo.');
    }

    const newId = this.generateUUID();
    const newDeck: Deck = {
      id: newId,
      name,
      userId: prof.id,
      cards: []
    };

    const updatedDecks = [...this._decks(), newDeck];
    this._decks.set(updatedDecks);
    this.storage.setItem('poke_decks', updatedDecks);
    
    console.log(`[LocalStorage] Mazo nuevo [${name}] creado y guardado localmente.`);

    if (this._connectionMode() === 'online') {
      const startTime = performance.now();
      try {
        await this.uploadDeckToSupabase(prof.id, newId, name, []);
        const latency = performance.now() - startTime;
        console.log(`[Supabase Sync] Nuevo mazo registrado con éxito en tabla 'decks'. Latencia: ${latency.toFixed(1)}ms.`);
        this._isSynced.set(true);
      } catch (err) {
        const latency = performance.now() - startTime;
        console.error(`[Supabase Sync Error] No se pudo crear el mazo en la nube después de ${latency.toFixed(1)}ms:`, err);
        console.warn('[Offline Mode] Mazo conservado únicamente en LocalStorage local.');
        this._isSynced.set(false);
      }
    }

    return newId;
  }

  /**
   * Elimina un mazo de localStorage y Supabase. Evita eliminar si es el único mazo restante.
   */
  public async deleteDeck(deckId: string): Promise<boolean> {
    const current = this._decks();
    if (current.length <= 1) {
      console.warn('[PlayerStore] Acción bloqueada: No se puede eliminar el único mazo existente.');
      return false;
    }

    const updated = current.filter(d => d.id !== deckId);
    this._decks.set(updated);
    this.storage.setItem('poke_decks', updated);

    // Si borramos el seleccionado, mover al primero restante
    if (this._selectedDeckId() === deckId) {
      this._selectedDeckId.set(updated[0]?.id || null);
      this.storage.setItem('poke_selected_deck_id', updated[0]?.id || null);
      this.logDebug('[PlayerStore] Mazo seleccionado eliminado, seleccionado nuevo mazo', { newId: updated[0]?.id });
    }

    // Eliminar de Supabase si está en línea
    if (this._connectionMode() === 'online') {
      const startTime = performance.now();
      try {
        const client = this.supabase.client;
        if (client) {
          await client.from('deck_cards').delete().eq('deck_id', deckId);
          await client.from('decks').delete().eq('id', deckId);
          const latency = performance.now() - startTime;
          console.log(`[Supabase Sync] Mazo [${deckId}] eliminado de la nube. Latencia: ${latency.toFixed(1)}ms.`);
          this._isSynced.set(true);
       }
     } catch (e) {
       const loadTime = performance.now() - startTime;
       this.logDebug('[PlayerStore] Error crítico durante carga de usuario', { 
         error: e instanceof Error ? e.message : String(e), 
         time: `${loadTime.toFixed(1)}ms` 
       });
       console.error('Error al inicializar sesión en la nube, operando en modo offline local:', e instanceof Error ? e.message : String(e));
       this.fallbackOffline('Fallo de red o conexión a base de datos');
     }
    }

    return true;
  }

  /**
   * Limpia la sesión actual y reinicia el estado del jugador a valores por defecto.
   * Utilizado para el modo invitado o reinicio completo.
   */
  public logout(): void {
    this.logDebug('[PlayerStore] Cerrando sesión y reiniciando estado');
    
    // Limpiar localStorage
    this.storage.removeItem('poke_profile');
    this.storage.removeItem('poke_decks');
    this.storage.removeItem('poke_selected_deck_id');
    
    // Reiniciar signals a valores por defecto
    this._profile.set({
      id: 'guest-user-id',
      username: 'Visitante',
      email: 'invitado@pokemon.com',
      level: 1,
      xp: 0,
      victories: 0,
      defeats: 0
    });
    
    this._decks.set([]);
    this._selectedDeckId.set(null);
    this._collection.set([]);
    this._connectionMode.set('local');
    this._isSynced.set(false);
    this._isLoading.set(false);
    
    // Limpiar log de sincronización
    this.syncLogger.clearLog();
    
    // Notificar al usuario
    console.log('[PlayerStore] Sesión cerrada. Reiniciado a modo invitado.');
  }

  /**
   * Renombra un mazo existente localmente y sincroniza con Supabase si está online.
   * Preserva todas las cartas del mazo intactas.
   */
  public async renameDeck(deckId: string, newName: string): Promise<boolean> {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      console.warn('[PlayerStore] renameDeck: nombre vacío rechazado.');
      return false;
    }

    const current = this._decks();
    const deckIndex = current.findIndex(d => d.id === deckId);
    if (deckIndex < 0) {
      console.warn(`[PlayerStore] renameDeck: mazo [${deckId}] no encontrado.`);
      return false;
    }

    const updatedDeck = { ...current[deckIndex], name: trimmedName };
    const updatedDecks = [...current];
    updatedDecks[deckIndex] = updatedDeck;

    this._decks.set(updatedDecks);
    this.storage.setItem('poke_decks', updatedDecks);
    this.logDebug('[PlayerStore] Mazo renombrado localmente', { deckId, newName: trimmedName });
    this.syncLogger.log('DECK_RENAME', { detail: `[${trimmedName}]`, success: true });

    // Sincronizar con Supabase si está online
    if (this._connectionMode() === 'online') {
      const timer = this.syncLogger.startTimer();
      try {
        const client = this.supabase.client;
        if (client) {
          const { error } = await client
            .from('decks')
            .update({ name: trimmedName })
            .eq('id', deckId);

          if (error) throw error;

          const latencyMs = timer.elapsed();
          this.syncLogger.log('SUPABASE_UPSERT', {
            table: 'decks',
            latencyMs,
            detail: `rename → "${trimmedName}"`,
            success: true
          });
          this._isSynced.set(true);
        }
      } catch (err) {
        const latencyMs = timer.elapsed();
        const errMsg = err instanceof Error ? err.message : String(err);
        this.syncLogger.log('SYNC_FAIL', {
          table: 'decks',
          latencyMs,
          error: errMsg,
          success: false
        });
        this._isSynced.set(false);
        // No es crítico — el rename ya está guardado en localStorage
        console.warn('[PlayerStore] renameDeck: sync en nube falló, pero persiste localmente.', errMsg);
      }
    }

    return true;
  }
}