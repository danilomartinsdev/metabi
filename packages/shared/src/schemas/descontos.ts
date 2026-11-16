import { z } from 'zod';

/**
 * Previsão de descontos: cada produto (código agrupado, como na curva ABC) tem um preço de tabela por ano.
 * Desconto = preço de tabela × quantidade vendida − valor vendido (itens de NF do ano).
 * Cada ano tem a sua tabela: alterar os preços de um ano não muda os números dos outros.
 */

/** Preço unitário digitado: "1.234,5678", "1234.56" ou número; até 4 casas decimais. */
export const precoTabelaSchema = z.union([z.string(), z.number()]).transform((v, c) => {
  const s = String(v).trim();
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  if (!/^\d{1,10}(\.\d{1,4})?$/.test(norm)) {
    c.addIssue({ code: 'custom', message: 'Preço inválido' });
    return z.NEVER;
  }
  return norm;
});

export const descontosQuerySchema = z.object({ ano: z.coerce.number().int().min(2020).max(2100) });
export type DescontosQuery = z.infer<typeof descontosQuerySchema>;

/** Grava preços de um ano: preço null apaga o preço daquele produto/unidade. */
export const precosSalvarSchema = z.object({
  ano: z.number().int().min(2020).max(2100),
  precos: z
    .array(
      z.object({
        produtoCodigo: z.string().trim().min(1).max(60),
        /** Unidade de medida como veio do Focco (UN, KG…); "" = sem unidade. */
        unidade: z.string().trim().max(10),
        preco: precoTabelaSchema.nullable(),
      }),
    )
    .min(1)
    .max(5000),
});
export type PrecosSalvar = z.infer<typeof precosSalvarSchema>;

/** Valores monetários e quantidades como string decimal ("1234.56"); null = produto sem preço no ano. */
export interface DescontoProduto {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  vendido: string;
  preco: string | null;
  /** Preço do ano anterior, para preencher a tabela nova a partir dele. */
  precoAnoAnterior: string | null;
  valorTabela: string | null;
  desconto: string | null;
  /** desconto / valorTabela (fração). Negativo = vendido acima da tabela. */
  percentual: number | null;
}

export interface DescontoRepresentante {
  codigo: string;
  nome: string;
  /** Só itens com preço de tabela no ano. */
  vendido: string;
  valorTabela: string;
  desconto: string;
  percentual: number | null;
}

export interface DescontosAno {
  ano: number;
  /** Anos com notas importadas ou com tabela de preços (mais recente primeiro). */
  anos: number[];
  temNotas: boolean;
  resumo: {
    /** Todo o faturamento do ano (itens de NF). */
    vendidoTotal: string;
    /** Faturamento dos itens que têm preço de tabela. */
    vendidoComPreco: string;
    valorTabela: string;
    desconto: string;
    percentual: number | null;
    /** vendidoComPreco / vendidoTotal: quanto do faturamento entrou no cálculo. */
    cobertura: number | null;
    produtos: number;
    produtosComPreco: number;
  };
  produtos: DescontoProduto[];
  representantes: DescontoRepresentante[];
}
