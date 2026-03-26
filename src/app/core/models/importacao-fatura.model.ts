export interface LancamentoImportado {
    data: string;
    descricao: string;
    cidade: string;
    valor: number;
    moeda: string;
    tipo: 'compra' | 'saque' | 'internacional' | 'ajuste' | 'outro';
    categoriaSugerida: string;
    parcelaAtual: number | null;
    totalParcelas: number | null;
  }
  
  export interface FaturaImportada {
    banco: string;
    cartao: string;
  cartaoId?: string | null;
    competencia: string;
    totalFatura: number;
    lancamentos: LancamentoImportado[];
  }