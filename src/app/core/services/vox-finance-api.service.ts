import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FaturaImportada, LancamentoImportado } from '../models/importacao-fatura.model';

export type ApiLayoutOut = {
  id: string;
  nome: string;
  tipo: 'itau' | 'itau-uniclass' | 'generico' | string;
  created_at: string;
  updated_at: string;
};

export type ApiCartaoOut = {
  id: string;
  nome: string;
  bandeira: string | null;
  ultimos4: string | null;
  layout_id: string | null;
  created_at: string;
  updated_at: string;
};

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

export type ApiLancamentoOut = ApiLancamentoIn & {
  id: string;
  ordem: number;
};

type ApiFaturaCreate = {
  banco: string;
  competencia: string;
  cartao_id: string | null;
  cartao_nome_snapshot: string | null;
  lancamentos: ApiLancamentoIn[];
};

export type ApiFaturaOut = {
  id: string;
  banco: string;
  competencia: string;
  total_fatura: number;
  imported_at: string;
  updated_at: string;
  cartao_id: string | null;
  cartao_nome_snapshot: string | null;
  lancamentos: ApiLancamentoOut[];
};

@Injectable({ providedIn: 'root' })
export class VoxFinanceApiService {
  private readonly baseUrl = this.getBaseUrl();

  constructor(private readonly http: HttpClient) {}

  async health(): Promise<{ ok: boolean }> {
    return await firstValueFrom(this.http.get<{ ok: boolean }>(`${this.baseUrl}/health`));
  }

  // Layouts
  async listarLayouts(): Promise<ApiLayoutOut[]> {
    return await firstValueFrom(this.http.get<ApiLayoutOut[]>(`${this.baseUrl}/layouts`));
  }

  async criarLayout(payload: { nome: string; tipo: ApiLayoutOut['tipo'] }): Promise<ApiLayoutOut> {
    return await firstValueFrom(this.http.post<ApiLayoutOut>(`${this.baseUrl}/layouts`, payload));
  }

  async patchLayout(id: string, patch: { nome?: string; tipo?: ApiLayoutOut['tipo'] }): Promise<ApiLayoutOut> {
    return await firstValueFrom(this.http.patch<ApiLayoutOut>(`${this.baseUrl}/layouts/${id}`, patch));
  }

  async excluirLayout(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/layouts/${id}`));
  }

  // Cartões
  async listarCartoes(): Promise<ApiCartaoOut[]> {
    return await firstValueFrom(this.http.get<ApiCartaoOut[]>(`${this.baseUrl}/cartoes`));
  }

  async criarCartao(payload: { nome: string; bandeira?: string; ultimos4?: string; layout_id?: string | null }): Promise<ApiCartaoOut> {
    return await firstValueFrom(this.http.post<ApiCartaoOut>(`${this.baseUrl}/cartoes`, payload));
  }

  async patchCartao(
    id: string,
    patch: { nome?: string; bandeira?: string | null; ultimos4?: string | null; layout_id?: string | null },
  ): Promise<ApiCartaoOut> {
    return await firstValueFrom(this.http.patch<ApiCartaoOut>(`${this.baseUrl}/cartoes/${id}`, patch));
  }

  async excluirCartao(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/cartoes/${id}`));
  }

  // Faturas
  async listarFaturas(params?: { cartao_id?: string; competencia?: string }): Promise<ApiFaturaOut[]> {
    const qs = new URLSearchParams();
    if (params?.cartao_id) qs.set('cartao_id', params.cartao_id);
    if (params?.competencia) qs.set('competencia', params.competencia);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return await firstValueFrom(this.http.get<ApiFaturaOut[]>(`${this.baseUrl}/faturas${suffix}`));
  }

  async obterFatura(id: string): Promise<ApiFaturaOut> {
    return await firstValueFrom(this.http.get<ApiFaturaOut>(`${this.baseUrl}/faturas/${id}`));
  }

  async excluirFatura(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/faturas/${id}`));
  }

  // Lançamentos (manutenção)
  async criarLancamento(faturaId: string, payload: ApiLancamentoIn): Promise<ApiLancamentoOut> {
    return await firstValueFrom(this.http.post<ApiLancamentoOut>(`${this.baseUrl}/faturas/${faturaId}/lancamentos`, payload));
  }

  async patchLancamento(
    lancamentoId: string,
    patch: { descricao?: string; cidade?: string; categoria?: string; parcela_atual?: number | null; total_parcelas?: number | null },
  ): Promise<ApiLancamentoOut> {
    return await firstValueFrom(this.http.patch<ApiLancamentoOut>(`${this.baseUrl}/lancamentos/${lancamentoId}`, patch));
  }

  async excluirLancamento(lancamentoId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/lancamentos/${lancamentoId}`));
  }

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

