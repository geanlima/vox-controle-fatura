from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .db import get_db
from . import models, schemas

router = APIRouter()


@router.get("/health")
def health():
    return {"ok": True}


# Layouts
@router.post("/layouts", response_model=schemas.LayoutOut)
def criar_layout(payload: schemas.LayoutCreate, db: Session = Depends(get_db)):
    row = models.Layout(nome=payload.nome.strip(), tipo=payload.tipo, created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/layouts", response_model=list[schemas.LayoutOut])
def listar_layouts(db: Session = Depends(get_db)):
    return db.query(models.Layout).order_by(models.Layout.nome.asc()).all()


# Cartões
@router.post("/cartoes", response_model=schemas.CartaoOut)
def criar_cartao(payload: schemas.CartaoCreate, db: Session = Depends(get_db)):
    row = models.Cartao(
        nome=payload.nome.strip(),
        bandeira=payload.bandeira.strip() if payload.bandeira else None,
        ultimos4=payload.ultimos4.strip() if payload.ultimos4 else None,
        layout_id=payload.layout_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/cartoes", response_model=list[schemas.CartaoOut])
def listar_cartoes(db: Session = Depends(get_db)):
    return db.query(models.Cartao).order_by(models.Cartao.nome.asc()).all()


# Faturas
@router.post("/faturas", response_model=schemas.FaturaOut)
def criar_fatura(payload: schemas.FaturaCreate, db: Session = Depends(get_db)):
    f = models.Fatura(
        banco=payload.banco.strip(),
        competencia=payload.competencia.strip(),
        cartao_id=payload.cartao_id,
        cartao_nome_snapshot=payload.cartao_nome_snapshot,
        imported_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    lancs = []
    total = 0.0
    for i, l in enumerate(payload.lancamentos):
        total += float(l.valor)
        lancs.append(
            models.Lancamento(
                ordem=i,
                data=l.data,
                descricao=l.descricao,
                cidade=l.cidade,
                categoria=l.categoria,
                valor=l.valor,
                moeda=l.moeda,
                parcela_atual=l.parcela_atual,
                total_parcelas=l.total_parcelas,
            )
        )

    f.total_fatura = round(total, 2)
    f.lancamentos = lancs

    db.add(f)
    db.commit()
    db.refresh(f)
    return f


@router.get("/faturas", response_model=list[schemas.FaturaOut])
def listar_faturas(db: Session = Depends(get_db)):
    # retorna sem lançar erro: inclui lancamentos (ok para MVP; dá pra paginar depois)
    return db.query(models.Fatura).order_by(models.Fatura.imported_at.desc()).all()


@router.get("/faturas/{fatura_id}", response_model=schemas.FaturaOut)
def obter_fatura(fatura_id: str, db: Session = Depends(get_db)):
    row = db.query(models.Fatura).filter(models.Fatura.id == fatura_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fatura não encontrada")
    return row


@router.get("/faturas/{fatura_id}/lancamentos", response_model=list[schemas.LancamentoOut])
def listar_lancamentos(fatura_id: str, db: Session = Depends(get_db)):
    return (
        db.query(models.Lancamento)
        .filter(models.Lancamento.fatura_id == fatura_id)
        .order_by(models.Lancamento.ordem.asc())
        .all()
    )


@router.patch("/lancamentos/{lancamento_id}", response_model=schemas.LancamentoOut)
def patch_lancamento(lancamento_id: str, payload: schemas.LancamentoPatch, db: Session = Depends(get_db)):
    row = db.query(models.Lancamento).filter(models.Lancamento.id == lancamento_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")

    if payload.descricao is not None:
        row.descricao = payload.descricao
    if payload.cidade is not None:
        row.cidade = payload.cidade
    if payload.categoria is not None:
        row.categoria = payload.categoria
    if payload.parcela_atual is not None:
        row.parcela_atual = payload.parcela_atual
    if payload.total_parcelas is not None:
        row.total_parcelas = payload.total_parcelas

    # atualiza updated_at da fatura
    f = db.query(models.Fatura).filter(models.Fatura.id == row.fatura_id).first()
    if f:
        f.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(row)
    return row

