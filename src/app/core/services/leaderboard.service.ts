import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface LeaderboardPlayer {
  id: string;
  rank: number | 'UNRANKED';
  username: string;
  level: number;
  victories: number;
  defeats: number;
  totalMatches: number;
  winRate: number; // 0 to 100
}

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  private supabaseService = inject(SupabaseService);

  private readonly _players = signal<LeaderboardPlayer[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  public readonly players = computed(() => this._players());
  public readonly isLoading = computed(() => this._isLoading());
  public readonly error = computed(() => this._error());

  constructor() {}

  public async loadLeaderboard(): Promise<void> {
    if (!this.supabaseService.client) return;
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const client = this.supabaseService.client;
      // 1. Fetch top 100 players ordered by victories (to get a good initial set)
      const { data, error } = await client
        .from('profiles')
        .select('id, username, level, victories, defeats')
        .order('victories', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!data) {
        this._players.set([]);
        return;
      }

      // 2. Process and calculate stats
      let processed: LeaderboardPlayer[] = data.map(p => {
        const totalMatches = p.victories + p.defeats;
        const winRate = totalMatches > 0 ? Math.round((p.victories / totalMatches) * 100) : 0;
        return {
          id: p.id,
          username: p.username,
          level: p.level || 1,
          victories: p.victories,
          defeats: p.defeats,
          totalMatches,
          winRate,
          rank: 'UNRANKED' // Default, will be assigned below
        };
      });

      // 3. Separate ranked vs unranked (< 5 matches)
      const MIN_MATCHES = 5;
      const ranked = processed.filter(p => p.totalMatches >= MIN_MATCHES);
      const unranked = processed.filter(p => p.totalMatches < MIN_MATCHES);

      // 4. Sort ranked players by e-sports rules
      // P1: Winrate, P2: Victories, P3: Fewer Defeats, P4: Level
      ranked.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.victories !== a.victories) return b.victories - a.victories;
        if (a.defeats !== b.defeats) return a.defeats - b.defeats;
        return b.level - a.level;
      });

      // Assign ranks to ranked players
      ranked.forEach((p, index) => {
        p.rank = index + 1;
      });

      // Unranked players stay 'UNRANKED', but sort them by total matches and victories
      unranked.sort((a, b) => {
        if (b.totalMatches !== a.totalMatches) return b.totalMatches - a.totalMatches;
        if (b.victories !== a.victories) return b.victories - a.victories;
        return b.level - a.level;
      });

      // 5. Merge them back: Ranked first, then unranked
      this._players.set([...ranked, ...unranked]);

    } catch (err: any) {
      console.error('[LeaderboardService] Error:', err);
      this._error.set(err.message || 'Error loading leaderboard');
    } finally {
      this._isLoading.set(false);
    }
  }

  public getPlayerPosition(userId: string): LeaderboardPlayer | null {
    const p = this._players().find(x => x.id === userId);
    return p || null;
  }
}
