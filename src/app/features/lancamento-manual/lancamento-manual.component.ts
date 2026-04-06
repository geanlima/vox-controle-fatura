import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { CategoriaService } from '../../core/services/categoria.service';
import { CartaoCreditoResumo } from '../../core/services/local-db.service';
import { VoxFinanceApiService } from '../../core/services/vox-finance-api.service';
import { LancamentoImportado } from '../../core/models/importacao-fatura.model';

@Component({
  selector: 'app-lancamento-manual',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
  ],
  templateUrl: './lancamento-manual.component.html',
  styleUrl: './lancamento-manual.component.scss',
})
export class LancamentoManualComponent implements OnInit {
  private readonly api = inject(VoxFinanceApiService);
  private readonly categoria = inject(CategoriaService);

  erro = signal('');
  sucesso = signal('');
  carregando = signal(false);

  cartoes = signal<CartaoCreditoResumo[]>([]);
  competencias = signal<string[]>([]);

  cartaoId = signal('');
  competencia = signal('');
  faturaId = signal<string | null>(null);

  fatura = signal<{ banco: string; cartao: string; competencia: string; totalFatura: number; lancamentos: LancamentoImportado[] } | null>(
    null,
  );

  data = signal('');
  descricao = signal('');
  cidade = signal('');
  valor = signal('');

  displayedColumns = ['data', 'descricao', 'cidade', 'categoriaSugerida', 'valor', 'acoes'];

  podeCarregar = computed(() => !!this.cartaoId().trim() && !!this.competencia().trim());
  podeAdicionar = computed(() => !!this.fatura() && !!this.descricao().trim() && !!this.valor().trim() && /^\d{2}\/\d{2}$/.test(this.data().trim()));

  async ngOnInit(): Promise<void> {
    await this.carregarCartoes();
  }

  private async carregarCartoes(): Promise<void> {
    try {
      const cartoes = await this.api.listarCartoes();
      this.cartoes.set(
        cartoes.map((c) => ({
          id: c.id,
          nome: c.nome,
          bandeira: c.bandeira ?? undefined,
          ultimos4: c.ultimos4 ?? undefined,
          layoutId: c.layout_id ?? undefined,
        })),
      );
    } catch {
      this.cartoes.set([]);
    }
  }

  async onCartaoChange(): Promise<void> {
    this.erro.set('');
    this.sucesso.set('');
    this.competencia.set('');
    this.competencias.set([]);
    this.fatura.set(null);
    this.faturaId.set(null);

    const id = this.cartaoId().trim();
    if (!id) return;

    try {
      const faturas = await this.api.listarFaturas({ cartao_id: id });
      const set = new Set<string>();
      for (const f of faturas) if (f.competencia) set.add(f.competencia);
      const comps = Array.from(set);
      comps.sort((a, b) => {
        const pa = a.split('/').map((x) => Number(x));
        const pb = b.split('/').map((x) => Number(x));
        const ma = pa[0] ?? 0;
        const ya = pa[1] ?? 0;
        const mb = pb[0] ?? 0;
        const yb = pb[1] ?? 0;
        if (ya !== yb) return yb - ya;
        return mb - ma;
      });
      this.competencias.set(comps);
      if (comps.length) {
        this.competencia.set(comps[0] ?? '');
      }
    } catch {
      this.competencias.set([]);
    }
  }

  async carregarFatura(): Promise<void> {
    if (!this.podeCarregar()) return;
    this.carregando.set(true);
    this.erro.set('');
    this.sucesso.set('');
    try {
      const rows = await this.api.listarFaturas({ cartao_id: this.cartaoId().trim(), competencia: this.competencia().trim() });
      const row = rows[0];
      if (!row?.id) {
        this.fatura.set(null);
        this.faturaId.set(null);
        this.erro.set('Fatura não encontrada para este cartão/mês.');
        return;
      }
      this.faturaId.set(row.id);
      this.fatura.set({
        banco: row.banco,
        cartao: row.cartao_nome_snapshot ?? '',
        competencia: row.competencia,
        totalFatura: Number(row.total_fatura ?? 0),
        lancamentos: (row.lancamentos ?? []).map((l) => ({
          data: l.data,
          descricao: l.descricao,
          cidade: l.cidade ?? '',
          valor: Number(l.valor ?? 0),
          moeda: l.moeda ?? 'BRL',
          tipo: 'outro',
          categoriaSugerida: l.categoria ?? 'Outros',
          parcelaAtual: l.parcela_atual ?? null,
          totalParcelas: l.total_parcelas ?? null,
        })),
      });
    } catch {
      this.erro.set('Erro ao carregar fatura.');
    } finally {
      this.carregando.set(false);
    }
  }

