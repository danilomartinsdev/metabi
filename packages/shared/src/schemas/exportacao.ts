import { z } from 'zod';
import type { PaletaGrafico } from './auth.js';
import { type Filtros, filtrosSchema, type Ranking, type VisaoGeral } from './dashboard.js';
import {
  type FaturamentoComparativo,
  type FaturamentoMensal,
  type FaturamentoPdfQuery,
  type FaturamentoResumo,
  faturamentoPdfQuerySchema,
} from './faturamento.js';
import { type AnaliseNotas, type AnaliseNotasQuery, analiseNotasQuerySchema } from './notas-fiscais.js';

/** O que pode ser exportado em Excel (uma planilha por tela de análise). */
export const EXPORT_XLSX_TIPOS = ['pedidos', 'gestores', 'estados', 'regioes', 'clientes'] as const;
export type ExportXlsxTipo = (typeof EXPORT_XLSX_TIPOS)[number];

/** Formatos de arquivo oferecidos no diálogo de exportação. */
export const EXPORT_FORMATOS = ['pdf', 'xlsx', 'csv'] as const;
export type ExportFormato = (typeof EXPORT_FORMATOS)[number];
export const EXPORT_FORMATOS_PLANILHA = ['xlsx', 'csv'] as const;
export type ExportFormatoPlanilha = (typeof EXPORT_FORMATOS_PLANILHA)[number];

/** Blocos que o usuário marca/desmarca antes de exportar (ids estáveis: vão na URL e no token de impressão). */
export const SECOES_EXPORT = {
  vendas: [
    { id: 'kpis', rotulo: 'Indicadores (total, pedidos, ticket médio, % público)' },
    { id: 'evolucao', rotulo: 'Evolução mensal — real × ano anterior' },
    { id: 'participacao', rotulo: 'Participação por região e Público × Privado' },
    { id: 'topGestores', rotulo: 'Top 10 representantes' },
    { id: 'comparativo', rotulo: 'Comparativo com o ano anterior' },
    { id: 'detalhamento', rotulo: 'Detalhamento mês a mês' },
    { id: 'rankGestores', rotulo: 'Ranking de representantes' },
    { id: 'rankEstados', rotulo: 'Ranking de estados' },
    { id: 'rankRegioes', rotulo: 'Ranking de regiões' },
  ],
  faturamento: [
    { id: 'kpis', rotulo: 'Indicadores de faturamento' },
    { id: 'grafico', rotulo: 'Gráfico mês a mês' },
    { id: 'mensal', rotulo: 'Tabela mês a mês' },
    { id: 'comparativo', rotulo: 'Comparativo entre anos' },
  ],
  'analise-faturamento': [
    { id: 'kpis', rotulo: 'Indicadores de faturamento' },
    { id: 'divisao', rotulo: 'Faturamento por divisão de venda' },
    { id: 'regiao', rotulo: 'Faturamento por região e estado (mapas)' },
    { id: 'ranking', rotulo: 'Ranking por representante' },
    { id: 'abcClientes', rotulo: 'Curva ABC por cliente' },
    { id: 'abcProdutos', rotulo: 'Curva ABC por produto' },
  ],
} as const;
export type RelatorioExport = keyof typeof SECOES_EXPORT;

const ID_SECAO = z.enum([
  ...new Set(Object.values(SECOES_EXPORT).flatMap((l) => l.map((x) => x.id))),
] as [string, ...string[]]);

/** Lista de seções na query ("a,b" ou repetida). Ausente = relatório completo (undefined). */
export const secoesSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    v === undefined ? undefined : (Array.isArray(v) ? v : v.split(',')).map((x) => x.trim()).filter(Boolean),
  )
  .pipe(z.array(ID_SECAO).max(20).optional());

