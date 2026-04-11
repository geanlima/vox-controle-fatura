from datetime import datetime
from pydantic import BaseModel, Field


# Slug do parser (ex.: itau, itau-uniclass, itau-empresa). Evita lista fixa no deploy a cada novo layout.
_TIPO_LAYOUT = r"^[a-z0-9]+(-[a-z0-9]+)*$"


class LayoutCreate(BaseModel):
    nome: str
    tipo: str = Field(min_length=2, max_length=40, pattern=_TIPO_LAYOUT)


class LayoutPatch(BaseModel):
    nome: str | None = None
    tipo: str | None = Field(default=None, min_length=2, max_length=40, pattern=_TIPO_LAYOUT)


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


class CartaoPatch(BaseModel):
    nome: str | None = None
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


class FaturaPatch(BaseModel):
    banco: str | None = None
    competencia: str | None = None
    cartao_id: str | None = None
    cartao_nome_snapshot: str | None = None


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

