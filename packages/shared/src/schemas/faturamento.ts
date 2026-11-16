import { z } from 'zod';
import { dataBR, decimalBR, type ErroLinha } from './importacao.js';

/**
 * Colunas do relatório diário de faturamento do Focco (domínio separado dos pedidos).
 * Uma linha por dia. "VLR FATURA DRE" = bruto + antecipado + remessa + devolução.
 */
export const COLUNAS_FATURAMENTO = {
  empresa: 'EMPRESA',
  ano: 'ANO',
  mes: 'MES',
  semana: 'SEMANA',
  data: 'DATA',
  bruto: 'VLR FAT BRUTO',
  antecipado: 'VLR FAT ANTECIP',
  remessa: 'VLR REMESSA',
  devolucao: 'VLR DEVOLUCAO',
  dre: 'VLR FATURA DRE',
} as const;
export type CampoFaturamento = keyof typeof COLUNAS_FATURAMENTO;

/** Célula vazia de valor = 0 (o relatório deixa em branco os dias sem movimento daquele tipo). */
const valor = (campo: string) =>
  z.string().transform((s, c) => {
    if (!s.trim()) return '0.00';
    const v = decimalBR(s);
    if (v === null) {
      c.addIssue({ code: 'custom', message: `${campo} inválido: "${s.slice(0, 30)}"` });
      return z.NEVER;
    }
    return v;
  });

const inteiro = (campo: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, { error: `${campo} inválido` })
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(min, { error: `${campo} fora do intervalo` })
        .max(max, { error: `${campo} fora do intervalo` }),
    );

const centavos = (s: string) => BigInt(s.replace('.', ''));

/** Valida e normaliza uma linha bruta (strings) do relatório de faturamento. */
export const linhaFaturamentoSchema = z
  .object({
    empresa: z.string().trim().min(1, { error: 'EMPRESA vazia' }).max(120),
    ano: inteiro('ANO', 2000, 2100),
    mes: inteiro('MES', 1, 12),
    semana: inteiro('SEMANA', 1, 53),
    // "08/01/2026 00:00:00" → "2026-01-08" (a hora é sempre 00:00:00 e é descartada).
    data: z.string().transform((s, c) => {
      const d = dataBR(s.trim().split(/\s+/)[0] ?? '');
      if (!d) {
        c.addIssue({ code: 'custom', message: `DATA inválida: "${s.slice(0, 30)}"` });
        return z.NEVER;
      }
      return d;
    }),
    bruto: valor('VLR FAT BRUTO'),
    antecipado: valor('VLR FAT ANTECIP'),
    remessa: valor('VLR REMESSA'),
    devolucao: valor('VLR DEVOLUCAO'),
    dre: valor('VLR FATURA DRE'),
  })
  .superRefine((l, c) => {
    if (Number(l.data.slice(0, 4)) !== l.ano || Number(l.data.slice(5, 7)) !== l.mes) {
      c.addIssue({ code: 'custom', message: 'DATA não bate com ANO/MES', path: ['data'] });
    }
    const soma = centavos(l.bruto) + centavos(l.antecipado) + centavos(l.remessa) + centavos(l.devolucao);
    const diff = soma - centavos(l.dre);
    if (diff > 1n || diff < -1n) {
      c.addIssue({
        code: 'custom',
        message: 'VLR FATURA DRE diferente de bruto + antecipado + remessa + devolução',
        path: ['dre'],
      });
    }
  });
export type LinhaFaturamento = z.output<typeof linhaFaturamentoSchema>;

const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'Mês no formato AAAA-MM' });
export const faturamentoQuerySchema = z
  .object({ de: mes.optional(), ate: mes.optional() })
  .refine((f) => !f.de || !f.ate || f.de <= f.ate, { error: 'Período inválido', path: ['ate'] });
export type FaturamentoQuery = z.output<typeof faturamentoQuerySchema>;

export const confirmarFaturamentoSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  arquivoNome: z.string().trim().min(1).max(200),
  /** Meses (1–12) do arquivo escolhidos para importar; só eles são substituídos. Ausente = todos do arquivo. */
  meses: z
    .array(z.number().int().min(1).max(12))
    .min(1, { error: 'Escolha ao menos um mês' })
    .max(12)
    .optional(),
});

/** Totais (strings decimais) das colunas do relatório. */
export interface TotaisFaturamento {
  bruto: string;
  antecipado: string;
  remessa: string;
  devolucao: string;
  dre: string;
}

export interface PreviaFaturamento {
  hash: string;
  arquivoNome: string;
  ano: number | null;
  dias: number;
  /** Por mês do arquivo: o que vem nele e o que já está gravado (será substituído se o mês for importado). */
  meses: { mes: number; dias: number; dre: string; diasExistentes: number; dreExistente: string }[];
  totais: TotaisFaturamento;
  /** Dias já gravados nos meses do arquivo (todos os meses; o confirmar apaga só os escolhidos). */
  diasSubstituidos: number;
  erros: ErroLinha[];
}

