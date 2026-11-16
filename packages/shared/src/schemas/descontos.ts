import { z } from 'zod';
import { codigoProdutoAgrupado } from './notas-fiscais.js';

/**
 * Descontos: cada produto (código agrupado, como na curva ABC) tem um preço de tabela por ano.
 * Desconto = preço de tabela × quantidade vendida − valor vendido (itens de NF).
 * Cada ano tem a sua tabela: alterar os preços de um ano não muda os números dos outros. Num período que
 * cruza anos, cada mês usa a tabela do seu ano.
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

const ano = z.coerce.number().int().min(2020).max(2100);
const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'Mês no formato AAAA-MM' });

// ---- Tabela de preços (cadastro) ----

export const tabelaPrecosQuerySchema = z.object({ ano });
export type TabelaPrecosQuery = z.infer<typeof tabelaPrecosQuerySchema>;

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

/** Produto incluído à mão (ainda não saiu em nota): o código segue a regra da curva ABC (sem ponto final). */
export const produtoNovoSchema = z.object({
  codigo: z
    .string()
    .trim()
    .transform(codigoProdutoAgrupado)
    .pipe(z.string().min(1, { error: 'Informe o código' }).max(60)),
  descricao: z.string().trim().min(1, { error: 'Informe a descrição' }).max(300),
  unidade: z.string().trim().toUpperCase().max(10, { error: 'Unidade muito longa' }),
});
export type ProdutoNovo = z.output<typeof produtoNovoSchema>;

export const produtoChaveSchema = z.object({
  codigo: z.string().trim().min(1).max(60),
  unidade: z.string().trim().max(10).default(''),
});
export type ProdutoChave = z.output<typeof produtoChaveSchema>;

export interface ProdutoPreco {
  codigo: string;
  descricao: string;
  /** "" = sem unidade. */
  unidade: string;
  /** Incluído à mão na tabela de preços (pode ser excluído); false = veio das notas fiscais. */
  manual: boolean;
  /** Última nota em que o produto saiu (AAAA-MM-DD); null = nunca vendido. */
  ultimaVenda: string | null;
  preco: string | null;
  /** Preço do ano anterior, para preencher a tabela nova a partir dele. */
  precoAnoAnterior: string | null;
}

export interface TabelaPrecos {
  ano: number;
  /** Anos da tabela de preços, incluídos pelo usuário (mais recente primeiro). */
  anos: { ano: number; precos: number }[];
  produtos: ProdutoPreco[];
}

/** Incluir um ano na tabela de preços; `copiarDe` copia os preços de outro ano como ponto de partida. */
export const anoNovoSchema = z.object({
  ano: z.number().int().min(2020).max(2100),
  copiarDe: z.number().int().min(2020).max(2100).nullish(),
});
export type AnoNovo = z.output<typeof anoNovoSchema>;
export const anoParamSchema = ano;

// ---- Análise de descontos ----

export const analiseDescontosQuerySchema = z
  .object({ de: mes.optional(), ate: mes.optional() })
  .refine((f) => !f.de || !f.ate || f.de <= f.ate, { error: 'Período inválido', path: ['ate'] });
export type AnaliseDescontosQuery = z.output<typeof analiseDescontosQuerySchema>;

/** Valores monetários e quantidades como string decimal ("1234.56"). */
export interface DescontoProduto {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  vendido: string;
  /** Vendido nos meses em que o produto tinha preço de tabela. */
  vendidoComPreco: string;
  /** Preço de tabela (só quando o período está num ano só; null = sem preço ou vários anos). */
  preco: string | null;
  /** null = sem preço de tabela em nenhum mês do período. */
  valorTabela: string | null;
  desconto: string | null;
  /** desconto / valorTabela (fração). Negativo = vendido acima da tabela. */
  percentual: number | null;
  /** Parte das vendas ficou fora do cálculo (algum ano do período sem preço). */
  precoParcial: boolean;
}

export interface AnaliseDescontos {
  periodo: { de: string; ate: string };
  temDados: boolean;
  resumo: {
    /** Todo o faturamento do período (itens de NF). */
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
  /** Maior desconto primeiro; produtos sem preço no fim (pelo valor vendido). */
  produtos: DescontoProduto[];
}
