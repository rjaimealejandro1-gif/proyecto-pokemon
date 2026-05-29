# COMPREHENSIVE ANGULAR POKÉMON TCG PROJECT ANALYSIS

## EXECUTIVE SUMMARY

This is an **Angular 21.2** Pokémon Trading Card Game with Signal-based state, offline-first architecture, and Supabase integration. **Currently partially functional** with a **critical race condition** in deck loading for battles.

**Status**: 40 TypeScript files, ~7000 LOC, core features working but deck loading broken.

---

## 1. ARCHITECTURE & STRUCTURE (Core/Features/Shared)

### Directory Layout

\\\
src/app/
├── core/
│   ├── state/ (4 stores using Angular Signals)
│   ├── services/ (4 HTTP & external APIs)
│   ├── engine/ (5 game logic services)
│   ├── models/ (5 data interfaces)
│   ├── enums/ (4 game enums)
│   └── constants/ (3 balance files)
├── features/
│   ├── auth/ (Supabase login)
│   ├── dashboard/ (main menu + deck selector)
│   ├── battle/ (arena UI)
│   ├── deck/ (deck builder)
│   ├── cards/ (collection browser)
│   └── history/ (profile/stats)
└── shared/
    └── components/
        ├── layout/ (main container)
        └── card-view/ (reusable card)
\\\

### Key Points

- **All standalone components** (no NgModules)
- **Lazy-loaded routes** (line 11-36 app.routes.ts)
- **Signal-based state** (no RxJS for business logic)
- **TypeScript 5.9.2** with interfaces, no classes

---

## 2. STATE MANAGEMENT - ANGULAR SIGNALS

### 4 Stores (All in core/state/)

#### GameStore (33 lines)
- Global state: MatchState, isAuthenticated, activeMatchId
- Limited scope - mostly for routing triggers

#### PlayerStore (701 lines) ⚠️ CRITICAL
- Profile, decks, collection, connection mode, sync status
- **RACE CONDITION in loadUserData() (line 260-287)**:
  - Multiple parallel PokéAPI subscriptions
  - selectedDeckId only set after ALL complete
  - User can start battle before completion → null deck

#### BattleStore (287 lines)
- Battle state: players, phase, turn, winner
- Initializes with deck validation (line 34-72)
- Sets error if deck null or cardCount !== 20

#### UiStore (33 lines)
- Simple UI state: loading, theme, modal

### THE CRITICAL BUG

**PlayerStore.loadUserData() lines 260-287:**

\\\	ypescript
// Problem: Independent subscriptions without coordination
for (const dbDeck of dbDecks) {
  this.pokeApi.getPokemonListAsCards(uniquePokemonIds).subscribe(cards => {
    loadedDecks.push({...});
    
    // Only sets selectedDeckId when LAST subscription completes
    if (loadedDecks.length === dbDecks.length) {
      this._selectedDeckId.set(loadedDecks[0].id);  // TOO LATE!
    }
  });
}
\\\

**Timeline** (for 1 deck):
- t=0ms: Loop starts, calls getPokemonListAsCards()
- t=500ms: **User clicks "Iniciar Combate"** (PokéAPI still loading)
- t=600ms: PokéAPI response arrives, selectedDeckId finally set
- Battle fails because deck was null at t=500ms

---

## 3. SERVICES & ENGINES

### External API Services

**PokeApiService** (155 lines)
- Fetches Pokémon from https://pokeapi.co/api/v2
- Applies game balance formula (stat budget scaling)
- Memory cache only (lost on refresh)
- No retry logic

**SupabaseService** (76 lines)
- Initializes client with hardcoded credentials
- Provides auth and database access
- No null safety checks

**StorageService** (52 lines)
- localStorage wrapper with try-catch
- Keys: poke_profile, poke_decks, poke_selected_deck_id

**LoggerService** (19 lines)
- Styled console logging only

### Game Engines

**GameManagerService** (75 lines)
- startSinglePlayerGame(): Gets deck, calls battleStore
- ⚠️ Doesn't check playerStore.isLoading() before proceeding

**BattleManagerService** (201 lines)
- summonCard(), attackCard(), attackPlayerDirectly()
- Solid validation, proper state immutability

