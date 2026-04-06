import { Routes } from '@angular/router';
import { ImportarFaturaComponent } from './features/importar-fatura/importar-fatura.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { FaturasListComponent } from './features/faturas/faturas-list.component';
import { FaturaDetalheComponent } from './features/faturas/fatura-detalhe.component';
import { CartoesListComponent } from './features/cartoes/cartoes-list.component';
import { LayoutsListComponent } from './features/layouts/layouts-list.component';
import { LancamentoManualComponent } from './features/lancamento-manual/lancamento-manual.component';
import { ParametrosComponent } from './features/configuracoes/parametros/parametros.component';

export const routes: Routes = [
  { path: '', redirectTo: 'importar', pathMatch: 'full' },
  { path: 'importar', component: ImportarFaturaComponent },
  { path: 'lancamento-manual', component: LancamentoManualComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'faturas', component: FaturasListComponent },
  { path: 'faturas/:id', component: FaturaDetalheComponent },
  { path: 'cartoes', component: CartoesListComponent },
  { path: 'layouts', component: LayoutsListComponent },
  { path: 'configuracoes/parametros', component: ParametrosComponent },
];
