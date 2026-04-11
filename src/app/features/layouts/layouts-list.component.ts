import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { HttpErrorResponse } from '@angular/common/http';

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
    } catch (e) {
      this.erro = this.mensagemErroApi(e, 'Erro ao carregar layouts.');
    } finally {
      this.carregando = false;
    }
  }

  nomeTipo(tipo: LayoutParserTipo): string {
    if (tipo === 'itau') return 'Itaú';
    if (tipo === 'itau-uniclass') return 'Itaú Uniclass';
    if (tipo === 'itau-empresa') return 'Itaú Empresa';
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
    } catch (e) {
      this.erro = this.mensagemErroApi(e, 'Erro ao criar layout.');
    }
  }

  async editar(l: { id: string; nome: string; tipo: LayoutParserTipo | string }): Promise<void> {
    const nome = prompt('Nome do layout', l.nome);
    if (nome === null) return;
    const n = nome.trim();
    if (!n) return;

    const tipo = prompt('Tipo do parser: itau, itau-uniclass, itau-empresa ou generico', l.tipo) as LayoutParserTipo | null;
    if (tipo === null) return;
    if (tipo !== 'itau' && tipo !== 'itau-uniclass' && tipo !== 'itau-empresa' && tipo !== 'generico') {
      this.erro = 'Tipo inválido.';
      return;
    }

    try {
      await this.api.patchLayout(l.id, { nome: n, tipo });
      await this.recarregar();
    } catch (e) {
      this.erro = this.mensagemErroApi(e, 'Erro ao atualizar layout.');
    }
  }

  async excluir(l: { id: string; nome: string; tipo: LayoutParserTipo | string }): Promise<void> {
    const ok = confirm(`Excluir o layout "${l.nome}"?`);
    if (!ok) return;
    try {
      await this.api.excluirLayout(l.id);
      await this.recarregar();
    } catch (e) {
      this.erro = this.mensagemErroApi(e, 'Erro ao excluir layout.');
    }
  }

  private mensagemErroApi(err: unknown, prefixo: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      let det = '';
      if (typeof body === 'string' && body.trim()) {
        det = body.trim();
      } else if (body && typeof body === 'object' && 'detail' in body) {
        const d = (body as { detail: unknown }).detail;
        if (typeof d === 'string') {
          det = d;
        } else if (Array.isArray(d)) {
          det = d
            .map((x: { msg?: string; loc?: unknown[] }) => (typeof x?.msg === 'string' ? x.msg : JSON.stringify(x)))
            .join(' ');
        }
      }
      if (det) {
        return `${prefixo} ${det}`;
      }
      if (err.status === 0) {
        return `${prefixo} Sem resposta (CORS, API offline ou URL errada em Parâmetros).`;
      }
      return `${prefixo} HTTP ${err.status}.`;
    }
    return prefixo;
  }
}

