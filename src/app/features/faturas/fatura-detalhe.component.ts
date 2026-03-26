import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';

import { LocalDbService, FaturaSalva } from '../../core/services/local-db.service';
import { FaturaStateService } from '../../core/services/fatura-state.service';

@Component({
  selector: 'app-fatura-detalhe',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatTableModule],
  templateUrl: './fatura-detalhe.component.html',
  styleUrl: './fatura-detalhe.component.scss',
})
export class FaturaDetalheComponent implements OnInit {
  carregando = false;
  erro = '';
  fatura: FaturaSalva | null = null;

  displayedColumns = ['data', 'descricao', 'cidade', 'categoriaSugerida', 'valor'];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly db: LocalDbService,
    private readonly faturaState: FaturaStateService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.erro = 'ID da fatura inválido.';
      return;
    }
    void this.carregar(id);
  }

  async carregar(id: string): Promise<void> {
    this.carregando = true;
    this.erro = '';
    try {
      this.fatura = await this.db.obterFatura(id);
      if (!this.fatura) {
        this.erro = 'Fatura não encontrada.';
      }
    } catch {
      this.erro = 'Erro ao carregar fatura.';
    } finally {
      this.carregando = false;
    }
  }

  async abrirNoDashboard(): Promise<void> {
    if (!this.fatura) return;
    await this.faturaState.carregarFaturaSalva(this.fatura.id);
    await this.router.navigate(['/dashboard']);
  }

  async editar(): Promise<void> {
    if (!this.fatura) return;
    await this.faturaState.carregarFaturaSalva(this.fatura.id);
    await this.router.navigate(['/importar'], { queryParams: { manter: '1' } });
  }

  async excluir(): Promise<void> {
    if (!this.fatura) return;
    const ok = confirm('Excluir esta fatura importada? Esta ação não pode ser desfeita.');
    if (!ok) return;
    try {
      await this.faturaState.excluirFaturaSalva(this.fatura.id);
      await this.router.navigate(['/faturas']);
    } catch {
      this.erro = 'Erro ao excluir fatura.';
    }
  }
}

