import { Routes } from '@angular/router';
import { authGuard } from '@core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'entries',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/entries/entries.component').then((m) => m.EntriesComponent),
  },
  {
    path: 'search',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/search/search.component').then((m) => m.SearchComponent),
  },
  {
    path: 'entries/:id',
    canActivate: [authGuard],
    // withComponentInputBinding hace que :id llegue como input() sin tener
    // que inyectar ActivatedRoute.
    loadComponent: () =>
      import('./features/entry-detail/entry-detail.component').then((m) => m.EntryDetailComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'entries' },
  { path: '**', redirectTo: 'entries' },
];
