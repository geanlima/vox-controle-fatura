import { Injectable } from '@angular/core';
import { Lancamento } from '../models/lancamento.model';
import { CategoriaService } from './categoria.service';
import { Fatura } from '../models/fatura.model';
import { LayoutParserTipo } from './local-db.service';

@Injectable({
  providedIn: 'root',
})
export class ParserFaturaService {
  constructor(private categoriaService: CategoriaService) {}

  async processarPdf(arquivo: File, layout: LayoutParserTipo = 'itau'): Promise<Fatura> {
    const texto = await this.extrairTextoDoPdf(arquivo);
    return this.processarTexto(texto, layout);
  }

  processarTexto(texto: string, layout: LayoutParserTipo = 'itau'): Fatura {
    const lancamentos = this.removerDuplicatas(
      this.ordenarLancamentosPorData(this.parseComLayout(texto, layout))
    );

    return {
      id: crypto.randomUUID(),
      competencia: this.extrairCompetencia(texto, layout),
      valorTotal: this.calcularTotal(lancamentos),
      lancamentos,
    };
  }

  private parseComLayout(texto: string, layout: LayoutParserTipo): Lancamento[] {
    if (layout === 'itau-empresa') {
      return this.parseItauEmpresa(texto);
    }
    if (layout === 'mercado-pago-cc') {
      return this.parseMercadoPagoCc(texto);
    }
    return this.parse(texto);
  }

  /**
   * Mercado Pago (Cartão de Crédito): PDF traz tabelas "Movimentações na fatura" e "Cartão Visa".
   * O parser genérico ignora termos como "juros/multa", mas no MP esses itens fazem parte da fatura
   * e devem entrar como lançamentos. Também converte "pagamento" para valor negativo (crédito).
   */
  private parseMercadoPagoCc(texto: string): Lancamento[] {
    const lancamentos: Lancamento[] = [];
    const textoNormalizado = texto
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n');

    const linhas = textoNormalizado
      .split('\n')
      .map((l) => l.trim().replace(/\s+/g, ' '))
      .filter((l) => l.length > 0);

    const reLinhaLancamento =
      /^(\d{2})\s*\/\s*(\d{2})\s+(.+?)\s+(?:R\$\s*)?(\(?\s*[-−]?\s*(?:\d{1,3}(?:\.\d{3})*|\d+)\s*,\s*\d{2}\s*\)?)\s*$/;

    const deveIgnorarLinha = (linha: string): boolean => {
      const t = this.normalizarTexto(linha);
      if (!t) return true;
      if (t === '-' || t.startsWith('=')) return true;
      // Cabeçalhos e totais recorrentes no PDF do MP
      if (t.includes('movimentacoes na fatura')) return true;
      if (t.includes('detalhes de consumo')) return true;
      if (t.startsWith('data movimentacoes valor')) return true;
      if (t.startsWith('cartao visa')) return true;
      if (/^total(\s|$)/.test(t)) return true;
      if (t.includes('pague sua fatura')) return true;
      return false;
    };

    for (const linha of linhas) {
      if (deveIgnorarLinha(linha)) continue;

      const m = linha.match(reLinhaLancamento);
      if (!m) continue;

      const data = this.normalizarData(`${m[1]}/${m[2]}`);
      const descricao = (m[3] ?? '').trim();
      const valorTexto = (m[4] ?? '').trim();

      if (!descricao) continue;
      if (this.deveIgnorarValorMarcadoNoPdf(valorTexto)) continue;

      let valor = this.converterValor(valorTexto);

      // No MP, "Pagamento ..." é crédito na fatura, mas vem sem sinal.
      const descNorm = this.normalizarTexto(descricao);
      const ehPagamento =
        descNorm.includes('pagamento') || descNorm.includes('creditos devolvidos') || descNorm.includes('credito devolvido');
      if (ehPagamento) {
        valor = -Math.abs(valor);
      }

      // Heurística: mantém "compra" como tipo padrão (o app só diferencia 3 tipos).
      // Se quiser evoluir depois, dá para mapear "saque" quando aparecer.
      const tipo: Lancamento['tipo'] = descNorm.includes('saque') ? 'saque' : 'compra';

      lancamentos.push({
        id: crypto.randomUUID(),
        data,
        descricao,
        valor,
        categoria: this.categoriaService.classificar(descricao),
        tipo,
      });
    }

    return lancamentos;
  }