/** "Quebrar página por assunto" (checkbox do diálogo): ?quebra=1. Ausente = contínuo. */
export const quebraSchema = z
  .enum(['0', '1', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true');

/** Curva ABC de produtos no PDF da Análise: pelo valor vendido, pela quantidade ou as duas. */
export const ABC_PRODUTOS_MODOS = ['valor', 'quantidade', 'ambos'] as const;
export type AbcProdutosModo = (typeof ABC_PRODUTOS_MODOS)[number];
export const abcProdutosModoSchema = z.enum(ABC_PRODUTOS_MODOS).optional();

/** PDF das vendas: filtros globais + seções marcadas. */
export const exportPdfQuerySchema = z.intersection(
  filtrosSchema,
  z.object({ secoes: secoesSchema, quebra: quebraSchema }),
);
export type ExportPdfQuery = z.output<typeof exportPdfQuerySchema>;

/** Planilha/CSV da Visão geral: filtros + formato + seções marcadas. */
export const exportVisaoGeralQuerySchema = z.intersection(
  filtrosSchema,
  z.object({ formato: z.enum(EXPORT_FORMATOS_PLANILHA).default('xlsx'), secoes: secoesSchema }),
);
export type ExportVisaoGeralQuery = z.output<typeof exportVisaoGeralQuerySchema>;

/** Filtros globais + ordenação (usada só na exportação de pedidos) + formato do arquivo. */
export const exportXlsxQuerySchema = z.intersection(
  filtrosSchema,
  z.object({
    formato: z.enum(EXPORT_FORMATOS_PLANILHA).default('xlsx'),
    sort: z.enum(['dtEmissao', 'valor', 'numPedido', 'cliente', 'uf', 'representante']).default('dtEmissao'),
    dir: z.enum(['asc', 'desc']).default('desc'),
  }),
);
export type ExportXlsxQuery = z.output<typeof exportXlsxQuerySchema>;

/** Token de impressão: base64url de 32 bytes. */
export const printTokenSchema = z.object({ token: z.string().regex(/^[\w-]{43}$/) });

/** O que um token de impressão autoriza: qual relatório e com quais parâmetros (guardado no token). */
export const solicitacaoImpressaoSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('vendas'),
    filtros: filtrosSchema,
    secoes: z.array(ID_SECAO).optional(),
    quebra: z.boolean().optional(),
  }),
  z.object({
    tipo: z.literal('faturamento'),
    params: faturamentoPdfQuerySchema,
    secoes: z.array(ID_SECAO).optional(),
    quebra: z.boolean().optional(),
  }),
  z.object({
    tipo: z.literal('analise-faturamento'),
    params: analiseNotasQuerySchema,
    secoes: z.array(ID_SECAO).optional(),
    abcProdutos: abcProdutosModoSchema,
    quebra: z.boolean().optional(),
  }),
]);
export type SolicitacaoImpressao = z.output<typeof solicitacaoImpressaoSchema>;

/** Dados do PDF de faturamento (rota /print/faturamento da SPA). */
export interface FaturamentoImpressao {
  geradoPor: string;
  /** Cada seção começa numa página nova. */
  quebra?: boolean;
  /** Seções marcadas pelo usuário; ausente = tudo. */
  secoes?: string[];
  geradoEm: string;
  paletaGraficos: PaletaGrafico | null;
  params: FaturamentoPdfQuery;
  resumo: FaturamentoResumo;
  mensal: FaturamentoMensal;
  comparativo: FaturamentoComparativo | null;
}

/** Dados do PDF da Análise de faturamento (rota /print/analise-faturamento da SPA). */
export interface AnaliseFaturamentoImpressao {
  geradoPor: string;
  quebra?: boolean;
  secoes?: string[];
  /** Curva ABC de produtos escolhida no diálogo (ausente = por valor). */
  abcProdutos?: AbcProdutosModo;
  geradoEm: string;
  paletaGraficos: PaletaGrafico | null;
  params: AnaliseNotasQuery;
  analise: AnaliseNotas;
}

/** Dados do relatório executivo em PDF (rota /print/relatorio da SPA). */
export interface RelatorioImpressao {
  geradoPor: string;
  quebra?: boolean;
  secoes?: string[];
  geradoEm: string;
  /** Paleta de quem pediu o PDF (o relatório sai com as cores dele). */
  paletaGraficos: PaletaGrafico | null;
  filtros: Filtros;
  visaoGeral: VisaoGeral;
  rankings: { gestores: Ranking; estados: Ranking; regioes: Ranking };
}
