import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ApiConfigService } from '../../../core/services/api-config.service';
import { VoxFinanceApiService } from '../../../core/services/vox-finance-api.service';

@Component({
  selector: 'app-parametros',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './parametros.component.html',
  styleUrl: './parametros.component.scss',
})
export class ParametrosComponent implements OnInit {
  valor = signal('');
  salvando = signal(false);
  testando = signal(false);
  erro = signal('');
  sucesso = signal('');

  apiAtual = computed(() => this.cfg.getResolvedApiBaseUrl());

  constructor(
    private readonly cfg: ApiConfigService,
    private readonly api: VoxFinanceApiService,
  ) {}

  ngOnInit(): void {
    // mostra o valor configurado (se houver); se não, mostra o default resolvido
    this.valor.set(this.cfg.apiBaseUrl() || this.cfg.getResolvedApiBaseUrl());
  }

  salvar(): void {
    this.sucesso.set('');
    this.erro.set('');
    this.salvando.set(true);
    try {
      this.cfg.setApiBaseUrl(this.valor());
      this.sucesso.set('Parâmetro salvo.');
    } catch {
      this.erro.set('Falha ao salvar parâmetro.');
    } finally {
      this.salvando.set(false);
    }
  }

  restaurarPadrao(): void {
    this.sucesso.set('');
    this.erro.set('');
    this.cfg.resetToDefault();
    this.valor.set(this.cfg.getResolvedApiBaseUrl());
    this.sucesso.set('Voltamos para o padrão.');
  }

  async testar(): Promise<void> {
    this.sucesso.set('');
    this.erro.set('');
    this.testando.set(true);
    try {
      // garante que o teste usa o valor atual do input
      this.cfg.setApiBaseUrl(this.valor());
      await this.api.health();
      this.sucesso.set('Conexão OK com a API.');
    } catch {
      this.erro.set('Falha ao conectar na API. Verifique a URL e o CORS no Render.');
    } finally {
      this.testando.set(false);
    }
  }
}