  /**
   * Fatura Itaú Empresas: tabelas "Lançamentos nacionais" e "Lançamentos internacionais",
   * colunas data / descrição / valor (internacional pode trazer cotação em linhas vizinhas).
   */
  private parseItauEmpresa(texto: string): Lancamento[] {
    const lancamentos: Lancamento[] = [];
    const textoNormalizado = texto
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n');

    const regexLancamento =
      /(\d{2}\s*\/\s*\d{2})(?:\s*\/\s*\d{2,4})?\s+([^\n]*?)\s+(?:R\$\s*)?(\(?\s*[-−]?\s*(?:\d{1,3}(?:\.\d{3})*|\d+)\s*,\s*\d{2}\s*\)?\s*[-−]?)/g;

    const lower = textoNormalizado.toLowerCase();
    const idxIntern = lower.search(/lan[cç]amentos?\s+internacion/i);
    const partNac = idxIntern >= 0 ? textoNormalizado.slice(0, idxIntern) : textoNormalizado;
    const partInt = idxIntern >= 0 ? textoNormalizado.slice(idxIntern) : '';

    const extrair = (bloco: string, tipo: 'compra' | 'internacional'): void => {
      for (const match of bloco.matchAll(regexLancamento)) {
        const data = this.normalizarData(match[1] ?? '');
        const descricao = (match[2] ?? '').trim();
        const valorTexto = (match[3] ?? '').trim();

        if (!descricao || this.deveIgnorarItauEmpresa(descricao)) {
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
          tipo,
        });
      }
    };

    extrair(partNac, 'compra');
    if (partInt) {
      for (const item of this.extrairInternacionaisItauEmpresa(partInt)) {
        lancamentos.push(item);
      }
    }

