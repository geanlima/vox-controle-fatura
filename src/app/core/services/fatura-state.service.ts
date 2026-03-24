import { Injectable, signal, computed } from '@angular/core';
import { FaturaImportada } from '../models/importacao-fatura.model';

@Injectable({
  providedIn: 'root',
})
export class FaturaStateService {
  private _fatura = signal<FaturaImportada | null>(null);

  fatura = this._fatura.asReadonly();

  possuiFatura = computed(() => this._fatura() !== null);

  definirFatura(fatura: FaturaImportada): void {
    this._fatura.set(fatura);
  }

  limpar(): void {
    this._fatura.set(null);
  }
}