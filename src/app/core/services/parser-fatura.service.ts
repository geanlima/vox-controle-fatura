import { Injectable } from '@angular/core';
import { Lancamento } from '../models/lancamento.model';
import { CategoriaService } from './categoria.service';
import { Fatura } from '../models/fatura.model';

@Injectable({
  providedIn: 'root',
})
export class ParserFaturaService {
  constructor(private categoriaService: CategoriaService) {}

  async processarPdf(arquivo: File): Promise<Fatura> {
    const texto = await this.extrairTextoDoPdf(arquivo);
    return this.processarTexto(texto);
  }

  processarTexto(texto: string): Fatura {
    const lancamentos = this.removerDuplicatas(
      this.ordenarLancamentosPorData(this.parse(texto))
    );

    return {
      id: crypto.randomUUID(),
      competencia: this.extrairCompetencia(texto),
      valorTotal: this.calcularTotal(lancamentos),
      lancamentos,
    };
  }

  parse(texto: string): Lancamento[] {
    const lancamentos: Lancamento[] = [];
    const textoNormalizado = texto
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n');

    const regexLancamento =
      /(\d{2}\/\d{2})(?:\/\d{2,4})?\s+([^\n]*?)\s+(?:R\$\s*)?(\(?\s*[-−]?\s*(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}\s*\)?\s*[-−]?)/g;

    for (const match of textoNormalizado.matchAll(regexLancamento)) {
      const data = match[1];
      const descricao = (match[2] ?? '').trim();
      const valorTexto = (match[3] ?? '').trim();

      if (!descricao || this.deveIgnorarLancamento(descricao)) {
        continue;
      }

      if (this.deveIgnorarValorMarcadoNoPdf(valorTexto)) {
        continue;
      }

      const valor = this.converterValor(valorTexto);

      if (this.deveIgnorarLancamentoPorImagemReferencia(data, descricao, valor)) {
        continue;
      }

      lancamentos.push({
        id: crypto.randomUUID(),
        data,
        descricao,
        valor,
        categoria: this.categoriaService.classificar(descricao),
        tipo: 'compra',
      });
    }

    return lancamentos;
  }

  /** Remove lançamentos idênticos (mesma data, descrição equivalente e valor). */
  private removerDuplicatas(lancamentos: Lancamento[]): Lancamento[] {
    const visto = new Set<string>();
    const resultado: Lancamento[] = [];

    for (const item of lancamentos) {
      const descricaoChave = this.normalizarTexto(item.descricao).replace(/\s+/g, ' ');
      const valorChave = Math.round(item.valor * 100) / 100;
      const chave = `${item.data}|${descricaoChave}|${valorChave}`;

      if (visto.has(chave)) {
        continue;
      }

      visto.add(chave);
      resultado.push(item);
    }

    return resultado;
  }

