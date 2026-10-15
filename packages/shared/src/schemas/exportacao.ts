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

/** Filtros globais + ordenação (usada só na exportação de pedidos). */
export const exportXlsxQuerySchema = z.intersection(
  filtrosSchema,
  z.object({
    sort: z.enum(['dtEmissao', 'valor', 'numPedido', 'cliente', 'uf', 'representante']).default('dtEmissao'),
    dir: z.enum(['asc', 'desc']).default('desc'),
  }),
);
export type ExportXlsxQuery = z.output<typeof exportXlsxQuerySchema>;

/** Token de impressão: base64url de 32 bytes. */
export const printTokenSchema = z.object({ token: z.string().regex(/^[\w-]{43}$/) });

/** O que um token de impressão autoriza: qual relatório e com quais parâmetros (guardado no token). */
export const solicitacaoImpressaoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('vendas'), filtros: filtrosSchema }),
  z.object({ tipo: z.literal('faturamento'), params: faturamentoPdfQuerySchema }),
  z.object({ tipo: z.literal('analise-faturamento'), params: analiseNotasQuerySchema }),
]);
export type SolicitacaoImpressao = z.output<typeof solicitacaoImpressaoSchema>;

/** Dados do PDF de faturamento (rota /print/faturamento da SPA). */
export interface FaturamentoImpressao {
  geradoPor: string;
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
  geradoEm: string;
  paletaGraficos: PaletaGrafico | null;
  params: AnaliseNotasQuery;
  analise: AnaliseNotas;
}

/** Dados do relatório executivo em PDF (rota /print/relatorio da SPA). */
export interface RelatorioImpressao {
  geradoPor: string;
  geradoEm: string;
  /** Paleta de quem pediu o PDF (o relatório sai com as cores dele). */
  paletaGraficos: PaletaGrafico | null;
  filtros: Filtros;
  visaoGeral: VisaoGeral;
  rankings: { gestores: Ranking; estados: Ranking; regioes: Ranking };
}
