import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';

import { FaturaStateService } from '../../core/services/fatura-state.service';
import { VoxFinanceApiService } from '../../core/services/vox-finance-api.service';

type FaturaLinha = {
  id: string;
  competencia: string;
  banco: string;
  cartao: string;
  totalFatura: number;
  importedAt: string;
};

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
  faturas: FaturaLinha[] = [];

  displayedColumns = ['competencia', 'banco', 'cartao', 'totalFatura', 'importedAt', 'acoes'];

  constructor(
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
      const rows = await this.voxFinanceApi.listarFaturas();
      this.faturas = rows.map((f) => ({
        id: f.id,
        competencia: f.competencia,
        banco: f.banco,
        cartao: f.cartao_nome_snapshot ?? '—',
        totalFatura: Number(f.total_fatura ?? 0),
        importedAt: f.imported_at,
      }));
    } catch {
      this.erro = 'Erro ao carregar faturas.';
    } finally {
      this.carregando = false;
    }
  }

  async abrir(id: string): Promise<void> {
    await this.router.navigate(['/faturas', id]);
  }

  async editar(id: string): Promise<void> {
    await this.faturaState.carregarFaturaDaApi(id);
    await this.router.navigate(['/importar'], { queryParams: { manter: '1' } });
  }

  async excluir(id: string): Promise<void> {
    const ok = confirm('Excluir esta fatura importada? Esta ação não pode ser desfeita.');
    if (!ok) return;

    try {
      await this.voxFinanceApi.excluirFatura(id);
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
      await this.voxFinanceApi.obterFatura(id);
      this.sucesso = 'Já está na API.';
    } catch {
      this.erro = 'Falha ao consultar a API.';
    } finally {
      this.reenviandoId = null;
    }
  }
}

