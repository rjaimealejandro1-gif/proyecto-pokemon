import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, forkJoin } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '@environments/environment';
import { Card } from '../models/card.model';
import { PokemonType } from '../enums/pokemon-type.enum';
import { CardRarity } from '../enums/card-rarity.enum';
import { LoggerService } from './logger.service';
import { SqliteService } from './sqlite.service';

@Injectable({
  providedIn: 'root'
})
export class PokeApiService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly sqlite = inject(SqliteService);
  private readonly baseUrl = environment.pokeApiUrl;

  // Caché en memoria ultrarrápida
  private memoryCache = new Map<string, Card>();

  /**
   * Obtiene una lista de Pokémon por sus IDs o nombres y los transforma a modelos de cartas en paralelo.
   */
  public getPokemonListAsCards(idsOrNames: (string | number)[]): Observable<Card[]> {
    if (idsOrNames.length === 0) {
      return of([]);
    }
    const requests = idsOrNames.map(id => this.getPokemonAsCard(id));
    return forkJoin(requests);
  }

  /**
   * Obtiene la información de un Pokémon por su nombre o ID y la transforma a modelo de carta.
   */
  public getPokemonAsCard(nameOrId: string | number): Observable<Card> {
    let key = nameOrId.toString().toLowerCase();
    if (key.startsWith('poke-')) {
      key = key.replace('poke-', '');
    }

    // 1. Comprobar caché en memoria
    if (this.memoryCache.has(key)) {
      this.logger.log(`PokeAPI: Retornando carta caché en memoria para: ${key}`);
      return of(this.memoryCache.get(key)!);
    }

    // 2. Comprobar caché en SQLite (Offline persistente)
    try {
      const rows = this.sqlite.query(`SELECT json_data FROM pokemon_cache WHERE id = ?`, [key]);
      if (rows.length > 0) {
        const cachedCard = JSON.parse(rows[0].json_data) as Card;
        this.memoryCache.set(key, cachedCard);
        this.logger.log(`PokeAPI: Retornando carta desde SQLite local cache para: ${key}`);
        return of(cachedCard);
      }
    } catch (e) {
      this.logger.error(`PokeAPI: Error consultando SQLite para ${key}`, e);
    }

    // 3. Fetch de la API Real
    return this.http.get<any>(`${this.baseUrl}/pokemon/${key}`).pipe(
      map(data => this.transformToCard(data)),
      tap(card => {
        // Cachear en memoria
        this.memoryCache.set(key, card);
        
        // Persistir en SQLite real
        try {
          this.sqlite.execute(
            `INSERT INTO pokemon_cache (id, json_data, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json_data = excluded.json_data`,
            [key, JSON.stringify(card), Date.now()]
          );
        } catch (e) {
          this.logger.error(`PokeAPI: Error persistiendo en SQLite para ${key}`, e);
        }
        
        this.logger.log(`PokeAPI: Carta obtenida de internet y cacheada localmente para: ${card.name}`);
      }),
      catchError(error => {
        this.logger.error(`PokeAPI: Error al obtener Pokémon [${nameOrId}]`, error);
        return throwError(() => new Error('Error al consumir PokéAPI. Verifica tu conexión a internet.'));
      })
    );
  }

  /**
   * Transforma los datos de PokéAPI en el modelo Card aplicando un balanceo matemático estricto.
   */
  private transformToCard(apiData: any): Card {
    const name = apiData.name.charAt(0).toUpperCase() + apiData.name.slice(1);
    
    // Obtener tipo principal
    const rawType = apiData.types[0]?.type?.name?.toUpperCase() ?? 'NORMAL';
    const type = Object.values(PokemonType).includes(rawType as PokemonType)
      ? (rawType as PokemonType)
      : PokemonType.NORMAL;

    // Obtener estadísticas base oficiales de la PokéAPI
    const hpStat = apiData.stats.find((s: any) => s.stat.name === 'hp')?.base_stat ?? 50;
    const attackStat = apiData.stats.find((s: any) => s.stat.name === 'attack')?.base_stat ?? 50;
    const defenseStat = apiData.stats.find((s: any) => s.stat.name === 'defense')?.base_stat ?? 50;

    // Determinar rareza e híbrido coste de energía en base al peso total de estadísticas oficiales (Poder crudo)
    const rawPower = hpStat + attackStat + defenseStat;
    let rarity = CardRarity.COMMON;
    let cost = 1;

    if (rawPower > 240) {
      rarity = CardRarity.LEGENDARY;
      cost = 6;
    } else if (rawPower > 180) {
      rarity = CardRarity.EPIC;
      cost = 4;
    } else if (rawPower > 120) {
      rarity = CardRarity.RARE;
      cost = 2;
    } else {
      rarity = CardRarity.COMMON;
      cost = 1;
    }

    // Calcular distribución de proporciones para preservar la identidad biológica/oficial del Pokémon
    const hpRatio = hpStat / rawPower;
    const attackRatio = attackStat / rawPower;
    const defenseRatio = defenseStat / rawPower;

    // Presupuesto total de estadísticas en el juego (Stat Budget) escalado no linealmente por costo de energía
    let statBudget = 100; // Costo 1 (Common)
    if (cost === 2) statBudget = 180;      // Costo 2 (Rare)
    else if (cost === 4) statBudget = 320; // Costo 4 (Epic)
    else if (cost === 6) statBudget = 500; // Costo 6 (Legendary)

    // Reescalar estadísticas según el presupuesto
    let balancedHp = Math.round(statBudget * hpRatio);
    let balancedAttack = Math.round(statBudget * attackRatio);
    let balancedDefense = Math.round(statBudget * defenseRatio);

    // Ajustar el ataque base de la carta dividiéndolo por el multiplicador de rareza en combate.
    // Esto garantiza que cuando DamageCalculatorService aplique el multiplicador en combate, 
    // el daño final del ataque se alinee con la distribución ideal del presupuesto del juego.
    const rarityMultiplier = {
      [CardRarity.COMMON]: 1.0,
      [CardRarity.RARE]: 1.2,
      [CardRarity.EPIC]: 1.5,
      [CardRarity.LEGENDARY]: 2.0
    }[rarity];

    balancedAttack = Math.round(balancedAttack / rarityMultiplier);

    // Establecer salvaguardas de jugabilidad mínimos para evitar valores inviables (como HP 0 o ATK 0)
    const hp = Math.max(40, balancedHp);
    const attack = Math.max(15, balancedAttack);
    const defense = Math.max(10, balancedDefense);

    // Habilidad especial (primer movimiento en la lista como stub)
    const rawAbility = apiData.abilities[0]?.ability?.name ?? 'Combate Rápido';
    const ability = rawAbility.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const imageUrl = apiData.sprites.other['official-artwork'].front_default ?? 
                     apiData.sprites.front_default ?? 
                     'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png';

    return {
      id: `poke-${apiData.id}`,
      name,
      imageUrl,
      type,
      hp,
      maxHp: hp,
      attack,
      defense,
      rarity,
      cost,
      level: 1,
      ability,
      description: `Un Pokémon de tipo ${type} con base de poder ${rawPower}. Habilidad: ${ability}.`,
      isReadyToAttack: false
    };
  }
}
