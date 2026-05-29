import { Component, inject, OnInit, effect, signal } from '@angular/core';
import { PlayerStore } from '@core/state/player.store';
import { MatchHistoryService } from '@core/services/match-history.service';
import { NgFor, NgIf, DatePipe, UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SqliteService } from '@core/services/sqlite.service';
import { LoggerService } from '@core/services/logger.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, UpperCasePipe, RouterLink],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent implements OnInit {
  public readonly playerStore = inject(PlayerStore);
  public readonly historyService = inject(MatchHistoryService);
  private readonly sqlite = inject(SqliteService);
  private readonly logger = inject(LoggerService);

  public currentTab = signal<'ONLINE' | 'OFFLINE'>('ONLINE');
  public offlineMatches = signal<any[]>([]);

  constructor() {
    // Escuchar cambios en el perfil para recargar si es necesario
    effect(() => {
      const profile = this.playerStore.profile();
      if (profile && profile.id) {
        this.historyService.loadUserHistory(profile.id);
      }
    });
  }

  ngOnInit(): void {
    const profile = this.playerStore.profile();
    if (profile && profile.id) {
      this.historyService.loadUserHistory(profile.id);
    }
    this.loadOfflineHistory();
  }

  setTab(tab: 'ONLINE' | 'OFFLINE'): void {
    this.currentTab.set(tab);
    if (tab === 'OFFLINE') {
      this.loadOfflineHistory();
    }
  }

  loadOfflineHistory(): void {
    try {
      if (!this.sqlite.isReady()) return;
      
      const rows = this.sqlite.query('SELECT * FROM local_matches ORDER BY created_at DESC');
      const parsed = rows.map(r => {
        const data = JSON.parse(r.data);
        return {
          id: r.id,
          mode: r.mode,
          result: r.result,
          opponentName: 'INTELIGENCIA ARTIFICIAL',
          turns: data.turns || 0,
          date: new Date(r.created_at)
        };
      });
      this.offlineMatches.set(parsed);
    } catch (e) {
      this.logger.error('HistoryComponent: Error cargando historial offline desde SQLite', e);
    }
  }

  // Helper para mostrar el deck activo o favorito
  getFavoriteDeckName(): string {
    const decks = this.playerStore.decks();
    const activeId = this.playerStore.selectedDeckId();
    if (decks.length === 0) return 'Ningún Mazo';
    
    if (activeId) {
      const active = decks.find(d => d.id === activeId);
      if (active) return active.name;
    }
    
    return decks[0].name;
  }
}
