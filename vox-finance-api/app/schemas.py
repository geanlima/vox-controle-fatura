from datetime import datetime
from pydantic import BaseModel, Field


class LayoutCreate(BaseModel):
    nome: str
    tipo: str = Field(pattern=r"^(itau|itau-uniclass|generico)$")


class LayoutOut(BaseModel):
    id: str
    nome: str
    tipo: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CartaoCreate(BaseModel):
    nome: str
    bandeira: str | None = None
    ultimos4: str | None = None
    layout_id: str | None = None


class CartaoOut(BaseModel):
    id: str
    nome: str
    bandeira: str | None
    ultimos4: str | None
    layout_id: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LancamentoIn(BaseModel):
    data: str
    descricao: str
    cidade: str = ""
    categoria: str = "Outros"
    valor: float
    moeda: str = "BRL"
    parcela_atual: int | None = None
    total_parcelas: int | None = None


class LancamentoOut(LancamentoIn):
    id: str
    ordem: int

    class Config:
        from_attributes = True


class FaturaCreate(BaseModel):
    banco: str = "PDF (processamento local)"
    competencia: str
    cartao_id: str | None = None
    cartao_nome_snapshot: str | None = None
    lancamentos: list[LancamentoIn] = []


class FaturaOut(BaseModel):
    id: str
    banco: str
    competencia: str
    total_fatura: float
    imported_at: datetime
    updated_at: datetime
    cartao_id: str | None
    cartao_nome_snapshot: str | None
    lancamentos: list[LancamentoOut] = []

    class Config:
        from_attributes = True


class LancamentoPatch(BaseModel):
    descricao: str | None = None
    cidade: str | None = None
    categoria: str | None = None
    parcela_atual: int | None = None
    total_parcelas: int | None = None

