import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import {
  CartaoCreditoResumo,
  LayoutFaturaResumo,
  LayoutParserTipo,
} from '../../core/services/local-db.service';
import { VoxFinanceApiService } from '../../core/services/vox-finance-api.service';

@Component({
  selector: 'app-cartoes-list',
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
  templateUrl: './cartoes-list.component.html',
  styleUrl: './cartoes-list.component.scss',
})
export class CartoesListComponent implements OnInit {
  carregando = false;
  erro = '';
  cartoes: CartaoCreditoResumo[] = [];
  layouts: LayoutFaturaResumo[] = [];

  nome = '';
  bandeira = '';
  ultimos4 = '';
  layoutId = '';

  displayedColumns = ['nome', 'bandeira', 'ultimos4', 'layout', 'acoes'];

  constructor(private readonly api: VoxFinanceApiService) {}

  ngOnInit(): void {
    void this.recarregarTudo();
  }

  async recarregarTudo(): Promise<void> {
    this.carregando = true;
    this.erro = '';
    try {
      const [layouts, cartoes] = await Promise.all([this.api.listarLayouts(), this.api.listarCartoes()]);
      this.layouts = layouts.map((l) => ({ id: l.id, nome: l.nome, tipo: l.tipo as LayoutParserTipo }));
      this.cartoes = cartoes.map((c) => ({
        id: c.id,
        nome: c.nome,
        bandeira: c.bandeira ?? undefined,
        ultimos4: c.ultimos4 ?? undefined,
        layoutId: c.layout_id ?? undefined,
      }));
    } catch {
      this.erro = 'Erro ao carregar cartões.';
    } finally {
      this.carregando = false;
    }
  }

  async criar(): Promise<void> {
    this.erro = '';
    const nome = this.nome.trim();
    if (!nome) {
      this.erro = 'Informe o nome do cartão.';
      return;
    }

    const ult4 = this.ultimos4.trim();
    if (ult4 && !/^\d{4}$/.test(ult4)) {
      this.erro = 'Últimos 4 dígitos deve ter 4 números.';
      return;
    }

    try {
      const cartao = await this.api.criarCartao({
        nome,
        bandeira: this.bandeira.trim() || undefined,
        ultimos4: ult4 || undefined,
      });
      if (this.layoutId.trim()) {
        await this.api.patchCartao(cartao.id, { layout_id: this.layoutId.trim() });
      }
      this.nome = '';
      this.bandeira = '';
      this.ultimos4 = '';
      this.layoutId = '';
      await this.recarregarTudo();
    } catch {
      this.erro = 'Erro ao criar cartão.';
    }
  }

  async editar(cartao: CartaoCreditoResumo): Promise<void> {
    this.erro = '';
    const nome = prompt('Nome do cartão', cartao.nome);
    if (nome === null) return;
    const n = nome.trim();
    if (!n) return;

    const bandeira = prompt('Bandeira (opcional)', cartao.bandeira ?? '') ?? undefined;
    const ultimos4 = prompt('Últimos 4 dígitos (opcional)', cartao.ultimos4 ?? '') ?? undefined;

    if (ultimos4 && ultimos4.trim() && !/^\d{4}$/.test(ultimos4.trim())) {
      this.erro = 'Últimos 4 dígitos deve ter 4 números.';
      return;
    }

    try {
      await this.api.patchCartao(cartao.id, {
        nome: n,
        bandeira: bandeira?.trim() || undefined,
        ultimos4: ultimos4?.trim() || undefined,
      });
      await this.recarregarTudo();
    } catch {
      this.erro = 'Erro ao atualizar cartão.';
    }
  }

  async alterarLayout(cartaoId: string, layoutId: string): Promise<void> {
    this.erro = '';
    try {
      await this.api.patchCartao(cartaoId, { layout_id: layoutId || null });
      await this.recarregarTudo();
    } catch {
      this.erro = 'Erro ao associar layout.';
    }
  }

  async excluir(cartao: CartaoCreditoResumo): Promise<void> {
    const ok = confirm(`Excluir o cartão "${cartao.nome}"?`);
    if (!ok) return;
    try {
      await this.api.excluirCartao(cartao.id);
      await this.recarregarTudo();
    } catch {
      this.erro = 'Erro ao excluir cartão.';
    }
  }

  nomeLayoutPorId(id?: string): string {
    if (!id) return '—';
    const l = this.layouts.find((x) => x.id === id);
    return l ? `${l.nome} (${this.nomeTipoLayout(l.tipo)})` : '—';
  }

  nomeTipoLayout(tipo: LayoutParserTipo): string {
    if (tipo === 'itau') return 'Itaú';
    if (tipo === 'itau-uniclass') return 'Itaú Uniclass';
    return 'Genérico';
  }
}

