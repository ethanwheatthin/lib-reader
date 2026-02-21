import { ApplicationConfig, provideBrowserGlobalErrorListeners, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { routes } from './app.routes';
import { documentsFeature } from './store/documents/documents.reducer';
import { DocumentsEffects } from './store/documents/documents.effects';
import { shelvesFeature } from './store/shelves/shelves.reducer';
import { ShelvesEffects } from './store/shelves/shelves.effects';
import { uiFeature } from './store/ui/ui.reducer';
import { librarySourcesFeature } from './store/library-sources/library-sources.reducer';
import { LibrarySourcesEffects } from './store/library-sources/library-sources.effects';
import { AutoBackupService } from './core/services/auto-backup.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    provideStore({
      [documentsFeature.name]: documentsFeature.reducer,
      [shelvesFeature.name]: shelvesFeature.reducer,
      [uiFeature.name]: uiFeature.reducer,
      [librarySourcesFeature.name]: librarySourcesFeature.reducer,
    }),
    provideEffects([DocumentsEffects, ShelvesEffects, LibrarySourcesEffects]),
    provideStoreDevtools({ maxAge: 25 }),
    {
      provide: APP_INITIALIZER,
      useFactory: (autoBackup: AutoBackupService) => () => autoBackup.start(),
      deps: [AutoBackupService],
      multi: true,
    },
  ]
};