export interface LoteFaturamento {
  id: string;
  ano: number;
  arquivoNome: string;
  dias: number;
  totalDre: string;
  usuario: string | null;
  createdAt: string;
}

export interface FaturamentoResumo {
  periodo: { de: string; ate: string };
  temDados: boolean;
  kpis: Record<keyof TotaisFaturamento, { valor: string; anterior: string; pct: number | null }>;
  /**
   * Mês a mês do período (de..ate, "AAAA-MM"; pode cruzar anos): cada coluna + DRE do mesmo mês do ano
   * anterior. Total = soma do período (igual aos KPIs).
   */
  mensal: {
    meses: (TotaisFaturamento & { mes: string; dreAnoAnterior: string })[];
    total: TotaisFaturamento;
  };
  /** Dias do período, com a semana do relatório (SEMANA) para filtrar por semana. */
  diario: { data: string; ano: number; semana: number; dre: string }[];
  semanal: { ano: number; semana: number; inicio: string; dre: string }[];
}

const anoParam = z.coerce.number().int().min(2000).max(2100);
/**
 * "8,9,10" (query string) ou [8, 9, 10] → [8, 9, 10], sem repetidos e em ordem. Aceitar a lista já
 * convertida deixa o schema idempotente (o PDF guarda os parâmetros validados no token e valida de novo).
 */
const listaMeses = z
  .preprocess(
    (v) => (typeof v === 'string' && /^\d{1,2}(,\d{1,2})*$/.test(v) ? v.split(',').map(Number) : v),
    z.array(z.number().int().min(1).max(12), { error: 'Meses no formato 1,2,3' }).min(1).max(12),
  )
  .transform((ms) => [...new Set(ms)].sort((a, b) => a - b));
export const faturamentoComparativoQuerySchema = z
  .object({ anoA: anoParam, anoB: anoParam, meses: listaMeses.optional() })
  .refine((q) => q.anoA !== q.anoB, { error: 'Escolha dois anos diferentes', path: ['anoB'] });
export type FaturamentoComparativoQuery = z.output<typeof faturamentoComparativoQuerySchema>;

export type CampoTotalFaturamento = keyof TotaisFaturamento;
export const CAMPOS_FATURAMENTO = ['dre', 'bruto', 'antecipado', 'remessa', 'devolucao'] as const;

/**
 * PDF de faturamento: o que está na tela — período (de/ate; também define a tabela mês a mês) e, se
 * houver, o comparativo (anos, meses escolhidos e indicador).
 */
export const faturamentoPdfQuerySchema = z
  .object({
    de: mes.optional(),
    ate: mes.optional(),
    anoA: anoParam.optional(),
    anoB: anoParam.optional(),
    meses: listaMeses.optional(),
    indicador: z.enum(CAMPOS_FATURAMENTO).default('dre'),
  })
  .refine((q) => !q.de || !q.ate || q.de <= q.ate, { error: 'Período inválido', path: ['ate'] })
  .refine((q) => (q.anoA === undefined) === (q.anoB === undefined), {
    error: 'Informe os dois anos do comparativo',
    path: ['anoB'],
  })
  .refine((q) => q.anoA === undefined || q.anoA !== q.anoB, {
    error: 'Escolha dois anos diferentes',
    path: ['anoB'],
  });
export type FaturamentoPdfQuery = z.output<typeof faturamentoPdfQuerySchema>;

/** Valores dos dois anos num recorte (mês, ano todo ou meses em comum): diferença = B − A; pct = (B − A) / A. */
export interface ComparacaoFaturamento {
  a: TotaisFaturamento;
  b: TotaisFaturamento;
  diferenca: TotaisFaturamento;
  pct: Record<CampoTotalFaturamento, number | null>;
}

/** Comparativo entre dois anos (A = base, B = comparado), mês a mês. */
export interface FaturamentoComparativo {
  anoA: number;
  anoB: number;
  /** Todos os meses com faturamento em pelo menos um dos anos (opções do seletor de meses). */
  mesesDisponiveis: number[];
  /** Meses com faturamento em cada ano (para atalhos como "meses em comum"). */
  mesesA: number[];
  mesesB: number[];
  /** Meses comparados (os escolhidos, ou todos os disponíveis); `temA`/`temB` dizem em qual há dado. */
  meses: (ComparacaoFaturamento & { mes: number; temA: boolean; temB: boolean })[];
  /** Soma dos meses comparados. */
  total: ComparacaoFaturamento;
  /** Só os meses comparados com dado nos dois anos (comparação justa de acumulado, como o YTD). */
  emComum: ComparacaoFaturamento & { meses: number[] };
}
