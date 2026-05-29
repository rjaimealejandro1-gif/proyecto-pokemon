import { ApplicationConfig, APP_INITIALIZER, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { SqliteService } from '@core/services/sqlite.service';

import { routes } from './app.routes';

export function initializeApp(sqliteService: SqliteService) {
  return () => sqliteService.bootDatabase();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [SqliteService],
      multi: true
    }
  ]
};
