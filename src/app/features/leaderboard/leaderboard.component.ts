import { Component, inject, OnInit } from '@angular/core';
import { LeaderboardService, LeaderboardPlayer } from '@core/services/leaderboard.service';
import { PlayerStore } from '@core/state/player.store';
import { NgIf, NgFor, UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [NgIf, NgFor, UpperCasePipe, RouterLink],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.css'
})
export class LeaderboardComponent implements OnInit {
  public leaderboardService = inject(LeaderboardService);
  public playerStore = inject(PlayerStore);

  ngOnInit(): void {
    // Load leaderboard on init
    this.leaderboardService.loadLeaderboard();
  }

  // Get Top 3
  get podiumPlayers(): LeaderboardPlayer[] {
    return this.leaderboardService.players().filter(p => typeof p.rank === 'number' && p.rank <= 3);
  }

  // Get Rank 4 and beyond, including Unranked
  get ladderPlayers(): LeaderboardPlayer[] {
    return this.leaderboardService.players().filter(p => p.rank === 'UNRANKED' || p.rank > 3);
  }

  // Get current user's entry
  get currentUserEntry(): LeaderboardPlayer | null {
    const profile = this.playerStore.profile();
    if (!profile) return null;
    return this.leaderboardService.getPlayerPosition(profile.id);
  }

  getRankBadgeClass(rank: number | 'UNRANKED'): string {
    if (rank === 'UNRANKED') return 'rank-unranked';
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return 'rank-standard';
  }
}
