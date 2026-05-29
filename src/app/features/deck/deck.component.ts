import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CardViewComponent } from '@shared/components/card-view/card-view.component';
import { Card } from '@core/models/card.model';
import { PokemonType } from '@core/enums/pokemon-type.enum';
import { CardRarity } from '@core/enums/card-rarity.enum';
import { PlayerStore } from '@core/state/player.store';
import { NgFor, NgIf, UpperCasePipe } from '@angular/common';
import { SyncLoggerService } from '@core/services/sync-logger.service';
import { DialogService } from '@core/services/dialog.service';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-deck',
  standalone: true,
  imports: [CardViewComponent, NgFor, NgIf, UpperCasePipe, DragDropModule, RouterLink],
  templateUrl: './deck.component.html',
  styleUrl: './deck.component.css'
})
export class DeckComponent implements OnInit {
  public readonly playerStore = inject(PlayerStore);
  private readonly syncLogger = inject(SyncLoggerService);
  private readonly ds = inject(DialogService);

  // Signals reactivas de la vista
  public readonly deckName = signal<string>('Baraja de Batalla');
  public readonly inventorySearch = signal<string>('');
  public readonly selectedType = signal<PokemonType | null>(null);
  public readonly inspectedCard = signal<Card | null>(null);

  protected readonly PokemonType = PokemonType;
  
  protected readonly availableTypes = [
    PokemonType.FIRE,
    PokemonType.WATER,
    PokemonType.GRASS,
    PokemonType.ELECTRIC,
    PokemonType.PSYCHIC,
    PokemonType.GHOST
  ];

  /**
   * Cartas del mazo activo editado.
   */
  public readonly activeDeckCards = computed(() => {
    const decks = this.playerStore.decks();
    const selId = this.playerStore.selectedDeckId();
    if (!selId) return [];
    const active = decks.find(d => d.id === selId);
    return active ? active.cards : [];
  });

  /**
   * Agrupa las cartas del mazo por ID y contabiliza sus cantidades.
   */
  public readonly groupedDeckCards = computed(() => {
    const list = this.activeDeckCards();
    const map = new Map<string, { details: Card; quantity: number }>();
    
    list.forEach(c => {
      if (map.has(c.id)) {
        map.get(c.id)!.quantity++;
      } else {
        map.set(c.id, { details: c, quantity: 1 });
      }
    });

    return Array.from(map.values()).sort((a,b) => a.details.name.localeCompare(b.details.name));
  });

