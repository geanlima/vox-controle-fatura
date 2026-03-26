import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { LocalDbService, FaturaSalva } from '../../core/services/local-db.service';
import { FaturaStateService } from '../../core/services/fatura-state.service';
import { CategoriaService } from '../../core/services/categoria.service';

@Component({
  selector: 'app-fatura-detalhe',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './fatura-detalhe.component.html',
  styleUrl: './fatura-detalhe.component.scss',
})
export class FaturaDetalheComponent implements OnInit {
  carregando = false;
  salvando = false;
  erro = '';
  sucesso = '';
  fatura: FaturaSalva | null = null;
  private snapshotOriginal: FaturaSalva | null = null;

  displayedColumns = [
    'data',
    'descricao',
    'cidade',
    'categoriaSugerida',
    'parcelaAtual',
    'totalParcelas',
    'valor',
    'acoes',
  ];
  categorias: string[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly db: LocalDbService,
    private readonly faturaState: FaturaStateService,
    private readonly categoria: CategoriaService
  ) {
    this.categorias = this.categoria.listarNomesCategorias();
  }

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
    this.sucesso = '';
    try {
      this.fatura = await this.db.obterFatura(id);
      if (!this.fatura) {
        this.erro = 'Fatura não encontrada.';
        this.snapshotOriginal = null;
      } else {
        this.snapshotOriginal = structuredClone(this.fatura);
      }
    } catch {
      this.erro = 'Erro ao carregar fatura.';
      this.snapshotOriginal = null;
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

  cancelarAlteracoes(): void {
    if (!this.snapshotOriginal) return;
    this.fatura = structuredClone(this.snapshotOriginal);
    this.erro = '';
    this.sucesso = '';
  }

  async salvarAlteracoes(): Promise<void> {
    if (!this.fatura) return;

    this.salvando = true;
    this.erro = '';
    this.sucesso = '';

    try {
      const total = this.fatura.lancamentos.reduce((acc, l) => acc + (l.valor ?? 0), 0);
      const patch = {
        banco: this.fatura.banco,
        cartao: this.fatura.cartao,
        competencia: this.fatura.competencia,
        totalFatura: total,
        lancamentos: this.fatura.lancamentos.map((l) => ({
          ...l,
          descricao: (l.descricao ?? '').toString(),
          categoriaSugerida: (l.categoriaSugerida ?? '').toString(),
          ...this.comParcelamento((l.descricao ?? '').toString(), l.parcelaAtual, l.totalParcelas),
        })),
        cartaoId: this.fatura.cartaoId ?? null,
      };

      await this.db.atualizarFatura(this.fatura.id, patch);
      await this.carregar(this.fatura.id);
      this.sucesso = 'Alterações salvas.';
    } catch {
      this.erro = 'Erro ao salvar alterações.';
    } finally {
      this.salvando = false;
    }
  }

  removerLancamento(item: { valor: number } & object): void {
    if (!this.fatura) return;
    const idx = this.fatura.lancamentos.indexOf(item as any);
    if (idx < 0) return;
    this.fatura.lancamentos = this.fatura.lancamentos.filter((_, i) => i !== idx);
    const total = this.fatura.lancamentos.reduce((acc, l) => acc + (l.valor ?? 0), 0);
    this.fatura.totalFatura = total;
    this.sucesso = '';
  }

  private comParcelamento(
    descricao: string,
    parcelaAtual: number | null | undefined,
    totalParcelas: number | null | undefined
  ): { parcelaAtual: number | null; totalParcelas: number | null } {
    const p = this.extrairParcelamento(descricao);
    if (!p) {
      return {
        parcelaAtual: parcelaAtual ?? null,
        totalParcelas: totalParcelas ?? null,
      };
    }
    return { parcelaAtual: p.parcelaAtual, totalParcelas: p.totalParcelas };
  }

  private extrairParcelamento(descricao: string): { parcelaAtual: number; totalParcelas: number } | null {
    const d = (descricao || '').toString();
    const m = d.match(/(^|\D)(\d{1,2})\s*\/\s*(\d{1,2})(\D|$)/);
    if (!m) return null;
    const atual = Number(m[2]);
    const total = Number(m[3]);
    if (!Number.isFinite(atual) || !Number.isFinite(total)) return null;
    if (atual < 1 || total < 2) return null;
    if (atual > total) return null;
    if (total > 60) return null;
    return { parcelaAtual: atual, totalParcelas: total };
  }
}

