import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { LayoutParserTipo } from '../../core/services/local-db.service';
import { VoxFinanceApiService } from '../../core/services/vox-finance-api.service';

@Component({
  selector: 'app-layouts-list',
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
  templateUrl: './layouts-list.component.html',
  styleUrl: './layouts-list.component.scss',
})
export class LayoutsListComponent implements OnInit {
  carregando = false;
  erro = '';
  layouts: { id: string; nome: string; tipo: LayoutParserTipo | string }[] = [];

  nome = '';
  tipo: LayoutParserTipo = 'itau';

  displayedColumns = ['nome', 'tipo', 'id', 'acoes'];

  constructor(private readonly api: VoxFinanceApiService) {}

  ngOnInit(): void {
    void this.recarregar();
  }

  async recarregar(): Promise<void> {
    this.carregando = true;
    this.erro = '';
    try {
      const rows = await this.api.listarLayouts();
      this.layouts = rows.map((l) => ({ id: l.id, nome: l.nome, tipo: l.tipo }));
    } catch {
      this.erro = 'Erro ao carregar layouts.';
    } finally {
      this.carregando = false;
    }
  }

  nomeTipo(tipo: LayoutParserTipo): string {
    if (tipo === 'itau') return 'Itaú';
    if (tipo === 'itau-uniclass') return 'Itaú Uniclass';
    return 'Genérico';
  }

  async criar(): Promise<void> {
    this.erro = '';
    const nome = this.nome.trim();
    if (!nome) {
      this.erro = 'Informe o nome do layout.';
      return;
    }
    try {
      await this.api.criarLayout({ nome, tipo: this.tipo });
      this.nome = '';
      this.tipo = 'itau';
      await this.recarregar();
    } catch {
      this.erro = 'Erro ao criar layout.';
    }
  }

  async editar(l: { id: string; nome: string; tipo: LayoutParserTipo | string }): Promise<void> {
    const nome = prompt('Nome do layout', l.nome);
    if (nome === null) return;
    const n = nome.trim();
    if (!n) return;

    const tipo = prompt('Tipo do parser: itau, itau-uniclass ou generico', l.tipo) as LayoutParserTipo | null;
    if (tipo === null) return;
    if (tipo !== 'itau' && tipo !== 'itau-uniclass' && tipo !== 'generico') {
      this.erro = 'Tipo inválido.';
      return;
    }

    try {
      await this.api.patchLayout(l.id, { nome: n, tipo });
      await this.recarregar();
    } catch {
      this.erro = 'Erro ao atualizar layout.';
    }
  }

  async excluir(l: { id: string; nome: string; tipo: LayoutParserTipo | string }): Promise<void> {
    const ok = confirm(`Excluir o layout "${l.nome}"?`);
    if (!ok) return;
    try {
      await this.api.excluirLayout(l.id);
      await this.recarregar();
    } catch {
      this.erro = 'Erro ao excluir layout.';
    }
  }
}

