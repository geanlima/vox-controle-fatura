import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { CategoriaService } from '../../core/services/categoria.service';
import { LocalDbService, CartaoCreditoResumo } from '../../core/services/local-db.service';
import { LancamentoImportado } from '../../core/models/importacao-fatura.model';

@Component({
  selector: 'app-lancamento-manual',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
  ],
  templateUrl: './lancamento-manual.component.html',
  styleUrl: './lancamento-manual.component.scss',
})
export class LancamentoManualComponent implements OnInit {
  private readonly db = inject(LocalDbService);
  private readonly categoria = inject(CategoriaService);

  erro = signal('');
  sucesso = signal('');
  carregando = signal(false);

  cartoes = signal<CartaoCreditoResumo[]>([]);
  competencias = signal<string[]>([]);

  cartaoId = signal('');
  competencia = signal('');
  faturaId = signal<string | null>(null);

  fatura = signal<{ banco: string; cartao: string; competencia: string; totalFatura: number; lancamentos: LancamentoImportado[] } | null>(
    null,
  );

  data = signal('');
  descricao = signal('');
  cidade = signal('');
  valor = signal('');

  displayedColumns = ['data', 'descricao', 'cidade', 'categoriaSugerida', 'valor', 'acoes'];

  podeCarregar = computed(() => !!this.cartaoId().trim() && !!this.competencia().trim());
  podeAdicionar = computed(() => !!this.fatura() && !!this.descricao().trim() && !!this.valor().trim() && /^\d{2}\/\d{2}$/.test(this.data().trim()));

  async ngOnInit(): Promise<void> {
    await this.carregarCartoes();
  }

  private async carregarCartoes(): Promise<void> {
    try {
      this.cartoes.set(await this.db.listarCartoes());
    } catch {
      this.cartoes.set([]);
    }
  }

  async onCartaoChange(): Promise<void> {
    this.erro.set('');
    this.sucesso.set('');
    this.competencia.set('');
    this.competencias.set([]);
    this.fatura.set(null);
    this.faturaId.set(null);

    const id = this.cartaoId().trim();
    if (!id) return;

    try {
      const comps = await this.db.listarCompetenciasPorCartao(id);
      this.competencias.set(comps);
      if (comps.length) {
        this.competencia.set(comps[0] ?? '');
      }
    } catch {
      this.competencias.set([]);
    }
  }

  async carregarFatura(): Promise<void> {
    if (!this.podeCarregar()) return;
    this.carregando.set(true);
    this.erro.set('');
    this.sucesso.set('');
    try {
      const id = await this.db.obterFaturaIdPorCartaoCompetencia(this.cartaoId().trim(), this.competencia().trim());
      if (!id) {
        this.fatura.set(null);
        this.faturaId.set(null);
        this.erro.set('Fatura não encontrada para este cartão/mês.');
        return;
      }
      const row = await this.db.obterFatura(id);
      if (!row) {
        this.fatura.set(null);
        this.faturaId.set(null);
        this.erro.set('Fatura não encontrada.');
        return;
      }
      this.faturaId.set(id);
      this.fatura.set({
        banco: row.banco,
        cartao: row.cartao,
        competencia: row.competencia,
        totalFatura: row.totalFatura,
        lancamentos: row.lancamentos ?? [],
      });
    } catch {
      this.erro.set('Erro ao carregar fatura.');
    } finally {
      this.carregando.set(false);
    }
  }

  async adicionar(): Promise<void> {
    const f = this.fatura();
    const id = this.faturaId();
    if (!f || !id) return;

    this.erro.set('');
    this.sucesso.set('');

    const data = this.data().trim();
    if (!/^\d{2}\/\d{2}$/.test(data)) {
      this.erro.set('Informe a data no formato DD/MM.');
      return;
    }
    const desc = this.descricao().trim();
    if (!desc) {
      this.erro.set('Informe a descrição.');
      return;
    }
    const v = this.parseValorEntrada(this.valor());
    if (v === null) {
      this.erro.set('Informe um valor válido (ex.: 150,90 ou -20,00).');
      return;
    }

    const item: LancamentoImportado = {
      data,
      descricao: desc,
      cidade: this.cidade().trim(),
      valor: v,
      moeda: 'BRL',
      tipo: 'outro',
      categoriaSugerida: this.categoria.classificar(desc),
      parcelaAtual: null,
      totalParcelas: null,
    };

    const novos = [...f.lancamentos, item];
    const total = novos.reduce((acc, x) => acc + x.valor, 0);
    const atualizado = { ...f, lancamentos: novos, totalFatura: total };

    this.carregando.set(true);
    try {
      await this.db.atualizarFatura(id, {
        banco: atualizado.banco,
        cartao: atualizado.cartao,
        cartaoId: this.cartaoId(),
        competencia: atualizado.competencia,
        totalFatura: atualizado.totalFatura,
        lancamentos: atualizado.lancamentos,
      });
      this.fatura.set(atualizado);
      this.data.set('');
      this.descricao.set('');
      this.cidade.set('');
      this.valor.set('');
      this.sucesso.set('Lançamento adicionado.');
    } catch {
      this.erro.set('Erro ao salvar lançamento.');
    } finally {
      this.carregando.set(false);
    }
  }

  async remover(item: LancamentoImportado): Promise<void> {
    const f = this.fatura();
    const id = this.faturaId();
    if (!f || !id) return;
    const idx = f.lancamentos.indexOf(item);
    if (idx < 0) return;

    const novos = f.lancamentos.filter((_, i) => i !== idx);
    const total = novos.reduce((acc, x) => acc + x.valor, 0);
    const atualizado = { ...f, lancamentos: novos, totalFatura: total };

    this.carregando.set(true);
    this.erro.set('');
    this.sucesso.set('');
    try {
      await this.db.atualizarFatura(id, {
        banco: atualizado.banco,
        cartao: atualizado.cartao,
        cartaoId: this.cartaoId(),
        competencia: atualizado.competencia,
        totalFatura: atualizado.totalFatura,
        lancamentos: atualizado.lancamentos,
      });
      this.fatura.set(atualizado);
      this.sucesso.set('Lançamento removido.');
    } catch {
      this.erro.set('Erro ao remover lançamento.');
    } finally {
      this.carregando.set(false);
    }
  }

  private parseValorEntrada(texto: string): number | null {
    const t = texto.trim().replace(/\s/g, '').replace(/r\$/gi, '').replace(/−/g, '-');
    if (!t) return null;

    const negativo = t.includes('-') || (t.includes('(') && t.includes(')'));
    const limpo = t.replace(/[()]/g, '').replace(/-/g, '');
    const partes = limpo.split(',');

    let numero: number;
    if (partes.length === 1) {
      numero = Number(limpo.replace(/\./g, '').replace(',', '.'));
    } else if (partes.length === 2) {
      const inteiros = partes[0].replace(/\./g, '');
      const dec = partes[1];
      numero = Number(`${inteiros}.${dec}`);
    } else {
      return null;
    }

    if (Number.isNaN(numero)) return null;
    return negativo ? -Math.abs(numero) : numero;
  }
}

