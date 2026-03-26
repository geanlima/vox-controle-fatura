import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ImportacaoFaturaApiService } from '../../core/services/importacao-fatura-api.service';
import { FaturaImportada, LancamentoImportado } from '../../core/models/importacao-fatura.model';
import { FaturaStateService } from '../../core/services/fatura-state.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { CartaoCreditoResumo, LayoutParserTipo, LocalDbService } from '../../core/services/local-db.service';

@Component({
  selector: 'app-importar-fatura',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './importar-fatura.component.html',
  styleUrl: './importar-fatura.component.scss',
})
export class ImportarFaturaComponent implements OnInit {
  arquivoSelecionado: File | null = null;
  carregando = false;
  erro = '';
  sucesso = '';
  resultado: FaturaImportada | null = null;

  cartoes: CartaoCreditoResumo[] = [];
  cartaoSelecionadoId = '';

  displayedColumns = [
    'data',
    'descricao',
    'cidade',
    'categoriaSugerida',
    'valor',
    'revisao',
    'acoes',
  ];

  constructor(
    private api: ImportacaoFaturaApiService,
    private faturaState: FaturaStateService,
    private categoria: CategoriaService,
    private localDb: LocalDbService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    void this.carregarCartoes();

    // Por padrão a tela de importação abre vazia.
    // Só mantemos o estado quando viemos de "Editar" (fatura salva) via query param.
    const manter = this.route.snapshot.queryParamMap.get('manter') === '1';
    if (!manter) {
      this.faturaState.limpar();
      this.resultado = null;
      this.cartaoSelecionadoId = '';
      this.arquivoSelecionado = null;
      return;
    }

    const salva = this.faturaState.fatura();
    if (salva) {
      this.resultado = {
        ...salva,
        lancamentos: salva.lancamentos.map((l) => ({ ...l })),
      };
      this.cartaoSelecionadoId = (salva.cartaoId ?? '') || '';
    }
  }

  private async carregarCartoes(): Promise<void> {
    try {
      this.cartoes = await this.localDb.listarCartoes();
    } catch {
      this.cartoes = [];
    }
  }

  private getCartaoSelecionado(): CartaoCreditoResumo | null {
    const id = this.cartaoSelecionadoId?.trim();
    if (!id) return null;
    return this.cartoes.find((c) => c.id === id) ?? null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.arquivoSelecionado = input.files?.[0] ?? null;
    this.erro = '';
  }

  async importarPdf(): Promise<void> {
    const cartao = this.getCartaoSelecionado();
    if (!cartao) {
      this.erro = 'Selecione um cartão antes de importar.';
      return;
    }
    if (!this.arquivoSelecionado) {
      this.erro = 'Selecione um PDF.';
      return;
    }

    this.carregando = true;
    this.erro = '';
    this.sucesso = '';

    let layout: LayoutParserTipo = 'itau';
    if (cartao.layoutId) {
      try {
        const l = await this.localDb.obterLayout(cartao.layoutId);
        if (l) {
          layout = l.tipo;
        }
      } catch {
        // fallback itau
      }
    }

    this.api.importarPdf(this.arquivoSelecionado, layout).subscribe({
      next: (res: FaturaImportada) => {
        this.resultado = {
          ...res,
          cartao: cartao.nome,
          cartaoId: cartao.id,
        };
        this.recalcularTotal();
        this.sincronizarEstado();
        this.carregando = false;
      },
      error: (err: unknown) => {
        const message =
          err &&
          typeof err === 'object' &&
          'error' in err &&
          err.error &&
          typeof err.error === 'object' &&
          'message' in err.error &&
          typeof (err.error as { message: unknown }).message === 'string'
            ? (err.error as { message: string }).message
            : null;
        this.erro = message ?? 'Erro ao importar a fatura.';
        this.sucesso = '';
        this.carregando = false;
      },
    });
  }

  removerLancamento(item: LancamentoImportado): void {
    if (!this.resultado) return;
    const idx = this.resultado.lancamentos.indexOf(item);
    if (idx < 0) return;
    this.resultado.lancamentos = this.resultado.lancamentos.filter((_, i) => i !== idx);
    this.recalcularTotal();
    this.sincronizarEstado();
    this.sucesso = '';
  }

  private recalcularTotal(): void {
    if (!this.resultado) return;
    this.resultado.totalFatura = this.resultado.lancamentos.reduce((acc, l) => acc + l.valor, 0);
  }

  private sincronizarEstado(): void {
    if (this.resultado) {
      this.faturaState.definirFatura({ ...this.resultado });
    }
  }

  async salvarFatura(): Promise<void> {
    this.erro = '';
    this.sucesso = '';

    const cartao = this.getCartaoSelecionado();
    if (!cartao) {
      this.erro = 'Selecione um cartão antes de salvar.';
      return;
    }
    if (!this.resultado || this.resultado.lancamentos.length === 0) {
      this.erro = 'Não há lançamentos para salvar.';
      return;
    }

    // garante que o cartão escolhido esteja refletido no objeto salvo
    this.resultado.cartao = cartao.nome;
    this.resultado.cartaoId = cartao.id;
    this.sincronizarEstado();

    try {
      await this.faturaState.salvarFaturaAtual();
      this.sucesso = 'Fatura salva com sucesso.';
    } catch {
      this.erro = 'Erro ao salvar a fatura.';
    }
  }

  private parseValorEntrada(texto: string): number | null {
    const t = texto.trim().replace(/\s/g, '').replace(/r\$/gi, '').replace(/−/g, '-');
    if (!t) return null;

    const negativo =
      t.includes('-') || (t.includes('(') && t.includes(')'));

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

  isValorNegativo(valor: number): boolean {
    return valor < 0;
  }

  temLancamentos(): boolean {
    return (this.resultado?.lancamentos.length ?? 0) > 0;
  }

  /** Mesma data (DD/MM) e mesmo valor — pode ser duplicidade do PDF ou compras coincidindo. */
  ehPossivelDuplicataDataValor(item: LancamentoImportado): boolean {
    if (!this.resultado?.lancamentos.length) {
      return false;
    }
    const chave = this.chaveDataValor(item);
    let ocorrencias = 0;
    for (const l of this.resultado.lancamentos) {
      if (this.chaveDataValor(l) === chave) {
        ocorrencias++;
      }
    }
    return ocorrencias > 1;
  }

  /** Quantidade de lançamentos que entram em algum grupo repetido (data + valor). */
  contagemLancamentosDuplicados(): number {
    if (!this.resultado?.lancamentos.length) {
      return 0;
    }
    const mapa = new Map<string, number>();
    for (const l of this.resultado.lancamentos) {
      const k = this.chaveDataValor(l);
      mapa.set(k, (mapa.get(k) ?? 0) + 1);
    }
    let total = 0;
    for (const c of mapa.values()) {
      if (c > 1) {
        total += c;
      }
    }
    return total;
  }

  temPossivelDuplicata(): boolean {
    return this.contagemLancamentosDuplicados() > 0;
  }

  private chaveDataValor(l: LancamentoImportado): string {
    return `${l.data}|${Math.round(l.valor * 100)}`;
  }

  irParaDashboard(): void {
    if (this.resultado) {
      this.sincronizarEstado();
    }
    this.router.navigate(['/dashboard']);
  }
}
