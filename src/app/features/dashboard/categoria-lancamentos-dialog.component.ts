import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { LancamentoImportado } from '../../core/models/importacao-fatura.model';

export interface CategoriaLancamentosDialogData {
  categoria: string;
  lancamentos: LancamentoImportado[];
}

@Component({
  selector: 'app-categoria-lancamentos-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatTableModule, MatIconModule, CurrencyPipe],
  template: `
    <h2 mat-dialog-title class="dlg-title">
      <span class="t">{{ data.categoria }}</span>
      <span class="meta">
        {{ total() | currency:'BRL' }} · {{ data.lancamentos.length }} lançamento(s)
      </span>
    </h2>

    <div mat-dialog-content class="dlg-content">
      <table mat-table [dataSource]="data.lancamentos" class="dlg-table">
        <ng-container matColumnDef="data">
          <th mat-header-cell *matHeaderCellDef>Data</th>
          <td mat-cell *matCellDef="let item">{{ item.data }}</td>
        </ng-container>

        <ng-container matColumnDef="descricao">
          <th mat-header-cell *matHeaderCellDef>Descrição</th>
          <td mat-cell *matCellDef="let item" class="desc">{{ item.descricao }}</td>
        </ng-container>

        <ng-container matColumnDef="valor">
          <th mat-header-cell *matHeaderCellDef>Valor</th>
          <td mat-cell *matCellDef="let item" [class.neg]="item.valor < 0">
            {{ item.valor | currency:'BRL' }}
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr mat-row *matRowDef="let row; columns: cols"></tr>
      </table>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close type="button">Fechar</button>
    </div>
  `,
  styles: [
    `
      .dlg-title {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-bottom: 6px;
      }
      .dlg-title .t {
        font-weight: 900;
        letter-spacing: -0.01em;
      }
      .dlg-title .meta {
        opacity: 0.75;
        font-size: 13px;
      }
      .dlg-content {
        padding-top: 6px;
      }
      .dlg-table {
        width: 100%;
      }
      .desc {
        white-space: pre-line;
        max-width: 520px;
      }
      .neg {
        color: #c62828;
        font-weight: 600;
      }
    `,
  ],
})
export class CategoriaLancamentosDialogComponent {
  cols = ['data', 'descricao', 'valor'];

  constructor(@Inject(MAT_DIALOG_DATA) public data: CategoriaLancamentosDialogData) {}

  total(): number {
    return (this.data.lancamentos ?? []).reduce((acc, l) => acc + (l.valor ?? 0), 0);
  }
}

