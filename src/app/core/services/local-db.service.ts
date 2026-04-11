import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import Dexie, { Table } from 'dexie';
import { FaturaImportada } from '../models/importacao-fatura.model';

type AppStateKey = 'currentFatura' | 'currentFaturaId';

interface AppStateRow<TValue> {
  key: AppStateKey;
  value: TValue;
  updatedAt: number;
}

type AnyAppStateRow = AppStateRow<unknown>;

export interface FaturaSalva extends FaturaImportada {
  id: string;
  importedAt: number;
  updatedAt: number;
}

export type FaturaSalvaResumo = Pick<
  FaturaSalva,
  'id' | 'banco' | 'cartao' | 'competencia' | 'totalFatura' | 'importedAt' | 'updatedAt'
>;

export interface CartaoCredito {
  id: string;
  nome: string;
  bandeira?: string;
  ultimos4?: string;
  layoutId?: string;
  createdAt: number;
  updatedAt: number;
}

export type CartaoCreditoResumo = Pick<CartaoCredito, 'id' | 'nome' | 'bandeira' | 'ultimos4' | 'layoutId'>;

export type LayoutParserTipo = 'itau' | 'itau-uniclass' | 'itau-empresa' | 'generico';

export interface LayoutFatura {
  id: string;
  nome: string;
  tipo: LayoutParserTipo;
  createdAt: number;
  updatedAt: number;
}

export type LayoutFaturaResumo = Pick<LayoutFatura, 'id' | 'nome' | 'tipo'>;

class VoxControleFaturaDb extends Dexie {
  appState!: Table<AnyAppStateRow, AppStateKey>;
  faturas!: Table<FaturaSalva, string>;
  cartoes!: Table<CartaoCredito, string>;
  layouts!: Table<LayoutFatura, string>;

  constructor() {
    super('vox-controle-fatura');
    this.version(1).stores({
      appState: 'key, updatedAt',
    });

    this.version(2).stores({
      appState: 'key, updatedAt',
      faturas: 'id, competencia, importedAt, updatedAt',
    });

    this.version(3).stores({
      appState: 'key, updatedAt',
      faturas: 'id, competencia, importedAt, updatedAt',
      cartoes: 'id, nome, createdAt, updatedAt',
    });

    this.version(4).stores({
      appState: 'key, updatedAt',
      faturas: 'id, competencia, importedAt, updatedAt',
      cartoes: 'id, nome, createdAt, updatedAt',
      layouts: 'id, nome, tipo, createdAt, updatedAt',
    });

    // Indexa por cartaoId/competencia para o Dashboard filtrar rápido
    this.version(5).stores({
      appState: 'key, updatedAt',
      faturas: 'id, cartaoId, competencia, [cartaoId+competencia], importedAt, updatedAt',
      cartoes: 'id, nome, createdAt, updatedAt',
      layouts: 'id, nome, tipo, createdAt, updatedAt',
    });
  }
}

