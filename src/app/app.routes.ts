import { Routes } from '@angular/router';
import { ImportarFaturaComponent } from './features/importar-fatura/importar-fatura.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'importar', pathMatch: 'full' },
  { path: 'importar', component: ImportarFaturaComponent },
  { path: 'dashboard', component: DashboardComponent },
];