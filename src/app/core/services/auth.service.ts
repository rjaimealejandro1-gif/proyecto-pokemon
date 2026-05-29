import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { LoggerService } from './logger.service';

/**
 * AuthService — Gestiona el estado de autenticación de Supabase.
 *
 * FLUJO:
 * 1. Constructor llama initAuthListener() (async)
 * 2. _loading = true hasta que getSession() resuelve (o falla)
 * 3. Guards esperan con waitForAuthReady() antes de evaluar isAuth()
 * 4. onAuthStateChange() mantiene el estado sincronizado en tiempo real
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly router   = inject(Router);
  private readonly logger   = inject(LoggerService);

  // ── Estado interno reactivo ──
  private readonly _session = signal<Session | null>(null);
  private readonly _loading = signal<boolean>(true);
  private _authListenerSub: { data: { subscription: { unsubscribe: () => void } } } | null = null;

  // ── Señales públicas de solo lectura ──
  public readonly session   = computed(() => this._session());
  public readonly user      = computed(() => this._session()?.user ?? null);
  public readonly isAuth    = computed(() => !!this._session());
  public readonly isLoading = computed(() => this._loading());

  constructor() {
    this.logger.log('[AuthService] 🚀 Inicializando AuthService...');
    this.initAuthListener();
  }

  /**
   * Carga la sesión persistida y suscribe al listener de cambios.
   * GARANTIZA que _loading se pone en false independientemente del resultado.
   */
  private async initAuthListener(): Promise<void> {
    const t0 = performance.now();
    try {
      const client = this.supabase.client;

      if (!client) {
        this.logger.warn('[AuthService] ❌ Supabase no disponible — sesión: null, modo offline.');
        this._session.set(null);
        this._loading.set(false);
        return;
      }

      // ── DEBUG: Estado de localStorage ANTES de getSession ──
      this.debugLocalStorage();

      // Obtener sesión persistida del localStorage
      this.logger.log('[AuthService] 🔍 Llamando getSession()...');
      const { data, error } = await client.auth.getSession();
      const ms = (performance.now() - t0).toFixed(1);

      if (error) {
        this.logger.warn(`[AuthService] ⚠️ getSession() error (${ms}ms): ${error.message}`);
        this._session.set(null);
      } else {
        const session = data.session;
        this.logger.log(
          `[AuthService] ✅ getSession() resuelto (${ms}ms) → ` +
          `sesión: ${session ? `ACTIVA (userId: ${session.user.id})` : 'NINGUNA'}`
        );
        if (session) {
          this.logger.log(
            `[AuthService] 📋 Sesión: email=${session.user.email}, ` +
            `expires_at=${new Date((session.expires_at ?? 0) * 1000).toISOString()}`
          );
        }
        this._session.set(session);
      }

      // _loading SIEMPRE se resuelve aquí, antes de suscribir al listener
      this._loading.set(false);
      this.logger.log(`[AuthService] 🏁 isLoading=false | isAuth=${!!this._session()}`);

      // ── Suscripción a cambios de estado en tiempo real ──
      this._authListenerSub = client.auth.onAuthStateChange((_event, session) => {
        this.logger.log(
          `[AuthService] 🔔 onAuthStateChange: event=${_event} | ` +
          `sesión: ${session ? `ACTIVA (${session.user.email})` : 'NINGUNA'}`
        );
        this._session.set(session);
      });

    } catch (err) {
      const ms = (performance.now() - t0).toFixed(1);
      this.logger.error(`[AuthService] 💥 Error crítico en initAuthListener (${ms}ms):`, err);
      this._session.set(null);
      this._loading.set(false); // ← SIEMPRE liberar el guard aunque haya error
    }
  }

  /** Imprime el contenido relevante de localStorage para auditoría. */
  private debugLocalStorage(): void {
    const relevant: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('sb-') || key.includes('poke'))) {
        const val = localStorage.getItem(key) ?? '';
        relevant[key] = val.length > 80 ? val.substring(0, 80) + '...' : val;
      }
    }
    this.logger.log('[AuthService] 📦 localStorage (claves relevantes):', relevant);
  }

  // ─────────────────────────────────────────────
  // REGISTRO
  // ─────────────────────────────────────────────

  async signUp(email: string, password: string, username: string): Promise<{ error: string | null; isNew: boolean }> {
    this.logger.log(`[AuthService] 📝 signUp() → email: ${email}`);
    const client = this.supabase.client;
    if (!client) return { error: 'Supabase no disponible.', isNew: false };

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });

    if (error) {
      this.logger.warn(`[AuthService] signUp() error: ${error.message}`);
      return { error: error.message, isNew: false };
    }

    if (data.session) {
      // Sesión inmediata = sin confirmación de email requerida
      this.logger.log(`[AuthService] ✅ signUp() → sesión inmediata (userId: ${data.session.user.id})`);
      this._session.set(data.session);
      return { error: null, isNew: true };
    }

    this.logger.log('[AuthService] 📧 signUp() → requiere confirmación de email');
    return { error: null, isNew: false };
  }

  // ─────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────

  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    this.logger.log(`[AuthService] 🔑 signIn() → email: ${email}`);
    const client = this.supabase.client;
    if (!client) return { error: 'Supabase no disponible.' };

    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      this.logger.warn(`[AuthService] signIn() error: ${error.message}`);
      return { error: error.message };
    }

    this.logger.log(`[AuthService] ✅ signIn() exitoso → userId: ${data.session?.user.id}`);
    this._session.set(data.session);
    return { error: null };
  }

  // ─────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────

  async signOut(): Promise<void> {
    this.logger.log('[AuthService] 🚪 signOut() — limpiando sesión completa...');

    // 1. Cerrar sesión en Supabase (invalida el token en el servidor)
    try {
      const client = this.supabase.client;
      if (client) {
        await client.auth.signOut();
        this.logger.log('[AuthService] ✅ Sesión invalidada en Supabase.');
      }
    } catch (err) {
      this.logger.warn('[AuthService] ⚠️ Error al cerrar sesión en servidor (continuando):', err);
    }

    // 2. Limpiar señal local
    this._session.set(null);

    // 3. Limpiar TODO lo relacionado con Supabase en localStorage
    this.clearLocalSession();

    // 4. Navegar al home
    this.logger.log('[AuthService] 🏠 Navegando a /home...');
    this.router.navigate(['/home']);
  }

  /**
   * Elimina TODAS las claves de Supabase de localStorage.
   * Incluye sesiones fantasma de keys anteriores (sb_publishable_, etc.)
   */
  clearLocalSession(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    this.logger.log(`[AuthService] 🧹 localStorage limpiado (${keysToRemove.length} claves eliminadas): ${keysToRemove.join(', ')}`);
  }

  // ─────────────────────────────────────────────
  // UTILIDADES
  // ─────────────────────────────────────────────

  /** Detecta si el usuario es nuevo revisando su colección. */
  async isNewUser(userId: string): Promise<boolean> {
    const client = this.supabase.client;
    if (!client) return false;

    const { count } = await client
      .from('player_collection')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return (count ?? 0) === 0;
  }

  ngOnDestroy(): void {
    this._authListenerSub?.data.subscription.unsubscribe();
  }
}
