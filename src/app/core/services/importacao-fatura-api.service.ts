import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

import { FaturaImportada, LancamentoImportado } from '../models/importacao-fatura.model';
import { Lancamento } from '../models/lancamento.model';
import { Fatura } from '../models/fatura.model';
import { ParserFaturaService } from './parser-fatura.service';
import { LayoutParserTipo } from './local-db.service';

/**
 * Processa o PDF no navegador e devolve o formato usado pelo dashboard.
 * (Nome mantido para futura troca por chamada HTTP / IA.)
 */
@Injectable({
  providedIn: 'root',
})
export class ImportacaoFaturaApiService {
  private parser = inject(ParserFaturaService);

  importarPdf(arquivo: File, layout: LayoutParserTipo = 'itau'): Observable<FaturaImportada> {
    return from(this.parser.processarPdf(arquivo, layout)).pipe(
      map((fatura) => this.converterParaImportada(fatura, layout))
    );
  }

  private converterParaImportada(fatura: Fatura, layout: LayoutParserTipo): FaturaImportada {
    return {
      banco: layout === 'itau-empresa' ? 'Itaú Empresas' : 'PDF (processamento local)',
      cartao: '—',
      competencia: fatura.competencia,
      totalFatura: fatura.valorTotal,
      lancamentos: fatura.lancamentos.map((l) => this.converterLancamento(l)),
    };
  }

  private converterLancamento(l: Lancamento): LancamentoImportado {
    const tipoMap: Record<Lancamento['tipo'], LancamentoImportado['tipo']> = {
      compra: 'compra',
      saque: 'saque',
      internacional: 'internacional',
    };

    return {
      data: l.data,
      descricao: l.descricao,
      cidade: this.extrairCidadeDaDescricao(l.descricao),
      valor: l.valor,
      moeda: 'BRL',
      tipo: tipoMap[l.tipo],
      categoriaSugerida: l.categoria,
      parcelaAtual: null,
      totalParcelas: null,
    };
  }

  private extrairCidadeDaDescricao(descricao: string): string {
    const linhas = descricao
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => !!s);
    if (linhas.length < 2) {
      return '';
    }
    const ultima = linhas[linhas.length - 1] ?? '';
    const idx = ultima.indexOf('.');
    if (idx >= 0) {
      return ultima.slice(idx + 1).trim();
    }
    return ultima;
  }
}