  async adicionar(): Promise<void> {
    const f = this.fatura();
    const id = this.faturaId();
    if (!f || !id) return;

    this.erro.set('');
    this.sucesso.set('');

    const data = this.data().trim();
    if (!/^\d{2}\/\d{2}$/.test(data)) {
      this.erro.set('Informe a data no formato DD/MM.');
      return;
    }
    const desc = this.descricao().trim();
    if (!desc) {
      this.erro.set('Informe a descrição.');
      return;
    }
    const v = this.parseValorEntrada(this.valor());
    if (v === null) {
      this.erro.set('Informe um valor válido (ex.: 150,90 ou -20,00).');
      return;
    }

    const item: LancamentoImportado = {
      data,
      descricao: desc,
      cidade: this.cidade().trim(),
      valor: v,
      moeda: 'BRL',
      tipo: 'outro',
      categoriaSugerida: this.categoria.classificar(desc),
      parcelaAtual: null,
      totalParcelas: null,
    };

    this.carregando.set(true);
    try {
      await this.api.criarLancamento(id, {
        data: item.data,
        descricao: item.descricao,
        cidade: item.cidade ?? '',
        categoria: item.categoriaSugerida ?? 'Outros',
        valor: Number(item.valor),
        moeda: item.moeda ?? 'BRL',
        parcela_atual: item.parcelaAtual ?? null,
        total_parcelas: item.totalParcelas ?? null,
      });
      await this.carregarFatura();
      this.data.set('');
      this.descricao.set('');
      this.cidade.set('');
      this.valor.set('');
      this.sucesso.set('Lançamento adicionado.');
    } catch {
      this.erro.set('Erro ao salvar lançamento.');
    } finally {
      this.carregando.set(false);
    }
  }

  async remover(item: LancamentoImportado): Promise<void> {
    const id = this.faturaId();
    if (!id) return;
    // A tela manual não tem o ID do lançamento (porque antes era Dexie).
    // Por enquanto, recarregamos a fatura e removemos pelo primeiro match (data/descricao/valor).
    // Se preferir, posso exibir o ID e usar direto.
    const atual = await this.api.obterFatura(id);
    const alvo = (atual.lancamentos ?? []).find(
      (l) => l.data === item.data && l.descricao === item.descricao && Number(l.valor) === Number(item.valor),
    );
    if (!alvo) return;

    this.carregando.set(true);
    this.erro.set('');
    this.sucesso.set('');
    try {
      await this.api.excluirLancamento(alvo.id);
      await this.carregarFatura();
      this.sucesso.set('Lançamento removido.');
    } catch {
      this.erro.set('Erro ao remover lançamento.');
    } finally {
      this.carregando.set(false);
    }
  }

  private parseValorEntrada(texto: string): number | null {
    const t = texto.trim().replace(/\s/g, '').replace(/r\$/gi, '').replace(/−/g, '-');
    if (!t) return null;

    const negativo = t.includes('-') || (t.includes('(') && t.includes(')'));
    const limpo = t.replace(/[()]/g, '').replace(/-/g, '');
    const partes = limpo.split(',');

    let numero: number;
    if (partes.length === 1) {
      numero = Number(limpo.replace(/\./g, '').replace(',', '.'));
    } else if (partes.length === 2) {
      const inteiros = partes[0].replace(/\./g, '');
      const dec = partes[1];
      numero = Number(`${inteiros}.${dec}`);
    } else {
      return null;
    }

    if (Number.isNaN(numero)) return null;
    return negativo ? -Math.abs(numero) : numero;
  }
}