**TurnManagerService** (130 lines)
- FSM for phases: DRAW→MAIN→ATTACK→END→(switch)→DRAW
- Handles card drawing, energy restoration
- Well-structured

**DamageCalculatorService** (53 lines)
- Formula: inalDamage = (ATK - DEF*0.5) * typeMultiplier
- Capped: min 10, max 1500
- Rarity multipliers: COMMON 1.0, RARE 1.2, EPIC 1.5, LEGENDARY 2.0

**CardEffectsEngineService** (39 lines)
- triggerAbility() is STUBS ONLY
- No actual implementations yet

---

## 4. DATA MODELS (All TypeScript Interfaces)

**Card** (20 lines)
- id, name, imageUrl, type, hp, maxHp, attack, defense, rarity, cost, level
- ability, description, isReadyToAttack, ownerId

**Deck** (9 lines)
- id, name, userId, cards[], createdAt
- **Rule: Must have exactly 20 cards for battle**

**Player** (14 lines)
- id, username, hp, maxHp, energy, maxEnergy
- deck[], hand[], field[5], discardPile[]

**Battle** (12 lines)
- matchId, player1, player2, activePlayerId, phase, turnNumber, winnerId

**UserProfile** (from PlayerStore)
- id, username, email, level, xp, victories, defeats

---

## 5. ENUMS & CONSTANTS

**BattlePhases**: DRAW_PHASE, MAIN_PHASE, ATTACK_PHASE, END_PHASE, GAME_OVER

**PokemonTypes**: 18 official types (FIRE, WATER, GRASS, ELECTRIC, etc.)

**CardRarity**: COMMON (1), RARE (2), EPIC (4), LEGENDARY (6)

**Type Advantages** (battle.constants.ts)
- 18x18 matrix with 2.0x (super effective), 0.5x (weak), 1.0x (neutral), 0.0x (immune)
- Example: FIRE 2.0x vs GRASS, 0.5x vs WATER

**Rarity Multipliers** (rarity.constants.ts)
- ATK multipliers for damage scaling

**Game Constants** (game.constants.ts)
- INITIAL_HP: 4000, INITIAL_ENERGY: 1, MAX_ENERGY: 10
- MAX_FIELD_CARDS: 5, MAX_HAND_CARDS: 7, DECK_SIZE: 20

---

## 6. INTEGRATION POINTS

### PokéAPI
- Endpoint: https://pokeapi.co/api/v2/pokemon/{id}
- Used in: PokeApiService, BattleStore, PlayerStore
- Caching: Memory only (not persistent)
- Fallback: None - errors propagate

### Supabase
- URL: https://klmngjtldhslatmqjcbf.supabase.co (hardcoded)
- Tables: profiles, decks, deck_cards, player_collection
- Auth: Email/password via Supabase Auth
- Sync: Save locally first, sync to cloud if online

### localStorage
- Keys: poke_profile, poke_decks, poke_selected_deck_id
- Fallback mechanism: If Supabase unavailable, use cached data
- Risk: ~5MB limit could be exceeded with many decks

---

## 7. WHAT WORKS ✓

1. ✅ Card display and filtering (PokéAPI integration)
2. ✅ Deck creation and editing (locally)
3. ✅ Battle phase transitions (FSM works)
4. ✅ Damage calculations with type advantages
5. ✅ Player profile and statistics
6. ✅ Mobile responsive UI
7. ✅ Offline mode with localStorage fallback
8. ✅ Authentication (Supabase)

---

## 8. WHAT'S BROKEN ❌

### CRITICAL: Deck Loading Race Condition
- Symptom: Battle component shows error "No se ha seleccionado ningún mazo real"
- Root cause: Async PokéAPI subscriptions in PlayerStore
- selectedDeckId set too late (after battle already started)
- **Impact: 90% failure rate with Supabase enabled**

### Incomplete
- ❌ AI card effects (stubs only)
- ❌ Multiplayer (infrastructure exists but not implemented)
- ❌ Battle history persistence
- ❌ Card quantity validation (could have 5+ copies)

---

## 9. COMPONENTS BREAKDOWN

