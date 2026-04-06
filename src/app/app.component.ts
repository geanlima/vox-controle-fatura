import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BreakpointObserver } from '@angular/cdk/layout';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly bo = inject(BreakpointObserver);
  isDesktop = signal(false);
  search = signal('');
  cadastroAberto = signal(false);
  faturaAberto = signal(false);
  movimentoAberto = signal(false);
  configuracoesAberto = signal(false);

  constructor() {
    this.bo.observe(['(min-width: 980px)']).subscribe((r) => this.isDesktop.set(r.matches));
  }

  toggleGrupo(grupo: 'cadastro' | 'fatura' | 'movimento' | 'configuracoes'): void {
    if (grupo === 'cadastro') {
      this.cadastroAberto.update((v) => !v);
      return;
    }
    if (grupo === 'fatura') {
      this.faturaAberto.update((v) => !v);
      return;
    }
    if (grupo === 'configuracoes') {
      this.configuracoesAberto.update((v) => !v);
      return;
    }
    this.movimentoAberto.update((v) => !v);
  }
}