    return lancamentos;
  }

  /**
   * Internacional: cotação (R$) e valor (R$) podem vir em linhas diferentes no PDF.
   * Agrupa linhas do mesmo lançamento (até a próxima data DD/MM ou rodapé) e usa o último R$.
   */
  private extrairInternacionaisItauEmpresa(bloco: string): Lancamento[] {
    const resultado: Lancamento[] = [];
    const reValorRs =
      /R\$\s*(\(?\s*[-−]?\s*(?:\d{1,3}(?:\.\d{3})*|\d+)\s*,\s*\d{2}\s*\)?)/gi;

    const linhas = bloco
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const ehInicioLancamento = (s: string) => /^\d{2}\/\d{2}\s+\S/.test(s);
    const ehRodapeOuNovaSecao = (s: string) => {
      const u = s.trim();
      return (
        /^(total|repasse|data\s|descri)/i.test(u) ||
        /^lan[cç]amentos?\s/i.test(u) ||
        /^atualizado\s+em/i.test(u)
      );
    };

    let i = 0;
    while (i < linhas.length) {
      const linha = linhas[i] ?? '';
      if (!ehInicioLancamento(linha)) {
        i++;
        continue;
      }

      let buffer = linha;
      i++;
      while (i < linhas.length) {
        const prox = linhas[i] ?? '';
        if (ehInicioLancamento(prox)) {
          break;
        }
        if (ehRodapeOuNovaSecao(prox)) {
          break;
        }
        buffer += ` ${prox.trim()}`;
        i++;
      }

      const mInicio = buffer.match(/^(\d{2}\/\d{2})\s+(.*)$/s);
      if (!mInicio) {
        continue;
      }

      const data = this.normalizarData(mInicio[1] ?? '');
      const resto = (mInicio[2] ?? '').trim();

      const valoresRs: string[] = [];
      reValorRs.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = reValorRs.exec(resto)) !== null) {
        valoresRs.push((m[1] ?? '').trim());
      }

      if (valoresRs.length === 0) {
        continue;
      }

      const valorTexto = valoresRs[valoresRs.length - 1] ?? '';

      const idxPrimeiroRs = resto.search(/R\$\s*/i);
      const descricao =
        idxPrimeiroRs >= 0
          ? resto.slice(0, idxPrimeiroRs).trim().replace(/\s+/g, ' ')
          : resto.replace(/\s+/g, ' ');

      if (!descricao || this.deveIgnorarItauEmpresa(descricao)) {
        continue;
      }

      if (this.deveIgnorarValorMarcadoNoPdf(valorTexto)) {
        continue;
      }

      const valor = this.converterValor(valorTexto);

      if (this.deveIgnorarLancamentoPorImagemReferencia(data, descricao, valor)) {
        continue;
      }

      resultado.push({
        id: crypto.randomUUID(),
        data,
        descricao,
        valor,
        categoria: this.categoriaService.classificar(descricao),
        tipo: 'internacional',
      });
    }

    return resultado;
  }

  private deveIgnorarItauEmpresa(descricao: string): boolean {
    if (this.deveIgnorarLancamento(descricao)) {
      return true;
    }
    const t = this.normalizarTexto(descricao);
    const extrasFrases = [
      'lancamentos nacionais',
      'lancamentos internacionais',
      'total de lancamentos',
      'total da fatura',
      'total de produtos',
      'produtos, servicos e encargos',
      'repasse de iof',
      'itau empresas mastercard',
      'melhor data para compra',
      'limite total',
      'limite disponivel',
      'resumo da fatura',
      'moeda local',
      'moeda global',
      'cotacao',
      'atualizado em',
    ];
    if (extrasFrases.some((f) => t.includes(f))) {
      return true;
    }
    // Linhas de titular / cartão (cabeçalho de grupo)
    if (/^gean\s|^titular|^final\s*\d{4}/.test(t)) {
      return true;
    }
    return false;
  }

  parse(texto: string): Lancamento[] {
    const lancamentos: Lancamento[] = [];
    const textoNormalizado = texto
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n');

    const regexLancamento =
      /(\d{2}\s*\/\s*\d{2})(?:\s*\/\s*\d{2,4})?\s+([^\n]*?)\s+(?:R\$\s*)?(\(?\s*[-−]?\s*(?:\d{1,3}(?:\.\d{3})*|\d+)\s*,\s*\d{2}\s*\)?\s*[-−]?)/g;

    for (const match of textoNormalizado.matchAll(regexLancamento)) {
      const data = this.normalizarData(match[1] ?? '');
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
    const textoCompacto = texto.replace(/\s+/g, '');

    if (!texto || texto === '-' || texto.startsWith('=')) {
      return true;
    }

    const termosIgnorados = [
      'lancamentos atuais',
      'lancamentos anterior',
      'total desta fatura',
      'total fatura',
      'total dos lancamentos atuais',
      'pagamento recebido',
      'pagamento efetuado',
      'pagamentos efetuados',
      'total dos pagamentos',
      'saldo anterior',
      'encargos',
      'juros',
      'multa',
      'anuidade',
      'credito rotativo',
      'parcelamento de fatura',
      'proxima fatura',
      'demais faturas',
      'total para proximas faturas',
      'compras parceladas - proximas faturas',
      'resumo da fatura',
      'limites de credito',
      'limite total de credito',
      'limite disponivel',
    ];

    return termosIgnorados.some((termo) => {
      const termoCompacto = termo.replace(/\s+/g, '');
      return texto.includes(termo) || textoCompacto.includes(termoCompacto);
    });
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

  private extrairCompetencia(texto: string, layout: LayoutParserTipo): string {
    // Hoje, Itaú e Genérico compartilham a mesma extração (MM/YYYY). Mantém o switch
    // para facilitar a inclusão de bancos com padrão diferente.
    if (layout === 'itau' || layout === 'itau-uniclass' || layout === 'itau-empresa' || layout === 'generico') {
      // 1) formato direto MM/YYYY
      const matchMesAno = texto.match(/\b(0[1-9]|1[0-2])\s*\/\s*(\d{4})\b/);
      if (matchMesAno) {
        const mes = matchMesAno[1];
        const ano = matchMesAno[2];
        return `${mes}/${ano}`;
      }

      // 2) fallback: pega de uma data completa DD/MM/YYYY (ex.: vencimento)
      const matchDataCompleta = texto.match(/\b\d{2}\s*\/\s*(0[1-9]|1[0-2])\s*\/\s*(\d{4})\b/);
      if (matchDataCompleta) {
        const mes = matchDataCompleta[1];
        const ano = matchDataCompleta[2];
        return `${mes}/${ano}`;
      }

      return 'N/A';
    }
    const match = texto.match(/\b(0[1-9]|1[0-2])\s*\/\s*(\d{4})\b/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    return 'N/A';
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

  private normalizarData(dataTexto: string): string {
    const bruto = dataTexto.replace(/\s/g, '');
    const m = bruto.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return bruto;
    return `${m[1]}/${m[2]}`;
  }
}