from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .db import get_db
from . import models, schemas

router = APIRouter()

def _recalcular_total_fatura(f: models.Fatura) -> None:
    total = 0.0
    for l in f.lancamentos:
        total += float(l.valor)
    f.total_fatura = round(total, 2)
    f.updated_at = datetime.utcnow()


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

@router.get("/layouts/{layout_id}", response_model=schemas.LayoutOut)
def obter_layout(layout_id: str, db: Session = Depends(get_db)):
    row = db.query(models.Layout).filter(models.Layout.id == layout_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Layout não encontrado")
    return row

@router.patch("/layouts/{layout_id}", response_model=schemas.LayoutOut)
def patch_layout(layout_id: str, payload: schemas.LayoutPatch, db: Session = Depends(get_db)):
    row = db.query(models.Layout).filter(models.Layout.id == layout_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Layout não encontrado")
    if payload.nome is not None:
        row.nome = payload.nome.strip()
    if payload.tipo is not None:
        row.tipo = payload.tipo
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row

@router.delete("/layouts/{layout_id}")
def delete_layout(layout_id: str, db: Session = Depends(get_db)):
    row = db.query(models.Layout).filter(models.Layout.id == layout_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Layout não encontrado")
    db.delete(row)
    db.commit()
    return {"ok": True}


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

@router.get("/cartoes/{cartao_id}", response_model=schemas.CartaoOut)
def obter_cartao(cartao_id: str, db: Session = Depends(get_db)):
    row = db.query(models.Cartao).filter(models.Cartao.id == cartao_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Cartão não encontrado")
    return row

@router.patch("/cartoes/{cartao_id}", response_model=schemas.CartaoOut)
def patch_cartao(cartao_id: str, payload: schemas.CartaoPatch, db: Session = Depends(get_db)):
    row = db.query(models.Cartao).filter(models.Cartao.id == cartao_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Cartão não encontrado")
    if payload.nome is not None:
        row.nome = payload.nome.strip()
    if payload.bandeira is not None:
        row.bandeira = payload.bandeira.strip() if payload.bandeira.strip() else None
    if payload.ultimos4 is not None:
        u = payload.ultimos4.strip()
        row.ultimos4 = u if u else None
    if payload.layout_id is not None:
        row.layout_id = payload.layout_id
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row

@router.delete("/cartoes/{cartao_id}")
def delete_cartao(cartao_id: str, db: Session = Depends(get_db)):
    row = db.query(models.Cartao).filter(models.Cartao.id == cartao_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Cartão não encontrado")
    db.delete(row)
    db.commit()
    return {"ok": True}


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
def listar_faturas(
    db: Session = Depends(get_db),
    cartao_id: str | None = Query(default=None),
    competencia: str | None = Query(default=None),
):
    # retorna sem lançar erro: inclui lancamentos (ok para MVP; dá pra paginar depois)
    q = db.query(models.Fatura)
    if cartao_id:
        q = q.filter(models.Fatura.cartao_id == cartao_id)
    if competencia:
        q = q.filter(models.Fatura.competencia == competencia)
    return q.order_by(models.Fatura.imported_at.desc()).all()


@router.get("/faturas/{fatura_id}", response_model=schemas.FaturaOut)
def obter_fatura(fatura_id: str, db: Session = Depends(get_db)):
    row = db.query(models.Fatura).filter(models.Fatura.id == fatura_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fatura não encontrada")
    return row

@router.patch("/faturas/{fatura_id}", response_model=schemas.FaturaOut)
def patch_fatura(fatura_id: str, payload: schemas.FaturaPatch, db: Session = Depends(get_db)):
    row = db.query(models.Fatura).filter(models.Fatura.id == fatura_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fatura não encontrada")
    if payload.banco is not None:
        row.banco = payload.banco.strip()
    if payload.competencia is not None:
        row.competencia = payload.competencia.strip()
    if payload.cartao_id is not None:
        row.cartao_id = payload.cartao_id
    if payload.cartao_nome_snapshot is not None:
        row.cartao_nome_snapshot = payload.cartao_nome_snapshot
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row

@router.delete("/faturas/{fatura_id}")
def delete_fatura(fatura_id: str, db: Session = Depends(get_db)):
    row = db.query(models.Fatura).filter(models.Fatura.id == fatura_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fatura não encontrada")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/faturas/{fatura_id}/lancamentos", response_model=list[schemas.LancamentoOut])
def listar_lancamentos(fatura_id: str, db: Session = Depends(get_db)):
    return (
        db.query(models.Lancamento)
        .filter(models.Lancamento.fatura_id == fatura_id)
        .order_by(models.Lancamento.ordem.asc())
        .all()
    )

@router.post("/faturas/{fatura_id}/lancamentos", response_model=schemas.LancamentoOut)
def criar_lancamento(fatura_id: str, payload: schemas.LancamentoIn, db: Session = Depends(get_db)):
    f = db.query(models.Fatura).filter(models.Fatura.id == fatura_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Fatura não encontrada")
    ordem = len(f.lancamentos)
    row = models.Lancamento(
        fatura_id=fatura_id,
        ordem=ordem,
        data=payload.data,
        descricao=payload.descricao,
        cidade=payload.cidade,
        categoria=payload.categoria,
        valor=payload.valor,
        moeda=payload.moeda,
        parcela_atual=payload.parcela_atual,
        total_parcelas=payload.total_parcelas,
    )
    db.add(row)
    db.flush()
    f.lancamentos.append(row)
    _recalcular_total_fatura(f)
    db.commit()
    db.refresh(row)
    return row


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
        _recalcular_total_fatura(f)

    db.commit()
    db.refresh(row)
    return row

@router.delete("/lancamentos/{lancamento_id}")
def delete_lancamento(lancamento_id: str, db: Session = Depends(get_db)):
    row = db.query(models.Lancamento).filter(models.Lancamento.id == lancamento_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    f = db.query(models.Fatura).filter(models.Fatura.id == row.fatura_id).first()

    db.delete(row)
    db.flush()

    # reordena ordens e recalcula total
    if f:
        lancs = (
            db.query(models.Lancamento)
            .filter(models.Lancamento.fatura_id == f.id)
            .order_by(models.Lancamento.ordem.asc())
            .all()
        )
        for i, l in enumerate(lancs):
            l.ordem = i
        _recalcular_total_fatura(f)

    db.commit()
    return {"ok": True}

