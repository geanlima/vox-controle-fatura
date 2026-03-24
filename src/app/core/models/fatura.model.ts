import { Lancamento } from './lancamento.model';

export interface Fatura {
  id: string;
  competencia: string;
  valorTotal: number;
  lancamentos: Lancamento[];
}