  /**
   * Filtra el inventario completo de la colección basándose en búsquedas y tipo.
   */
  public readonly filteredInventory = computed(() => {
    let list = this.playerStore.collection();

    // 1. Filtrar por Tipo
    const type = this.selectedType();
    if (type !== null) {
      list = list.filter(c => c.type === type);
    }

    // 2. Filtrar por Búsqueda de Nombre
    const query = this.inventorySearch().toLowerCase().trim();
    if (query !== '') {
      list = list.filter(c => c.name.toLowerCase().includes(query));
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  });

  public ngOnInit(): void {
    // Sincronizar campo de nombre de baraja con el mazo actual
    const decks = this.playerStore.decks();
    const selId = this.playerStore.selectedDeckId();
    if (selId) {
      const active = decks.find(d => d.id === selId);
      if (active) {
        this.deckName.set(active.name);
      }
    }
  }

  public onSelectDeck(deckId: string): void {
    this.playerStore.selectDeck(deckId);
    const active = this.playerStore.decks().find(d => d.id === deckId);
    if (active) {
      this.deckName.set(active.name);
    }
  }

  public async onCreateNewDeck(): Promise<void> {
    const nextNum = this.playerStore.decks().length + 1;
    const name = `Mazo Competitivo ${nextNum}`;
    try {
      const newId = await this.playerStore.createNewDeck(name);
      this.onSelectDeck(newId);
      this.ds.success(`Mazo "${name}" creado correctamente.`);
    } catch (e) {
      console.error(e);
      this.ds.error('Error al crear el mazo. Intenta nuevamente.');
    }
  }

  public async onDeleteDeck(): Promise<void> {
    const selId = this.playerStore.selectedDeckId();
    if (!selId) return;
    if (this.playerStore.decks().length <= 1) {
      this.ds.warning('Acción bloqueada: No puedes eliminar tu único mazo disponible.');
      return;
    }
    const activeName = this.deckName();
    // Dialog enterprise — reemplaza confirm() nativo
    const confirmed = await this.ds.confirmDelete(activeName);
    if (confirmed) {
      const success = await this.playerStore.deleteDeck(selId);
      if (success) {
        const remaining = this.playerStore.decks();
        if (remaining.length > 0) this.onSelectDeck(remaining[0].id);
        this.ds.success(`Mazo "${activeName}" eliminado correctamente.`);
      } else {
        this.ds.error('Error al eliminar el mazo. Intenta nuevamente.');
      }
    }
  }

  public async onRenameDeck(): Promise<void> {
    const selId = this.playerStore.selectedDeckId();
    const newName = this.deckName().trim();
    if (!selId) { this.ds.error('No hay mazo seleccionado.'); return; }
    if (!newName) { this.ds.warning('El nombre no puede estar vacío.'); return; }
    const success = await this.playerStore.renameDeck(selId, newName);
    if (success) {
      this.ds.success(`Mazo renombrado a "${newName}" y sincronizado.`);
      this.syncLogger.log('DECK_RENAME', { detail: `"${newName}"`, success: true });
    } else {
      this.ds.error('Error al renombrar el mazo.');
    }
  }

  public onDeckNameChange(event: Event): void {
    this.deckName.set((event.target as HTMLInputElement).value);
  }

  public onSearchChange(event: Event): void {
    this.inventorySearch.set((event.target as HTMLInputElement).value);
  }

  /**
   * Obtiene la cantidad de copias de una carta en el mazo activo.
   */
  public getQuantityInDeck(cardId: string): number {
    return this.activeDeckCards().filter(c => c.id === cardId).length;
  }

  /**
   * Añade una copia de la carta al mazo activo si no infringe restricciones.
   */
  public async addToDeck(card: Card): Promise<void> {
    const list = this.activeDeckCards();
    
    // Validar mazo lleno
    if (list.length >= 20) {
      this.ds.warning('Reglamento TCG: El mazo no puede superar las 20 cartas.');
      return;
    }

    // Validar límite de 4 duplicados
    const qty = this.getQuantityInDeck(card.id);
    if (qty >= 4) {
      this.ds.warning('Restricción: No puedes agregar más de 4 copias del mismo Pokémon.');
      return;
    }

    const updated = [...list, card];
    await this.saveActiveDeckChanges(updated);
  }

  /**
   * Quita una copia de la carta del mazo activo.
   */
  public async removeFromDeck(card: Card): Promise<void> {
    const list = this.activeDeckCards();
    const index = list.findIndex(c => c.id === card.id);
    if (index >= 0) {
      const updated = [...list];
      updated.splice(index, 1);
      await this.saveActiveDeckChanges(updated);
    }
  }

  /**
   * Remueve rápidamente una carta desde la lista lateral sin perder el focus.
   */
  public async quickRemove(card: Card, event: Event): Promise<void> {
    event.stopPropagation(); // Evitar que abra el panel de inspección si no se desea
    await this.removeFromDeck(card);
  }

  public async onDrop(event: CdkDragDrop<any>): Promise<void> {
    if (event.previousContainer !== event.container) {
      if (event.previousContainer.id === 'inventoryList' && event.container.id === 'deckList') {
        const card = event.previousContainer.data[event.previousIndex] as Card;
        await this.addToDeck(card);
      } else if (event.previousContainer.id === 'deckList' && event.container.id === 'inventoryList') {
        const card = event.item.data as Card;
        await this.removeFromDeck(card);
      }
    }
  }

  /**
   * Dispara el guardado de cartas del mazo activo.
   */
  public async triggerSaveDeck(): Promise<void> {
    await this.saveActiveDeckChanges(this.activeDeckCards());
    this.ds.success('Cambios del mazo guardados y sincronizados.');
  }

  /**
   * Persiste los cambios del mazo activo llamando al PlayerStore.
   */
  private async saveActiveDeckChanges(cards: Card[]): Promise<void> {
    const selId = this.playerStore.selectedDeckId();
    if (selId) {
      await this.playerStore.saveDeck(selId, this.deckName(), cards);
    }
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
