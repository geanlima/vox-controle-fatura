import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';

import { LocalDbService, FaturaSalvaResumo } from '../../core/services/local-db.service';
import { FaturaStateService } from '../../core/services/fatura-state.service';
import { VoxFinanceApiService } from '../../core/services/vox-finance-api.service';

@Component({
  selector: 'app-faturas-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatTableModule],
  templateUrl: './faturas-list.component.html',
  styleUrl: './faturas-list.component.scss',
})
export class FaturasListComponent implements OnInit {
  carregando = false;
  reenviandoId: string | null = null;
  erro = '';
  sucesso = '';
  faturas: FaturaSalvaResumo[] = [];

  displayedColumns = ['competencia', 'banco', 'cartao', 'totalFatura', 'importedAt', 'acoes'];

  constructor(
    private readonly db: LocalDbService,
    private readonly faturaState: FaturaStateService,
    private readonly voxFinanceApi: VoxFinanceApiService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    void this.recarregar();
  }

  async recarregar(): Promise<void> {
    this.carregando = true;
    this.erro = '';
    this.sucesso = '';
    try {
      this.faturas = await this.db.listarFaturas();
    } catch {
      this.erro = 'Erro ao carregar faturas salvas.';
    } finally {
      this.carregando = false;
    }
  }

  async abrir(id: string): Promise<void> {
    await this.router.navigate(['/faturas', id]);
  }

  async editar(id: string): Promise<void> {
    await this.faturaState.carregarFaturaSalva(id);
    await this.router.navigate(['/importar'], { queryParams: { manter: '1' } });
  }

  async excluir(id: string): Promise<void> {
    const ok = confirm('Excluir esta fatura importada? Esta ação não pode ser desfeita.');
    if (!ok) return;

    try {
      await this.faturaState.excluirFaturaSalva(id);
      await this.recarregar();
    } catch {
      this.erro = 'Erro ao excluir fatura.';
    }
  }

  async reenviarParaApi(id: string): Promise<void> {
    this.erro = '';
    this.sucesso = '';
    this.reenviandoId = id;
    try {
      const f = await this.db.obterFatura(id);
      if (!f) {
        this.erro = 'Fatura não encontrada.';
        return;
      }
      await this.voxFinanceApi.enviarFaturaImportada(f);
      this.sucesso = 'Sincronizado com a API.';
    } catch {
      this.erro = 'Falha ao sincronizar com a API.';
    } finally {
      this.reenviandoId = null;
    }
  }
}

