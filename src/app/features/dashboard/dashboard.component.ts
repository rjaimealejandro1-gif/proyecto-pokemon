import { Component, inject, signal, computed, ViewEncapsulation, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { PlayerStore } from '@core/state/player.store';
import { GameManagerService } from '@core/engine/game-manager.service';
import { GameStore } from '@core/state/game.store';
import { MatchState } from '@core/enums/match-state.enum';
import { NgIf, NgFor, UpperCasePipe } from '@angular/common';
import { TutorialService } from '@core/services/tutorial.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, NgIf, NgFor, UpperCasePipe],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  public readonly playerStore = inject(PlayerStore);
  public readonly gameStore = inject(GameStore);
  public readonly gameManager = inject(GameManagerService);
  private readonly router = inject(Router);
  public readonly tutorialService = inject(TutorialService);

  public readonly MatchState = MatchState;

  public readonly isDeckSelectorOpen = signal<boolean>(false);

  ngOnInit() {
    this.tutorialService.checkAndStartTutorial();
  }
  public readonly selectedGameMode = signal<'ia' | 'online' | null>(null);
  public readonly deckToSelectId = signal<string | null>(null);

  public readonly selectedDeckInModal = computed(() => {
    const decks = this.playerStore.decks();
    const selId = this.deckToSelectId() || this.playerStore.selectedDeckId();
    if (!selId) return null;
    return decks.find(d => d.id === selId) || null;
  });

  public canLaunch(): boolean {
    const deck = this.selectedDeckInModal();
    return deck !== null && deck.cards.length === 20 && !this.playerStore.isLoading();
  }

  public onSelectDeckInModal(deckId: string): void {
    this.deckToSelectId.set(deckId);
  }

  public openDeckSelector(gameMode: 'ia' | 'online'): void {
    this.selectedGameMode.set(gameMode);
    this.deckToSelectId.set(this.playerStore.selectedDeckId());
    this.isDeckSelectorOpen.set(true);
  }

  public closeDeckSelector(): void {
    this.isDeckSelectorOpen.set(false);
    this.selectedGameMode.set(null);
    this.deckToSelectId.set(null);
  }

  public launchBattle(): void {
    if (!this.canLaunch()) return;
    
    const activeDeck = this.selectedDeckInModal();
    if (activeDeck) {
      this.playerStore.selectDeck(activeDeck.id);
    }

    const mode = this.selectedGameMode();
    this.closeDeckSelector();

    if (mode === 'ia') {
      this.gameManager.startSinglePlayerGame();
    } else if (mode === 'online') {
      this.gameManager.enterMatchmaking();
    }
  }

  public cancelMatchmaking(): void {
    this.gameManager.exitToMenu();
  }
}