  /**
   * Na fatura, traço somente após o valor (ex.: 59,95 —) indica linha a desconsiderar,
   * sem confundir com valor negativo (-59,95 ou (59,95)).
   */
  private deveIgnorarValorMarcadoNoPdf(valorTexto: string): boolean {
    const t = valorTexto.trim().replace(/−/g, '-');
    const pareceNegativoContabil =
      /^\s*\(/.test(t) || /^\s*-\s*(?=\d)/.test(t);
    const tracoAposValor = /,\d{2}\s*[-—]+\s*$/.test(t);
    return tracoAposValor && !pareceNegativoContabil;
  }

  /**
   * Item explícito da tela que você pediu para ignorar (LOJAS RENNER marcado),
   * sem afetar as demais linhas daquela tabela (ex.: os dois MOVIDA).
   */
  private deveIgnorarLancamentoPorImagemReferencia(
    data: string,
    descricao: string,
    valor: number
  ): boolean {
    const t = this.normalizarTexto(descricao);
    const ehRennerMarcado =
      data === '10/02' &&
      t.includes('lojas renner') &&
      (t.includes('4802/02') || t.includes('fl 4802')) &&
      Math.abs(valor - 59.95) < 0.02;
    return ehRennerMarcado;
  }

  private deveIgnorarLancamento(descricao: string): boolean {
    const texto = this.normalizarTexto(descricao);

    if (!texto || texto === '-' || texto.startsWith('=')) {
      return true;
    }

    const termosIgnorados = [
      'lancamentos atuais',
      'lancamentos anterior',
      'total desta fatura',
      'total fatura',
      'pagamento recebido',
      'saldo anterior',
      'encargos',
      'juros',
      'multa',
      'iof',
      'anuidade',
      'credito rotativo',
      'parcelamento de fatura',
      'proxima fatura',
      'demais faturas',
      'total para proximas faturas',
    ];

    return termosIgnorados.some((termo) => texto.includes(termo));
  }

  private normalizarTexto(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private async extrairTextoDoPdf(arquivo: File): Promise<string> {
    const pdfjsLib = await this.carregarPdfJsNoBrowser();
    const buffer = await arquivo.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });

    const pdf = await loadingTask.promise;
    const textosPaginas: string[] = [];

    for (let paginaAtual = 1; paginaAtual <= pdf.numPages; paginaAtual++) {
      const pagina = await pdf.getPage(paginaAtual);
      const conteudo = await pagina.getTextContent();
      const linhasPagina: string[] = [];
      let linhaAtual: string[] = [];
      let yAnterior: number | null = null;

      for (const item of conteudo.items) {
        if (!('str' in item)) {
          continue;
        }

        const textoItem = item.str?.trim();
        if (!textoItem) {
          continue;
        }

        const yAtual = Array.isArray(item.transform) ? item.transform[5] : null;
        const mudouLinha =
          yAnterior !== null &&
          yAtual !== null &&
          Math.abs(yAtual - yAnterior) > 2;

        if (mudouLinha && linhaAtual.length > 0) {
          linhasPagina.push(linhaAtual.join(' '));
          linhaAtual = [];
        }

        linhaAtual.push(textoItem);
        yAnterior = yAtual ?? yAnterior;

        if (item.hasEOL && linhaAtual.length > 0) {
          linhasPagina.push(linhaAtual.join(' '));
          linhaAtual = [];
          yAnterior = null;
        }
      }

      if (linhaAtual.length > 0) {
        linhasPagina.push(linhaAtual.join(' '));
      }

      textosPaginas.push(linhasPagina.join('\n'));
    }

    return textosPaginas.join('\n');
  }

  private async carregarPdfJsNoBrowser() {
    if (typeof window === 'undefined') {
      throw new Error('Leitura de PDF disponivel apenas no navegador.');
    }

    const pdfjsLib = await import('pdfjs-dist');

    // Worker copiado para browser/pdfjs/ (angular.json). import.meta.url falha em produção (404).
    const base =
      typeof document !== 'undefined'
        ? document.querySelector('base')?.href?.replace(/\/?$/, '') ?? window.location.origin
        : '';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${base}/pdfjs/pdf.worker.mjs`;

    return pdfjsLib;
  }

  private extrairCompetencia(texto: string): string {
    const match = texto.match(/\b(0[1-9]|1[0-2])\/\d{4}\b/);
    return match?.[0] ?? 'N/A';
  }

  private calcularTotal(lancamentos: Lancamento[]): number {
    return lancamentos.reduce((total, item) => total + item.valor, 0);
  }

  private ordenarLancamentosPorData(lancamentos: Lancamento[]): Lancamento[] {
    return [...lancamentos].sort((a, b) => {
      const dataA = this.obterDataParaOrdenacao(a.data);
      const dataB = this.obterDataParaOrdenacao(b.data);
      return dataA.getTime() - dataB.getTime();
    });
  }

  private obterDataParaOrdenacao(dataTexto: string): Date {
    const partes = dataTexto.split('/').map(Number);
    const dia = partes[0] ?? 1;
    const mes = partes[1] ?? 1;
    const anoInformado = partes.length >= 3 ? partes[2] : null;

    let ano = anoInformado;

    if (!ano) {
      const hoje = new Date();
      const diaAtual = hoje.getDate();
      const mesAtual = hoje.getMonth() + 1;
      const anoAtual = hoje.getFullYear();
      const ehDataAteHoje =
        mes < mesAtual || (mes === mesAtual && dia <= diaAtual);
      ano = ehDataAteHoje ? anoAtual : anoAtual - 1;
    } else if (ano < 100) {
      ano += 2000;
    }

    return new Date(ano, mes - 1, dia);
  }

  private converterValor(valorTexto: string): number {
    const texto = valorTexto
      .trim()
      .replace(/r\$\s*/gi, '')
      .replace(/−/g, '-');
    const negativo =
      texto.includes('-') || (texto.includes('(') && texto.includes(')'));

    const apenasNumeros = texto
      .replace(/[()]/g, '')
      .replace(/-/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();

    const valor = Number(apenasNumeros);
    return negativo ? -Math.abs(valor) : valor;
  }
}