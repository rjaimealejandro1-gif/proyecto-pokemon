import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

const MAX_WAIT_MS = 5000;

/**
 * Espera a que AuthService resuelva la sesión persistida.
 * Timeout máximo de 5s para nunca quedar colgado.
 */
async function waitForAuthReady(auth: AuthService, guardName: string): Promise<void> {
  if (!auth.isLoading()) return;

  console.log(`[Guard:${guardName}] ⏳ Esperando que AuthService cargue sesión...`);
  const start = Date.now();

  await new Promise<void>(resolve => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      if (!auth.isLoading()) {
        clearInterval(interval);
        console.log(`[Guard:${guardName}] ✅ AuthService listo (${elapsed}ms)`);
        resolve();
      } else if (elapsed >= MAX_WAIT_MS) {
        clearInterval(interval);
        console.warn(`[Guard:${guardName}] ⏰ Timeout (${MAX_WAIT_MS}ms) — asumiendo sin sesión`);
        resolve();
      }
    }, 50);
  });
}

/**
 * authGuard — Protege rutas privadas.
 * Si no hay sesión Supabase activa → redirige a /auth.
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  await waitForAuthReady(auth, 'authGuard');

  const authenticated = auth.isAuth();
  console.log(
    `[Guard:authGuard] Ruta solicitada: "${state.url}" | isAuth=${authenticated} | ` +
    `userId=${auth.user()?.id ?? 'ninguno'}`
  );

  if (authenticated) {
    console.log(`[Guard:authGuard] ✅ Acceso concedido a "${state.url}"`);
    return true;
  }

  console.log(`[Guard:authGuard] 🔒 Sin sesión → redirigiendo a /auth`);
  router.navigate(['/auth']);
  return false;
};

/**
 * noAuthGuard — Impide que usuarios autenticados vean el login.
 * Si HAY sesión Supabase activa → redirige a /dashboard.
 */
export const noAuthGuard: CanActivateFn = async (route, state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  await waitForAuthReady(auth, 'noAuthGuard');

  const authenticated = auth.isAuth();
  console.log(
    `[Guard:noAuthGuard] Ruta solicitada: "${state.url}" | isAuth=${authenticated} | ` +
    `userId=${auth.user()?.id ?? 'ninguno'}`
  );

  if (!authenticated) {
    console.log(`[Guard:noAuthGuard] ✅ Sin sesión → mostrando Auth`);
    return true;
  }

  console.log(`[Guard:noAuthGuard] 🔄 Sesión activa → redirigiendo a /dashboard`);
  router.navigate(['/dashboard']);
  return false;
};
