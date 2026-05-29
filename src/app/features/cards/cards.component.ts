import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CardViewComponent } from '@shared/components/card-view/card-view.component';
import { Card } from '@core/models/card.model';
import { PokemonType } from '@core/enums/pokemon-type.enum';
import { CardRarity } from '@core/enums/card-rarity.enum';
import { PokeApiService } from '@core/services/pokeapi.service';
import { NgFor, NgIf, UpperCasePipe } from '@angular/common';

@Component({
  selector: 'app-cards',
  standalone: true,
  imports: [CardViewComponent, NgFor, NgIf, UpperCasePipe],
  templateUrl: './cards.component.html',
  styleUrl: './cards.component.css'
})
export class CardsComponent implements OnInit {
  private readonly pokeApiService = inject(PokeApiService);

  protected readonly PokemonType = PokemonType;
  
  public readonly selectedType = signal<PokemonType | null>(null);
  public readonly searchQuery = signal<string>('');
  public readonly sortBy = signal<string>('name');
  public readonly isLoading = signal<boolean>(true);
  public readonly selectedCard = signal<Card | null>(null);

  private readonly cardsList = signal<Card[]>([]);

  // Tipos disponibles en los filtros
  protected readonly availableTypes = [
    PokemonType.FIRE,
    PokemonType.WATER,
    PokemonType.GRASS,
    PokemonType.ELECTRIC,
    PokemonType.PSYCHIC,
    PokemonType.GHOST,
    PokemonType.FIGHTING,
    PokemonType.FLYING,
    PokemonType.DRAGON
  ];

  /**
   * Filtra y ordena las cartas basándose en la query, el tipo y la propiedad de ordenamiento.
   */
  public readonly filteredAndSortedCards = computed(() => {
    let list = this.cardsList();

    // 1. Filtrar por Tipo
    const type = this.selectedType();
    if (type !== null) {
      list = list.filter(c => c.type === type);
    }

    // 2. Filtrar por Búsqueda de Nombre
    const query = this.searchQuery().toLowerCase().trim();
    if (query !== '') {
      list = list.filter(c => c.name.toLowerCase().includes(query));
    }

    // 3. Ordenar
    const criteria = this.sortBy();
    return [...list].sort((a, b) => {
      if (criteria === 'name') {
        return a.name.localeCompare(b.name);
      } else if (criteria === 'cost') {
        return a.cost - b.cost;
      } else if (criteria === 'hp') {
        return b.hp - a.hp; // Mayor vida primero
      } else if (criteria === 'attack') {
        return b.attack - a.attack; // Mayor ataque primero
      } else if (criteria === 'defense') {
        return b.defense - a.defense; // Mayor defensa primero
      }
      return 0;
    });
  });

  public ngOnInit(): void {
    // 14 Pokémon icónicos para la enciclopedia
    const pokemonIds = [1, 4, 7, 25, 133, 3, 6, 9, 94, 150, 143, 39, 149, 151];

    this.pokeApiService.getPokemonListAsCards(pokemonIds).subscribe({
      next: (cards) => {
        this.cardsList.set(cards);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al consultar PokeAPI para la enciclopedia', err);
        this.isLoading.set(false);
      }
    });
  }

  public selectCard(card: Card): void {
    this.selectedCard.set(card);
  }

  public onSearchChange(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  public onSortChange(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value);
  }

  // Helpers de estilos e idioma

  protected getTypeNameSpanish(type: PokemonType): string {
    const names: Record<PokemonType, string> = {
      [PokemonType.FIRE]: 'Fuego',
      [PokemonType.WATER]: 'Agua',
      [PokemonType.GRASS]: 'Planta',
      [PokemonType.ELECTRIC]: 'Eléctrico',
      [PokemonType.NORMAL]: 'Normal',
      [PokemonType.ICE]: 'Hielo',
      [PokemonType.FIGHTING]: 'Lucha',
      [PokemonType.POISON]: 'Veneno',
      [PokemonType.GROUND]: 'Tierra',
      [PokemonType.FLYING]: 'Volador',
      [PokemonType.PSYCHIC]: 'Psíquico',
      [PokemonType.BUG]: 'Bicho',
      [PokemonType.ROCK]: 'Roca',
      [PokemonType.GHOST]: 'Fantasma',
      [PokemonType.DRAGON]: 'Dragón',
      [PokemonType.DARK]: 'Siniestro',
      [PokemonType.STEEL]: 'Acero',
      [PokemonType.FAIRY]: 'Hada'
    };
    return names[type] ?? type;
  }

  protected getRarityName(rarity: CardRarity): string {
    const rarities: Record<CardRarity, string> = {
      [CardRarity.COMMON]: 'Común',
      [CardRarity.RARE]: 'Rara',
      [CardRarity.EPIC]: 'Épica',
      [CardRarity.LEGENDARY]: 'Legendaria'
    };
    return rarities[rarity] ?? rarity;
  }

  protected getTypeColor(type: PokemonType): string {
    const colors: Record<PokemonType, string> = {
      [PokemonType.FIRE]: '#e76f51',
      [PokemonType.WATER]: '#2a9d8f',
      [PokemonType.GRASS]: '#55a630',
      [PokemonType.ELECTRIC]: '#ffb703',
      [PokemonType.NORMAL]: '#8d99ae',
      [PokemonType.ICE]: '#a8dadc',
      [PokemonType.FIGHTING]: '#b10026',
      [PokemonType.POISON]: '#7209b7',
      [PokemonType.GROUND]: '#b5838d',
      [PokemonType.FLYING]: '#457b9d',
      [PokemonType.PSYCHIC]: '#ff4d6d',
      [PokemonType.BUG]: '#70e000',
      [PokemonType.ROCK]: '#6d597a',
      [PokemonType.GHOST]: '#3d348b',
      [PokemonType.DRAGON]: '#9e0059',
      [PokemonType.DARK]: '#1a1a24',
      [PokemonType.STEEL]: '#7371fc',
      [PokemonType.FAIRY]: '#ff85a1'
    };
    return colors[type] ?? '#8d99ae';
  }
}
