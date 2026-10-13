import { z } from 'zod';
import { dataBR, decimalBR, type ErroLinha } from './importacao.js';

/**
 * Colunas usadas do relatório de notas fiscais do Focco ("Intermediador de fontes de dados de widgets"):
 * uma linha por item de nota. As demais colunas da planilha são ignoradas.
 */
export const COLUNAS_NOTAS = {
  itemId: 'ITNFS_ID',
  notaId: 'NFS_ID',
  numNota: 'NUM_NOTA',
  dataEmissao: 'DATA_EMISSAO',
  tipoNota: 'TIPO_NOTA',
  divisao: 'DIVD_DESCRICAO',
  repCodigo: 'REP_CODIGO',
  repNome: 'REP_DESCRICAO',
  cliCodigo: 'CLI_CODIGO',
  cliRazaoSocial: 'CLI_RAZAO_SOCIAL',
  cliNomeFantasia: 'CLI_NOME_FANTASIA',
  cliCidade: 'CLI_CIDADE',
  cliUf: 'CLI_UF',
  produtoCodigo: 'ITNFS_CODIGO',
  produtoDescricao: 'ITNFS_DESCRICAO',
  quantidade: 'ITNFS_QUANTIDADE',
  valorTotal: 'ITNFS_VALOR_TOTAL',
} as const;

/**
 * O Focco grava variantes do mesmo produto com um ponto no fim do código ("MT169." e "MT169").
 * Na curva ABC elas são o mesmo produto: o código agrupado não tem ponto final.
 */
export const codigoProdutoAgrupado = (codigo: string) => codigo.trim().replace(/\.+$/, '');
/** Descrição sem o ponto final das variantes ("… EVOLUTION CARE MT169." → "… EVOLUTION CARE MT169"). */
export const descricaoProdutoAgrupada = (descricao: string) =>
  descricao.trim().replace(/\.+$/, '').replace(/\s+/g, ' ');

const texto = (campo: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, { error: `${campo} vazio` })
    .max(max, { error: `${campo} muito longo` });
const opcional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null);
const id = (campo: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, { error: `${campo} inválido` })
    .transform(Number);
const decimal = (campo: string) =>
  z.string().transform((s, c) => {
    const v = decimalBR(s);
    if (v === null) {
      c.addIssue({ code: 'custom', message: `${campo} inválido: "${s.slice(0, 30)}"` });
      return z.NEVER;
    }
    return v;
  });

/** Valida e normaliza uma linha bruta (strings) do relatório de notas fiscais. */
export const linhaNotaSchema = z.object({
  itemId: id('ITNFS_ID'),
  notaId: id('NFS_ID'),
  numNota: texto('NUM_NOTA', 30),
  // "07/04/2026 00:00:00" → "2026-04-07" (a hora é descartada).
  dataEmissao: z.string().transform((s, c) => {
    const d = dataBR(s.trim().split(/\s+/)[0] ?? '');
    if (!d) {
      c.addIssue({ code: 'custom', message: `DATA_EMISSAO inválida: "${s.slice(0, 30)}"` });
      return z.NEVER;
    }
    return d;
  }),
  tipoNota: texto('TIPO_NOTA', 60),
  divisao: texto('DIVD_DESCRICAO', 120),
  repCodigo: texto('REP_CODIGO', 30),
  repNome: texto('REP_DESCRICAO', 120),
  cliCodigo: texto('CLI_CODIGO', 30),
  cliRazaoSocial: texto('CLI_RAZAO_SOCIAL', 200),
  cliNomeFantasia: opcional(200),
  cliCidade: opcional(120),
  cliUf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, { error: 'CLI_UF inválida' }),
  produtoCodigo: texto('ITNFS_CODIGO', 60),
  produtoDescricao: texto('ITNFS_DESCRICAO', 300),
  quantidade: decimal('ITNFS_QUANTIDADE'),
  valorTotal: decimal('ITNFS_VALOR_TOTAL'),
});
export type LinhaNota = z.output<typeof linhaNotaSchema>;

const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'Mês no formato AAAA-MM' });
export const analiseNotasQuerySchema = z
  .object({ de: mes.optional(), ate: mes.optional() })
  .refine((f) => !f.de || !f.ate || f.de <= f.ate, { error: 'Período inválido', path: ['ate'] });
export type AnaliseNotasQuery = z.output<typeof analiseNotasQuerySchema>;

export const confirmarNotasSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  arquivoNome: z.string().trim().min(1).max(200),
});

export interface PreviaNotas {
  hash: string;
  arquivoNome: string;
  itens: number;
  notas: number;
  total: string;
  /** Meses ("AAAA-MM") do arquivo: cada um é substituído por completo ao confirmar. */
  meses: { mes: string; itens: number; total: string; itensExistentes: number; totalExistente: string }[];
  erros: ErroLinha[];
}

export interface LoteNotas {
  id: string;
  arquivoNome: string;
  itens: number;
  total: string;
  meses: string[];
  usuario: string | null;
  createdAt: string;
}

/** Classe da curva ABC: A até 80% do acumulado, B até 95%, C o restante. */
export type ClasseAbc = 'A' | 'B' | 'C';
export const LIMITES_ABC = { A: 0.8, B: 0.95 } as const;

/**
 * Curva ABC de linhas já ordenadas do maior para o menor valor. A classe vem do acumulado ANTES do item
 * (o item que cruza 80% ainda é A), então o maior item é sempre A. Valores como string decimal; as
 * frações são só para exibição.
 */
export function curvaAbc<T extends { total: string }>(
  linhas: T[],
  total: string,
): (T & { participacao: number; acumulado: number; classe: ClasseAbc })[] {
  const t = Number(total);
  let acumuladoCentavos = 0;
  return linhas.map((l) => {
    const anterior = t > 0 ? acumuladoCentavos / 100 / t : 0;
    acumuladoCentavos += Math.round(Number(l.total) * 100);
    const classe: ClasseAbc = anterior < LIMITES_ABC.A ? 'A' : anterior < LIMITES_ABC.B ? 'B' : 'C';
    return {
      ...l,
      participacao: t > 0 ? Number(l.total) / t : 0,
      acumulado: t > 0 ? acumuladoCentavos / 100 / t : 0,
      classe,
    };
  });
}

export interface AnaliseNotas {
  periodo: { de: string; ate: string };
  temDados: boolean;
  total: string;
  notas: number;
  clientes: number;
  /** Fatias do gráfico de pizza (maior primeiro); participacao em fração (0–1). */
  divisoes: { divisao: string; total: string; notas: number; participacao: number }[];
  representantes: {
    codigo: string;
    nome: string;
    total: string;
    notas: number;
    clientes: number;
    participacao: number;
  }[];
  abcClientes: {
    codigo: string;
    nomeFantasia: string | null;
    razaoSocial: string;
    uf: string;
    total: string;
    notas: number;
    participacao: number;
    acumulado: number;
    classe: ClasseAbc;
  }[];
  abcProdutos: {
    codigo: string;
    descricao: string;
    quantidade: string;
    total: string;
    participacao: number;
    acumulado: number;
    classe: ClasseAbc;
  }[];
}
