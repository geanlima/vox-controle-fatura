import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FaturaImportada, LancamentoImportado } from '../models/importacao-fatura.model';

type ApiLancamentoIn = {
  data: string;
  descricao: string;
  cidade: string;
  categoria: string;
  valor: number;
  moeda: string;
  parcela_atual: number | null;
  total_parcelas: number | null;
};

type ApiFaturaCreate = {
  banco: string;
  competencia: string;
  cartao_id: string | null;
  cartao_nome_snapshot: string | null;
  lancamentos: ApiLancamentoIn[];
};

@Injectable({ providedIn: 'root' })
export class VoxFinanceApiService {
  private readonly baseUrl = this.getBaseUrl();

  constructor(private readonly http: HttpClient) {}

  async enviarFaturaImportada(fatura: FaturaImportada): Promise<void> {
    const payload: ApiFaturaCreate = {
      banco: fatura.banco,
      competencia: fatura.competencia,
      cartao_id: (fatura.cartaoId ?? null) as string | null,
      cartao_nome_snapshot: fatura.cartao ?? null,
      lancamentos: (fatura.lancamentos ?? []).map((l) => this.mapLancamento(l)),
    };

    await firstValueFrom(this.http.post(`${this.baseUrl}/faturas`, payload));
  }

  private mapLancamento(l: LancamentoImportado): ApiLancamentoIn {
    return {
      data: l.data,
      descricao: l.descricao,
      cidade: l.cidade ?? '',
      categoria: l.categoriaSugerida || 'Outros',
      valor: Number(l.valor),
      moeda: l.moeda || 'BRL',
      parcela_atual: l.parcelaAtual ?? null,
      total_parcelas: l.totalParcelas ?? null,
    };
  }

  private getBaseUrl(): string {
    const w = globalThis as unknown as { __VOX_FINANCE_API_BASE__?: unknown };
    const v = w.__VOX_FINANCE_API_BASE__;
    if (typeof v === 'string' && v.trim()) {
      return v.trim().replace(/\/+$/, '');
    }
    return 'http://localhost:8080/api';
  }
}