@Injectable({ providedIn: 'root' })
export class LocalDbService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly db = this.isBrowser ? new VoxControleFaturaDb() : null;

  async getCurrentFatura(): Promise<FaturaImportada | null> {
    if (!this.db) return null;
    const row = await this.db.appState.get('currentFatura');
    return (row?.value as FaturaImportada | null | undefined) ?? null;
  }

  async setCurrentFatura(fatura: FaturaImportada | null): Promise<void> {
    if (!this.db) return;
    await this.db.appState.put({
      key: 'currentFatura',
      value: fatura,
      updatedAt: Date.now(),
    });
  }

  async getCurrentFaturaId(): Promise<string | null> {
    if (!this.db) return null;
    const row = await this.db.appState.get('currentFaturaId');
    return (row?.value as string | null | undefined) ?? null;
  }

  async setCurrentFaturaId(id: string | null): Promise<void> {
    if (!this.db) return;
    await this.db.appState.put({
      key: 'currentFaturaId',
      value: id,
      updatedAt: Date.now(),
    });
  }

  async listarFaturas(): Promise<FaturaSalvaResumo[]> {
    if (!this.db) return [];
    const rows = await this.db.faturas.orderBy('importedAt').reverse().toArray();
    return rows.map(({ id, banco, cartao, competencia, totalFatura, importedAt, updatedAt }) => ({
      id,
      banco,
      cartao,
      competencia,
      totalFatura,
      importedAt,
      updatedAt,
    }));
  }

  async obterFatura(id: string): Promise<FaturaSalva | null> {
    if (!this.db) return null;
    return (await this.db.faturas.get(id)) ?? null;
  }

  async salvarNovaFatura(fatura: FaturaImportada): Promise<FaturaSalva> {
    if (!this.db) {
      return {
        ...fatura,
        id: this.gerarId(),
        importedAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    const agora = Date.now();
    const row: FaturaSalva = {
      ...fatura,
      id: this.gerarId(),
      importedAt: agora,
      updatedAt: agora,
    };
    await this.db.faturas.add(row);
    return row;
  }

  async atualizarFatura(id: string, fatura: FaturaImportada): Promise<void> {
    if (!this.db) return;
    const existente = await this.db.faturas.get(id);
    const agora = Date.now();

    const row: FaturaSalva = {
      ...fatura,
      id,
      importedAt: existente?.importedAt ?? agora,
      updatedAt: agora,
    };
    await this.db.faturas.put(row);
  }

  async excluirFatura(id: string): Promise<void> {
    if (!this.db) return;
    await this.db.faturas.delete(id);
  }

  async listarCompetenciasPorCartao(cartaoId: string): Promise<string[]> {
    if (!this.db) return [];
    const rows = await this.db.faturas
      .where('cartaoId')
      .equals(cartaoId)
      .reverse()
      .sortBy('importedAt');

    const set = new Set<string>();
    for (const r of rows) {
      if (r.competencia) set.add(r.competencia);
    }
    // ordena desc por ano/mes quando estiver no formato MM/YYYY
    return Array.from(set).sort((a, b) => this.compararCompetenciaDesc(a, b));
  }

  async obterFaturaIdPorCartaoCompetencia(cartaoId: string, competencia: string): Promise<string | null> {
    if (!this.db) return null;
    const row = await this.db.faturas
      .where('[cartaoId+competencia]')
      .equals([cartaoId, competencia])
      .last();
    return row?.id ?? null;
  }

  async listarCartoes(): Promise<CartaoCreditoResumo[]> {
    if (!this.db) return [];
    const rows = await this.db.cartoes.orderBy('nome').toArray();
    return rows.map(({ id, nome, bandeira, ultimos4, layoutId }) => ({ id, nome, bandeira, ultimos4, layoutId }));
  }

  async obterCartao(id: string): Promise<CartaoCredito | null> {
    if (!this.db) return null;
    return (await this.db.cartoes.get(id)) ?? null;
  }

  async criarCartao(input: Pick<CartaoCredito, 'nome' | 'bandeira' | 'ultimos4'>): Promise<CartaoCredito> {
    const agora = Date.now();
    const row: CartaoCredito = {
      id: this.gerarId(),
      nome: input.nome.trim(),
      bandeira: input.bandeira?.trim() || undefined,
      ultimos4: input.ultimos4?.trim() || undefined,
      createdAt: agora,
      updatedAt: agora,
    };
    if (this.db) {
      await this.db.cartoes.add(row);
    }
    return row;
  }

  async atualizarCartao(
    id: string,
    patch: Partial<Pick<CartaoCredito, 'nome' | 'bandeira' | 'ultimos4' | 'layoutId'>>,
  ): Promise<void> {
    if (!this.db) return;
    const existente = await this.db.cartoes.get(id);
    if (!existente) return;
    await this.db.cartoes.put({
      ...existente,
      nome: (patch.nome ?? existente.nome).trim(),
      bandeira: (patch.bandeira ?? existente.bandeira)?.trim() || undefined,
      ultimos4: (patch.ultimos4 ?? existente.ultimos4)?.trim() || undefined,
      layoutId: patch.layoutId ?? existente.layoutId,
      updatedAt: Date.now(),
    });
  }

  async excluirCartao(id: string): Promise<void> {
    if (!this.db) return;
    await this.db.cartoes.delete(id);
  }

  async listarLayouts(): Promise<LayoutFaturaResumo[]> {
    if (!this.db) return [];
    const rows = await this.db.layouts.orderBy('nome').toArray();
    return rows.map(({ id, nome, tipo }) => ({ id, nome, tipo }));
  }

  async obterLayout(id: string): Promise<LayoutFatura | null> {
    if (!this.db) return null;
    return (await this.db.layouts.get(id)) ?? null;
  }

  async criarLayout(input: Pick<LayoutFatura, 'nome' | 'tipo'>): Promise<LayoutFatura> {
    const agora = Date.now();
    const row: LayoutFatura = {
      id: this.gerarId(),
      nome: input.nome.trim(),
      tipo: input.tipo,
      createdAt: agora,
      updatedAt: agora,
    };
    if (this.db) {
      await this.db.layouts.add(row);
    }
    return row;
  }

  async atualizarLayout(id: string, patch: Partial<Pick<LayoutFatura, 'nome' | 'tipo'>>): Promise<void> {
    if (!this.db) return;
    const existente = await this.db.layouts.get(id);
    if (!existente) return;
    await this.db.layouts.put({
      ...existente,
      nome: (patch.nome ?? existente.nome).trim(),
      tipo: patch.tipo ?? existente.tipo,
      updatedAt: Date.now(),
    });
  }

  async excluirLayout(id: string): Promise<void> {
    if (!this.db) return;
    await this.db.layouts.delete(id);
  }

  private compararCompetenciaDesc(a: string, b: string): number {
    // esperado: MM/YYYY
    const pa = a.split('/').map((x) => Number(x));
    const pb = b.split('/').map((x) => Number(x));
    const ma = pa[0] ?? 0;
    const ya = pa[1] ?? 0;
    const mb = pb[0] ?? 0;
    const yb = pb[1] ?? 0;
    if (ya !== yb) return yb - ya;
    return mb - ma;
  }

  private gerarId(): string {
    const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
    if (g.crypto?.randomUUID) {
      return g.crypto.randomUUID();
    }
    return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

