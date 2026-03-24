export interface Lancamento {
    id: string;
    data: string;
    descricao: string;
    valor: number;
    categoria: string;
    tipo: 'compra' | 'saque' | 'internacional';
  }