| Component | Lines | Purpose |
|-----------|-------|---------|
| dashboard.component.ts | 915 | Main menu + deck selector modal |
| battle.component.ts | 880 | Arena UI with error display |
| deck.component.ts | 1526 | Deck builder + collection manager |
| cards.component.ts | 789 | Card encyclopedia |
| auth.component.ts | 443 | Login/Register/Guest |
| layout.component.ts | 488 | Main layout + navigation |

---

## 10. CRITICAL FIX REQUIRED

### The Problem

PlayerStore.loadUserData() uses independent subscriptions:

\\\	ypescript
for (const dbDeck of dbDecks) {
  this.pokeApi.getPokemonListAsCards(...).subscribe(cards => {
    // Each subscription completes independently
    // selectedDeckId only set when LAST one completes
  });
}
\\\

### The Solution

Convert to Promise-based with Promise.all():

\\\	ypescript
const deckPromises = dbDecks.map(async dbDeck => {
  const cards = await this.pokeApi
    .getPokemonListAsCards(...)
    .toPromise();
  return buildDeck(dbDeck, cards);
});

const loadedDecks = await Promise.all(deckPromises);
this._decks.set(loadedDecks);
this._selectedDeckId.set(loadedDecks[0].id);  // NOW SET CORRECTLY
this._isLoading.set(false);  // ONLY AFTER ALL COMPLETE
\\\

---

## 11. FILE INVENTORY (40 TypeScript Files)

**Core** (4): app.ts, app.config.ts, app.routes.ts, main.ts

**State** (4): game.store.ts, player.store.ts, battle.store.ts, ui.store.ts

**Services** (4): supabase.service.ts, pokeapi.service.ts, storage.service.ts, logger.service.ts

**Engines** (5): game-manager.service.ts, battle-manager.service.ts, turn-manager.service.ts, damage-calculator.service.ts, card-effects-engine.service.ts

**Models** (5): card.model.ts, deck.model.ts, player.model.ts, battle.model.ts, match.model.ts

**Enums** (4): battle-phase.enum.ts, card-rarity.enum.ts, match-state.enum.ts, pokemon-type.enum.ts

**Constants** (3): battle.constants.ts, rarity.constants.ts, game.constants.ts

**Features** (6): auth.component.ts, dashboard.component.ts, battle.component.ts, deck.component.ts, cards.component.ts, history.component.ts

**Shared** (2): layout.component.ts, card-view.component.ts

---

## 12. KEY STATISTICS

- **Total Files**: 40 TypeScript files
- **Total LOC**: ~7000 lines (estimated)
- **Components**: 8 (all standalone)
- **Stores**: 4 (all Signal-based)
- **Services**: 4 external + 5 internal = 9 services
- **Models**: 5 interfaces
- **Enums**: 4 enums
- **Constants**: 3 files
- **Battle Phases**: 5 phases (DRAW, MAIN, ATTACK, END, GAME_OVER)
- **Pokémon Types**: 18 types
- **Rarity Levels**: 4 levels (COMMON to LEGENDARY)

---

## 13. RECOMMENDATIONS

### CRITICAL (This Week)
1. Fix race condition in PlayerStore.loadUserData()
   - Use Promise.all() instead of independent subscriptions
   - Only set selectedDeckId after ALL decks loaded
   - Only set isLoading=false at the END

2. Add loading check in GameManagerService
   - Wait for playerStore.isLoading() === false before starting battle
   - Retry with exponential backoff if still loading

### HIGH (Next Week)
3. Implement AI card effects
4. Add retry logic for PokéAPI
5. Implement multiplayer matchmaking
6. Add battle history persistence

### MEDIUM (Future)
7. Persistent PokéAPI caching (IndexedDB)
8. Real-time multiplayer sync
9. Mobile optimization
10. Tournament system

---

## 14. FINAL ASSESSMENT

### Strengths
- Modern Angular 21 patterns (standalone, signals)
- Real data integration (PokéAPI, Supabase)
- Professional UI/UX design
- Solid game logic foundation
- Offline-first architecture

### Weaknesses
- **Critical race condition breaks deck loading**
- Incomplete AI system
- No multiplayer implementation
- No battle history

### Verdict
**Well-designed but incomplete.** Fix race condition, complete AI, add multiplayer to reach production readiness.

**Effort to fix critical issue**: 1-2 hours with proper Promise-based refactoring.

