import { Injectable } from '@angular/core';
import { Categoria } from '../models/categoria.model';

@Injectable({
  providedIn: 'root',
})
export class CategoriaService {
  private categorias: Categoria[] = [
    {
      nome: 'Alimentação',
      palavrasChave: ['ifd', 'ifood', 'restaurante', 'acougue', 'mercado', 'food', 'lanch'],
    },
    {
      nome: 'Transporte',
      palavrasChave: ['posto', 'connectcar', 'veiculos', 'estacionamento', 'uber'],
    },
    {
      nome: 'Compras Online',
      palavrasChave: ['mercadolivre', 'mercado*mercadoli', 'amazon', 'shopee'],
    },
    {
      nome: 'Vestuário',
      palavrasChave: ['vestuario', 'bernardo', 'calçados', 'calcados'],
    },
    {
      nome: 'Saúde',
      palavrasChave: ['saude', 'drogasil', 'farmacia'],
    },
    {
      nome: 'Lazer',
      palavrasChave: ['apple', 'hobby', 'turismo', 'fitness'],
    },
  ];

  listarNomesCategorias(): string[] {
    const nomes = this.categorias.map((c) => c.nome);
    if (!nomes.includes('Outros')) {
      nomes.push('Outros');
    }
    return nomes;
  }

  classificar(descricao: string): string {
    const texto = descricao.toLowerCase();

    for (const categoria of this.categorias) {
      const encontrou = categoria.palavrasChave.some((palavra) =>
        texto.includes(palavra.toLowerCase())
      );

      if (encontrou) {
        return categoria.nome;
      }
    }

    return 'Outros';
  }
}