import { z } from 'zod';
import { SEGMENTOS } from './cadastros.js';

const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'Mês no formato AAAA-MM' });
/** Lista na query string: "a,b,c" ou repetida (?x=a&x=b). */
const lista = <T extends z.ZodType<unknown, string>>(item: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) =>
      v === undefined ? [] : (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean),
    )
    .pipe(z.array(item).max(100));
/**
 * Lista sem separar por vírgula: os nomes das divisões de venda têm vírgula
 * ("VENDA DIRETORIA, GERENCIA..."). Vários valores só repetindo o parâmetro (?divisao=a&divisao=b).
 */
const listaExata = <T extends z.ZodType<unknown, string>>(item: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) =>
      (v === undefined ? [] : Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean),
    )
    .pipe(z.array(item).max(100));

/** Chave das vendas sem divisão (pedidos importados antes da coluna DIVISAO VENDA). */
export const SEM_DIVISAO = 'SEM';

export const REGIOES_ENUM = ['NORTE', 'NORDESTE', 'CENTRO_OESTE', 'SUDESTE', 'SUL', 'EXTERIOR'] as const;
export type RegiaoEnum = (typeof REGIOES_ENUM)[number];
export const REGIAO_ENUM_ROTULO: Record<RegiaoEnum, string> = {
  NORTE: 'Norte',
  NORDESTE: 'Nordeste',
  CENTRO_OESTE: 'Centro-Oeste',
  SUDESTE: 'Sudeste',
  SUL: 'Sul',
  EXTERIOR: 'Exterior',
};

/** Filtros globais (persistidos na URL). Ver docs/produto/telas.md. */
export const filtrosSchema = z
  .object({
    de: mes.optional(),
    ate: mes.optional(),
    regiao: lista(z.enum(REGIOES_ENUM)),
    uf: lista(z.string().regex(/^[A-Z]{2}$/)),
    gestor: lista(z.uuid()),
    segmento: lista(z.enum([...SEGMENTOS, 'SEM'])),
    status: lista(z.string().max(10)),
    /** Divisões de venda (nome como no relatório; SEM_DIVISAO = sem divisão). */
    divisao: listaExata(z.string().max(120)),
    q: z.string().trim().max(100).optional(),
  })
  .refine((f) => !f.de || !f.ate || f.de <= f.ate, { error: 'Período inválido', path: ['ate'] });
export type Filtros = z.output<typeof filtrosSchema>;

export const pedidosQuerySchema = z.intersection(
  filtrosSchema,
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(25),
    sort: z.enum(['dtEmissao', 'valor', 'numPedido', 'cliente', 'uf', 'representante']).default('dtEmissao'),
    dir: z.enum(['asc', 'desc']).default('desc'),
  }),
);
export type PedidosQuery = z.output<typeof pedidosQuerySchema>;

export const DIMENSOES_RANKING = ['gestores', 'estados', 'regioes', 'divisoes'] as const;
export type DimensaoRanking = (typeof DIMENSOES_RANKING)[number];

/** Dinheiro trafega como string decimal ("1234.56"); percentuais como número (fração) ou null. */
export interface Variacao {
  anterior: string;
  pct: number | null;
}
export interface Kpi {
  valor: string;
  mesAnterior: Variacao;
  anoAnterior: Variacao;
  serie: { mes: string; valor: string }[];
}
export interface LinhaRanking {
  chave: string;
  rotulo: string;
  total: string;
  qtd: number;
  ticket: string | null;
  participacao: number | null;
}
export interface Ranking {
  periodo: { de: string; ate: string };
  linhas: LinhaRanking[];
  total: { total: string; qtd: number; ticket: string | null };
}
export interface VisaoGeral {
  periodo: { de: string; ate: string };
  kpis: {
    total: Kpi;
    qtd: Kpi;
    ticket: Kpi;
    pctPublico: {
      valor: number | null;
      anoAnterior: number | null;
      serie: { mes: string; valor: number | null }[];
    };
  };
  contagens: { estados: number; regioes: number; gestores: number; clientes: number };
  /** Meses do período (de..ate, "AAAA-MM"; pode cruzar anos) × mesmo mês do ano anterior × meta. */
  evolucao: {
    meses: { mes: string; real: string; anoAnterior: string; meta: string | null }[];
    /** Σ real ÷ Σ meta nos meses do período que têm meta; null = sem meta. */
    atingimento: {
      mesInicial: string;
      mesFinal: string;
      meta: string;
      real: string;
      pct: number | null;
    } | null;
  };
  porRegiao: LinhaRanking[];
  porSegmento: LinhaRanking[];
  /** Divisão de venda do relatório de pedidos; "SEM" = pedidos importados antes da coluna existir. */
  porDivisao: LinhaRanking[];
  topGestores: LinhaRanking[];
  /** Mês a mês do período (de..ate) × mesmo mês do ano anterior, e o total; inclui o faturamento manual. */
  detalhamentoMensal: {
    linhas: { mes: string; atual: string; anterior: string; pct: number | null }[];
    total: { atual: string; anterior: string; pct: number | null };
  };
  /** Selecionado (de..ate) × mesmo período do ano anterior, por segmento. */
  acumuladoSegmento: {
    meses: number;
    periodo: { atual: { de: string; ate: string }; anterior: { de: string; ate: string } };
    total: { atual: string; anterior: string; pct: number | null };
    linhas: { segmento: string; atual: string; anterior: string; pct: number | null }[];
  };
}
export interface ClientesResumo {
  periodo: { de: string; ate: string };
  ranking: (LinhaRanking & { meses: number; novo: boolean })[];
  novos: number;
  recorrentes: number;
  total: number;
}
export interface PedidoLinha {
  id: string;
  focoId: number;
  numPedido: string;
  ordemCpr: string | null;
  dtEmissao: string;
  dtEntrega: string | null;
  status: { codigo: string; descricao: string; cor: string };
  cliente: string;
  uf: string;
  regiao: string;
  gestor: string;
  segmento: string | null;
  divisao: string | null;
  valor: string;
}
