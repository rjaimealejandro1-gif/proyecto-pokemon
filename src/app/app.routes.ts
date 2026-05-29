import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  // ── RUTA RAÍZ → HOME ──
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },

  // ── RUTAS PÚBLICAS ──
  {
    path: 'home',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'auth',
    canActivate: [noAuthGuard],  // Si ya hay sesión, redirige a /dashboard
    loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent)
  },

  // ── TUTORIAL (post-registro, solo para usuarios nuevos) ──
  {
    path: 'tutorial',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tutorial/tutorial.component').then(m => m.TutorialComponent)
  },

  // ── RUTAS PRIVADAS (requieren sesión) ──
  // RUTA BATTLE: Completamente separada del layout para ser fullscreen/cinemática
  {
    path: 'battle',
    redirectTo: 'battle/ia',
    pathMatch: 'full'
  },
  {
    path: 'battle/:mode',
    canActivate: [authGuard],
    loadComponent: () => import('./features/battle/battle.component').then(m => m.BattleComponent)
  },
  {
    path: 'result',
    canActivate: [authGuard],
    loadComponent: () => import('./features/result/result.component').then(m => m.ResultComponent)
  },
  {
    path: 'rules',
    canActivate: [authGuard],
    loadComponent: () => import('./features/rules/rules.component').then(m => m.RulesComponent)
  },

  // LAYOUT PRINCIPAL (Dashboard, Cartas, Historial)
  {
    path: '',
    loadComponent: () => import('./shared/components/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'cards',
        loadComponent: () => import('./features/cards/cards.component').then(m => m.CardsComponent)
      },
      {
        path: 'deck',
        loadComponent: () => import('./features/deck/deck.component').then(m => m.DeckComponent)
      },
      {
        path: 'history',
        loadComponent: () => import('./features/history/history.component').then(m => m.HistoryComponent)
      },
      {
        path: 'leaderboard',
        loadComponent: () => import('./features/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent)
      }
    ]
  },

  // ── WILDCARD ──
  {
    path: '**',
    redirectTo: 'home'
  }
];
