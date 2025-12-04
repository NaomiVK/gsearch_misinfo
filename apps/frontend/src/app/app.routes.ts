import { Route } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
  },
  {
    path: 'comparison',
    loadComponent: () =>
      import('./pages/comparison/comparison.component').then(
        (m) => m.ComparisonComponent
      ),
  },
  {
    path: 'trends',
    loadComponent: () =>
      import('./pages/trends/trends.component').then((m) => m.TrendsComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.component').then(
        (m) => m.SettingsComponent
      ),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
