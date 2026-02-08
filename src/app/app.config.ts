import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { routes } from './app.routes';
import { documentsFeature } from './store/documents/documents.reducer';
import { DocumentsEffects } from './store/documents/documents.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideStore({ [documentsFeature.name]: documentsFeature.reducer }),
    provideEffects([DocumentsEffects]),
    provideStoreDevtools({ maxAge: 25 })
  ]
};
