import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface MatchHistoryRecord {
  id: string;
  opponentName: string;
  opponentId: string;
  result: 'VICTORIA' | 'DERROTA' | 'EMPATE';
  turns: number;
  date: Date;
  mode: string;
}

@Injectable({
  providedIn: 'root'
})
export class MatchHistoryService {
  private supabaseService = inject(SupabaseService);

  private readonly _matches = signal<MatchHistoryRecord[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  public readonly matches = computed(() => this._matches());
  public readonly isLoading = computed(() => this._isLoading());
  public readonly error = computed(() => this._error());

  constructor() {}

  /**
   * Obtiene el historial de partidas del usuario desde Supabase.
   * Solo obtiene partidas con status 'finished'.
   */
  public async loadUserHistory(userId: string): Promise<void> {
    if (!userId || !this.supabaseService.client) return;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const client = this.supabaseService.client;
      
      // 1. Obtener los últimos 20 matches finalizados donde participa el usuario
      const { data: matchesData, error: matchesErr } = await client
        .from('matches')
        .select('*')
        .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(20);

      if (matchesErr) throw matchesErr;

      if (!matchesData || matchesData.length === 0) {
        this._matches.set([]);
        this._isLoading.set(false);
        return;
      }

      // 2. Extraer los IDs de los rivales
      const opponentIds = new Set<string>();
      matchesData.forEach(m => {
        const oppId = m.host_id === userId ? m.guest_id : m.host_id;
        if (oppId) opponentIds.add(oppId);
      });

      // 3. Obtener nombres de los rivales desde perfiles
      const profilesMap = new Map<string, string>();
      if (opponentIds.size > 0) {
        const { data: profilesData, error: profErr } = await client
          .from('profiles')
          .select('id, username')
          .in('id', Array.from(opponentIds));
        
        if (!profErr && profilesData) {
          profilesData.forEach(p => profilesMap.set(p.id, p.username));
        }
      }

      // 4. Mapear al modelo del frontend
      const historyRecords: MatchHistoryRecord[] = matchesData.map(m => {
        const isHost = m.host_id === userId;
        const opponentId = isHost ? m.guest_id : m.host_id;
        
        // Si no hay guest_id, asumimos que fue vs IA o un match cancelado, 
        // pero solo consultamos 'finished', la IA no se guarda en db, pero por si acaso.
        const opponentName = opponentId ? (profilesMap.get(opponentId) || 'Entrenador Desconocido') : 'IA (Desconectado)';
        
        let result: 'VICTORIA' | 'DERROTA' | 'EMPATE' = 'EMPATE';
        if (m.winner_id) {
          result = m.winner_id === userId ? 'VICTORIA' : 'DERROTA';
        }

        return {
          id: m.id,
          opponentName,
          opponentId: opponentId || '',
          result,
          turns: m.turn_number || 0,
          date: new Date(m.created_at),
          mode: 'ARENA ONLINE' // Todo lo que viene de DB es online por ahora
        };
      });

      this._matches.set(historyRecords);
    } catch (err: any) {
      console.error('[MatchHistoryService] Error loading history:', err);
      this._error.set(err?.message || 'Error desconocido al cargar el historial');
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Limpia el estado (útil para logout)
   */
  public clearHistory(): void {
    this._matches.set([]);
    this._error.set(null);
  }
}
