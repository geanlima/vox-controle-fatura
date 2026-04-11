import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Integer, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Layout(Base):
    __tablename__ = "layouts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    nome: Mapped[str] = mapped_column(String(140), nullable=False)
    tipo: Mapped[str] = mapped_column(String(40), nullable=False)  # itau, itau-uniclass, itau-empresa, generico
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    cartoes: Mapped[list["Cartao"]] = relationship(back_populates="layout")


class Cartao(Base):
    __tablename__ = "cartoes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    nome: Mapped[str] = mapped_column(String(140), nullable=False)
    bandeira: Mapped[str | None] = mapped_column(String(40), nullable=True)
    ultimos4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    layout_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("layouts.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    layout: Mapped["Layout | None"] = relationship(back_populates="cartoes")
    faturas: Mapped[list["Fatura"]] = relationship(back_populates="cartao")


class Fatura(Base):
    __tablename__ = "faturas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    banco: Mapped[str] = mapped_column(String(120), nullable=False, default="PDF (processamento local)")
    competencia: Mapped[str] = mapped_column(String(20), nullable=False)  # MM/YYYY
    total_fatura: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    cartao_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cartoes.id"), nullable=True)
    cartao_nome_snapshot: Mapped[str | None] = mapped_column(String(140), nullable=True)

    cartao: Mapped["Cartao | None"] = relationship(back_populates="faturas")
    lancamentos: Mapped[list["Lancamento"]] = relationship(
        back_populates="fatura",
        cascade="all, delete-orphan",
        order_by="Lancamento.ordem",
    )


class Lancamento(Base):
    __tablename__ = "lancamentos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    fatura_id: Mapped[str] = mapped_column(String(36), ForeignKey("faturas.id"), nullable=False, index=True)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    data: Mapped[str] = mapped_column(String(10), nullable=False)  # DD/MM
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    cidade: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    categoria: Mapped[str] = mapped_column(String(80), nullable=False, default="Outros")
    valor: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    moeda: Mapped[str] = mapped_column(String(8), nullable=False, default="BRL")

    parcela_atual: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_parcelas: Mapped[int | None] = mapped_column(Integer, nullable=True)

    fatura: Mapped["Fatura"] = relationship(back_populates="lancamentos")

