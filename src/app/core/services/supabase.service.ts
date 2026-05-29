import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '@environments/environment';
import { LoggerService } from './logger.service';

/**
 * SupabaseService — Singleton del cliente oficial de Supabase.
 *
 * NOTA DE CONFIGURACIÓN:
 * - Se usa la anon key JWT (eyJ...) requerida por @supabase/supabase-js v2.x
 * - autoRefreshToken: true   → renueva el token antes de que expire
 * - persistSession: true     → guarda la sesión en localStorage (persistencia cross-reload)
 * - detectSessionInUrl: true → maneja tokens mágicos de email confirmation en la URL
 * - storageKey: fijo         → evita colisiones cuando se cambia de key format (sb_publishable_ vs JWT)
 */
@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private readonly logger = inject(LoggerService);
  private supabase!: SupabaseClient;

  // Clave de localStorage donde Supabase guarda la sesión (fija para evitar sesiones fantasma)
  // Formato: sb-<project-ref>-auth-token
  private readonly SESSION_STORAGE_KEY = 'sb-klmngjtldhslatmqjcbf-auth-token';

  constructor() {
    this.purgeLegacySessions();
    this.initSupabase();
  }

  /**
   * Elimina sesiones guardadas bajo claves antiguas (sb_publishable_...) que
   * podrían causar estados fantasma: el navegador las restaura aunque el usuario
   * nunca haya hecho login explícito en la sesión actual.
   */
  private purgeLegacySessions(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Eliminar CUALQUIER clave de sesión de Supabase que NO sea la clave canónica JWT
      const isSupabaseKey = key.startsWith('sb-') || key.includes('supabase');
      const isLegacyOrMismatched = isSupabaseKey && key !== this.SESSION_STORAGE_KEY;
      if (isLegacyOrMismatched) {
        keysToRemove.push(key);
      }
    }
    if (keysToRemove.length > 0) {
      keysToRemove.forEach(k => localStorage.removeItem(k));
      this.logger.warn(`[SupabaseService] 🧹 Purgadas ${keysToRemove.length} sesión(es) legacy/fantasma: ${keysToRemove.join(', ')}`);
    }
  }

  /**
   * Inicializa el cliente oficial de Supabase con configuración explícita.
   */
  private initSupabase(): void {
    try {
      const url = environment.supabaseUrl;
      const key = environment.supabaseKey;

      if (!url || !key) {
        this.logger.warn('[SupabaseService] ❌ Credenciales ausentes — modo offline.');
        return;
      }

      // Validar que la key sea JWT (empieza con "eyJ") y no el formato publishable
      if (!key.startsWith('eyJ')) {
        this.logger.warn(
          `[SupabaseService] ⚠️ La supabaseKey no parece ser una anon JWT válida (no empieza con "eyJ"). ` +
          `Formato detectado: ${key.substring(0, 20)}... Esto puede causar errores de autenticación.`
        );
      }

      this.supabase = createClient(url, key, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storageKey: this.SESSION_STORAGE_KEY,  // ← Clave FIJA para evitar sesiones fantasma
        }
      });

      this.logger.log(`[SupabaseService] ✅ Cliente inicializado. URL: ${url.substring(0, 40)}...`);
      this.logger.log(`[SupabaseService] 🔑 Usando storageKey: "${this.SESSION_STORAGE_KEY}"`);
    } catch (error) {
      this.logger.error('[SupabaseService] ❌ Error al inicializar cliente:', error);
    }
  }

  /** Instancia del cliente de Supabase (puede ser undefined si no hay credenciales). */
  public get client(): SupabaseClient {
    return this.supabase;
  }

  /** API de autenticación. */
  public get auth() {
    return this.supabase?.auth;
  }

  /** API de base de datos. */
  public get db() {
    return this.supabase?.from;
  }

  /**
   * Test de conectividad real a Supabase.
   * Hace un fetch() directo (mismo mecanismo que usa el SDK) al endpoint de health.
   * Sirve para distinguir entre: sin internet | DNS falla | CORS | servidor caído.
   */
  public async testConnectivity(): Promise<{
    ok: boolean;
    status?: number;
    error?: string;
    durationMs: number;
    navigatorOnline: boolean;
  }> {
    const t0 = performance.now();
    const navigatorOnline = navigator.onLine;
    const url = `${environment.supabaseUrl}/auth/v1/health`;

    this.logger.log(`[SupabaseService] 🧪 testConnectivity() → navigator.onLine=${navigatorOnline}, url=${url}`);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'apikey': environment.supabaseKey },
        // Sin cache, para probar la red real
        cache: 'no-store',
      });
      const durationMs = Math.round(performance.now() - t0);
      this.logger.log(`[SupabaseService] 🧪 Respuesta HTTP ${res.status} en ${durationMs}ms`);
      return { ok: res.ok || res.status === 200, status: res.status, durationMs, navigatorOnline };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - t0);
      const errorMsg = err?.message ?? String(err);
      this.logger.warn(`[SupabaseService] 🧪 Error de conectividad (${durationMs}ms): ${errorMsg}`);
      return { ok: false, error: errorMsg, durationMs, navigatorOnline };
    }
  }

  /**
   * Crea y suscribe a un canal en tiempo real para sincronización multiplayer.
   */
  public joinRealtimeRoom(channelName: string, onUpdate: (payload: any) => void) {
    if (!this.supabase) {
      this.logger.warn('[SupabaseService] Realtime no disponible: Supabase no está configurado.');
      return null;
    }

    this.logger.log(`[SupabaseService] Suscribiéndose a canal: ${channelName}`);

    return this.supabase
      .channel(channelName)
      .on('broadcast', { event: 'game-state' }, (response) => onUpdate(response['payload']))
      .subscribe((status) => {
        this.logger.log(`[SupabaseService] Canal [${channelName}] estado: ${status}`);
      });
  }
}
