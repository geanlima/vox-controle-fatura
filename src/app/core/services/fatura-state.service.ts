import { Injectable, computed, signal } from '@angular/core';
import { FaturaImportada } from '../models/importacao-fatura.model';
import { LocalDbService } from './local-db.service';

@Injectable({
  providedIn: 'root',
})
export class FaturaStateService {
  private _fatura = signal<FaturaImportada | null>(null);
  private _faturaId = signal<string | null>(null);

  fatura = this._fatura.asReadonly();
  faturaId = this._faturaId.asReadonly();

  possuiFatura = computed(() => this._fatura() !== null);

  constructor(private readonly localDb: LocalDbService) {
    void this.carregarDoBanco();
  }

  private async carregarDoBanco(): Promise<void> {
    try {
      const id = await this.localDb.getCurrentFaturaId();
      const fatura = await this.localDb.getCurrentFatura();
      this._faturaId.set(id);
      this._fatura.set(fatura);
    } catch {
      // se falhar (ex: permissão/navegador), segue sem persistência
    }
  }

  definirFatura(fatura: FaturaImportada): void {
    this._fatura.set(fatura);
    // Mantém um rascunho local para não perder ao recarregar,
    // mas não grava na lista de "faturas importadas" sem ação explícita do usuário.
    void this.localDb.setCurrentFatura(fatura).catch(() => {});
  }

  limpar(): void {
    this._fatura.set(null);
    this._faturaId.set(null);
    void this.localDb.setCurrentFatura(null).catch(() => {});
    void this.localDb.setCurrentFaturaId(null).catch(() => {});
  }

  async carregarFaturaSalva(id: string): Promise<void> {
    const salva = await this.localDb.obterFatura(id);
    if (!salva) return;

    const fatura: FaturaImportada = {
      banco: salva.banco,
      cartao: salva.cartao,
      competencia: salva.competencia,
      totalFatura: salva.totalFatura,
      lancamentos: salva.lancamentos,
    };

    this._faturaId.set(salva.id);
    this._fatura.set(fatura);
    await this.localDb.setCurrentFaturaId(salva.id);
    await this.localDb.setCurrentFatura(fatura);
  }

  async excluirFaturaSalva(id: string): Promise<void> {
    await this.localDb.excluirFatura(id);
    if (this._faturaId() === id) {
      this.limpar();
    }
  }

  async salvarFaturaAtual(): Promise<string | null> {
    const fatura = this._fatura();
    if (!fatura) return null;

    const idAtual = this._faturaId();

    if (!idAtual) {
      const salva = await this.localDb.salvarNovaFatura(fatura);
      this._faturaId.set(salva.id);
      await this.localDb.setCurrentFaturaId(salva.id);
      await this.localDb.setCurrentFatura(fatura);
      return salva.id;
    }

    await this.localDb.atualizarFatura(idAtual, fatura);
    await this.localDb.setCurrentFatura(fatura);
    return idAtual;
  }
}
