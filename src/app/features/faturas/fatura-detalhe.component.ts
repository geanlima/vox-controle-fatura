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

import { FaturaStateService } from '../../core/services/fatura-state.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { VoxFinanceApiService } from '../../core/services/vox-finance-api.service';

type ViewLancamento = {
  id: string;
  data: string;
  descricao: string;
  cidade: string;
  categoriaSugerida: string;
  valor: number;
  parcelaAtual: number | null;
  totalParcelas: number | null;
};

type ViewFatura = {
  id: string;
  banco: string;
  cartao: string;
  competencia: string;
  totalFatura: number;
  importedAt: string;
  updatedAt: string;
  lancamentos: ViewLancamento[];
};

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
  fatura: ViewFatura | null = null;
  private snapshotOriginal: ViewFatura | null = null;
  private removidos = new Set<string>();

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
    private readonly faturaState: FaturaStateService,
    private readonly categoria: CategoriaService,
    private readonly api: VoxFinanceApiService,
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
      const row = await this.api.obterFatura(id);
      this.fatura = {
        id: row.id,
        banco: row.banco,
        cartao: row.cartao_nome_snapshot ?? '—',
        competencia: row.competencia,
        totalFatura: Number(row.total_fatura ?? 0),
        importedAt: row.imported_at,
        updatedAt: row.updated_at,
        lancamentos: (row.lancamentos ?? []).map((l) => ({
          id: l.id,
          data: l.data,
          descricao: l.descricao,
          cidade: l.cidade ?? '',
          categoriaSugerida: l.categoria ?? 'Outros',
          valor: Number(l.valor ?? 0),
          parcelaAtual: l.parcela_atual ?? null,
          totalParcelas: l.total_parcelas ?? null,
        })),
      };
      this.removidos.clear();
      this.snapshotOriginal = structuredClone(this.fatura);
    } catch {
      this.erro = 'Erro ao carregar fatura.';
      this.snapshotOriginal = null;
    } finally {
      this.carregando = false;
    }
  }

  async abrirNoDashboard(): Promise<void> {
    if (!this.fatura) return;
    await this.faturaState.carregarFaturaDaApi(this.fatura.id);
    await this.router.navigate(['/dashboard']);
  }

  async editar(): Promise<void> {
    if (!this.fatura) return;
    await this.faturaState.carregarFaturaDaApi(this.fatura.id);
    await this.router.navigate(['/importar'], { queryParams: { manter: '1' } });
  }

  async excluir(): Promise<void> {
    if (!this.fatura) return;
    const ok = confirm('Excluir esta fatura importada? Esta ação não pode ser desfeita.');
    if (!ok) return;
    try {
      await this.api.excluirFatura(this.fatura.id);
      await this.router.navigate(['/faturas']);
    } catch {
      this.erro = 'Erro ao excluir fatura.';
    }
  }

  cancelarAlteracoes(): void {
    if (!this.snapshotOriginal) return;
    this.fatura = structuredClone(this.snapshotOriginal);
    this.removidos.clear();
    this.erro = '';
    this.sucesso = '';
  }

  async salvarAlteracoes(): Promise<void> {
    if (!this.fatura) return;

    this.salvando = true;
    this.erro = '';
    this.sucesso = '';

    try {
      // 1) aplica remoções (se houver)
      for (const id of Array.from(this.removidos)) {
        await this.api.excluirLancamento(id);
      }

      // 2) aplica patches em lançamentos alterados
      const original = this.snapshotOriginal;
      const origMap = new Map<string, ViewLancamento>();
      for (const l of original?.lancamentos ?? []) origMap.set(l.id, l);

      for (const l of this.fatura.lancamentos) {
        const base = origMap.get(l.id);
        if (!base) continue;
        const parcelado = this.comParcelamento(l.descricao, l.parcelaAtual, l.totalParcelas);
        l.parcelaAtual = parcelado.parcelaAtual;
        l.totalParcelas = parcelado.totalParcelas;

        const mudou =
          l.descricao !== base.descricao ||
          l.cidade !== base.cidade ||
          l.categoriaSugerida !== base.categoriaSugerida ||
          (l.parcelaAtual ?? null) !== (base.parcelaAtual ?? null) ||
          (l.totalParcelas ?? null) !== (base.totalParcelas ?? null);

        if (mudou) {
          await this.api.patchLancamento(l.id, {
            descricao: l.descricao,
            cidade: l.cidade,
            categoria: l.categoriaSugerida,
            parcela_atual: l.parcelaAtual ?? null,
            total_parcelas: l.totalParcelas ?? null,
          });
        }
      }

      await this.carregar(this.fatura.id);
      this.sucesso = 'Alterações salvas.';
    } catch {
      this.erro = 'Erro ao salvar alterações.';
    } finally {
      this.salvando = false;
    }
  }

  removerLancamento(item: ViewLancamento): void {
    if (!this.fatura) return;
    const idx = this.fatura.lancamentos.findIndex((x) => x.id === item.id);
    if (idx < 0) return;
    this.removidos.add(item.id);
    this.fatura.lancamentos = this.fatura.lancamentos.filter((x) => x.id !== item.id);
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

