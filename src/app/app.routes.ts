import { Routes } from '@angular/router';
import { LibraryComponent } from './features/library/library.component';
import { ReaderComponent } from './features/reader/reader.component';

export const routes: Routes = [
  { path: '', redirectTo: '/library', pathMatch: 'full' },
  { path: 'library', component: LibraryComponent },
  { path: 'reader/:id', component: ReaderComponent }
];
