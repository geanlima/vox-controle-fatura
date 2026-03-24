import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Chart, registerables } from 'chart.js';

import { FaturaStateService } from '../../core/services/fatura-state.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { LancamentoImportado } from '../../core/models/importacao-fatura.model';

Chart.register(...registerables);

interface ResumoCategoria {
  categoria: string;
  total: number;
  percentual: number;
  quantidade: number;
  ticketMedio: number;
}

export interface InsightAnalise {
  texto: string;
  tipo: 'info' | 'alerta' | 'ok';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements AfterViewInit {
  private faturaState = inject(FaturaStateService);
  private categoria = inject(CategoriaService);
  private router = inject(Router);

  categoriasOpcoes = this.categoria.listarNomesCategorias();

  @ViewChild('graficoCategorias') graficoCategoriasRef!: ElementRef<HTMLCanvasElement>;

  chart: Chart | null = null;

  fatura = this.faturaState.fatura;

  simulacaoAtiva = signal(false);
  simValorTexto = signal('');
  simDescricao = signal('');
  /** Vazio = classificar pela descrição */
  simCategoriaEscolha = signal('');

  /** Lançamentos reais + item sintético quando a simulação está ativa e o valor é válido */
  lancamentosCombinados = computed(() => {
    const base = this.fatura()?.lancamentos ?? [];
    if (!this.simulacaoAtiva()) {
      return base;
    }
    const v = this.parseValorEntrada(this.simValorTexto());
    if (v === null || Math.abs(v) < 0.005) {
      return base;
    }
    const desc = this.simDescricao().trim() || 'Compra simulada';
    const catManual = this.simCategoriaEscolha().trim();
    const cat = catManual || this.categoria.classificar(desc);

    const sintetico: LancamentoImportado = {
      data: '—',
      descricao: `[Simulação] ${desc}`,
      cidade: '',
      valor: v,
      moeda: 'BRL',
      tipo: 'outro',
      categoriaSugerida: cat,
      parcelaAtual: null,
      totalParcelas: null,
    };
    return [...base, sintetico];
  });

  totalLancamentos = computed(() => this.lancamentosCombinados().length);

  totalGasto = computed(() => {
    return this.lancamentosCombinados().reduce((acc, item) => acc + item.valor, 0);
  });

  totalGastoReal = computed(() => {
    const itens = this.fatura()?.lancamentos ?? [];
    return itens.reduce((acc, item) => acc + item.valor, 0);
  });

  deltaSimulacao = computed(() => this.totalGasto() - this.totalGastoReal());

  ticketMedio = computed(() => {
    const total = this.totalGasto();
    const qtd = this.totalLancamentos();
    return qtd > 0 ? total / qtd : 0;
  });

  resumoPorCategoria = computed<ResumoCategoria[]>(() => {
    const itens = this.lancamentosCombinados();
    const total = itens.reduce((acc, item) => acc + item.valor, 0);

    const mapa = new Map<string, { total: number; quantidade: number }>();

    for (const item of itens) {
      const categoria = item.categoriaSugerida || 'Outros';
      const atual = mapa.get(categoria) ?? { total: 0, quantidade: 0 };

      atual.total += item.valor;
      atual.quantidade += 1;

      mapa.set(categoria, atual);
    }

    return Array.from(mapa.entries())
      .map(([categoria, dados]) => ({
        categoria,
        total: dados.total,
        percentual: total > 0 ? dados.total / total : 0,
        quantidade: dados.quantidade,
        ticketMedio: dados.quantidade > 0 ? dados.total / dados.quantidade : 0,
      }))
      .sort((a, b) => b.total - a.total);
  });

  maiorCategoria = computed(() => this.resumoPorCategoria()[0] ?? null);

  /** Análise só sobre a fatura importada (sem simulação) */
  insights = computed<InsightAnalise[]>(() => {
    const itens = this.fatura()?.lancamentos ?? [];
    const total = itens.reduce((acc, i) => acc + i.valor, 0);
    if (total <= 0 || itens.length === 0) {
      return [];
    }

    const mapa = new Map<string, { total: number; qtd: number }>();
    for (const item of itens) {
      const c = item.categoriaSugerida || 'Outros';
      const atual = mapa.get(c) ?? { total: 0, qtd: 0 };
      atual.total += item.valor;
      atual.qtd += 1;
      mapa.set(c, atual);
    }

    const outros = mapa.get('Outros')?.total ?? 0;
    const pctOutros = outros / total;
    const lista = Array.from(mapa.entries()).sort((a, b) => b[1].total - a[1].total);
    const [topNome, topDados] = lista[0] ?? ['', { total: 0, qtd: 0 }];

    const ticketGeral = total / itens.length;
    const negativos = itens.filter((i) => i.valor < 0);
    const somaNeg = negativos.reduce((a, i) => a + i.valor, 0);

    const linhas: InsightAnalise[] = [];

    if (pctOutros >= 0.45) {
      linhas.push({
        tipo: 'alerta',
        texto: `Cerca de ${(pctOutros * 100).toFixed(0)}% dos gastos está em "Outros". Vale revisar descrições na importação e ajustar palavras-chave de categorias para enxergar melhor para onde vai o dinheiro.`,
      });
    } else if (pctOutros >= 0.3) {
      linhas.push({
        tipo: 'info',
        texto: `"Outros" representa ${(pctOutros * 100).toFixed(0)}% do total. Se possível, detalhe mais os lançamentos ou refine a classificação para priorizar melhorias.`,
      });
    }

    if (topNome && topNome !== 'Outros') {
      linhas.push({
        tipo: 'info',
        texto: `Maior concentração em "${topNome}" (${((topDados.total / total) * 100).toFixed(0)}%). Definir um teto mensal para essa categoria ajuda a manter o orçamento sob controle.`,
      });
    }

    if (ticketGeral > 250) {
      linhas.push({
        tipo: 'info',
        texto: `Ticket médio elevado (${ticketGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}). Compras parceladas ou itens isolados grandes podem estar puxando esse número.`,
      });
    }

    if (lista.length >= 4) {
      linhas.push({
        tipo: 'ok',
        texto: `Gastos distribuídos em ${lista.length} categorias — bom ponto de partida para comparar com meses anteriores.`,
      });
    }

    if (somaNeg < 0) {
      linhas.push({
        tipo: 'ok',
        texto: `Há lançamentos negativos (créditos/estornos) somando ${somaNeg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} — já reduzem o total da fatura.`,
      });
    }

    if (linhas.length === 0) {
      linhas.push({
        tipo: 'ok',
        texto: 'Revise categorias e totais abaixo e use a simulação para testar o impacto de uma compra antes de efetivá-la.',
      });
    }

    return linhas;
  });

  constructor() {
    effect(() => {
      const resumo = this.resumoPorCategoria();
      if (this.chart && resumo.length > 0) {
        this.atualizarGrafico();
      }
    });
  }

  ngAfterViewInit(): void {
    this.criarGrafico();
  }

  voltarImportacao(): void {
    this.router.navigate(['/importar']);
  }

  limparSimulacao(): void {
    this.simValorTexto.set('');
    this.simDescricao.set('');
    this.simCategoriaEscolha.set('');
    this.simulacaoAtiva.set(false);
  }

  private criarGrafico(): void {
    const canvas = this.graficoCategoriasRef?.nativeElement;
    if (!canvas) return;

    const resumo = this.resumoPorCategoria();

    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: resumo.map((x) => x.categoria),
        datasets: [
          {
            data: resumo.map((x) => x.total),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
          },
        },
      },
    });
  }

  private atualizarGrafico(): void {
    if (!this.chart) return;

    const resumo = this.resumoPorCategoria();

    this.chart.data.labels = resumo.map((x) => x.categoria);
    this.chart.data.datasets[0].data = resumo.map((x) => x.total);
    this.chart.update();
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
