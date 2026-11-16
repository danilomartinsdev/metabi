import type { VisaoGeral } from '@metabi/shared';

export interface AtingimentoMes {
  /** Mês "AAAA-MM". */
  mes: string;
  meta: string;
  real: string;
  /** realizado ÷ meta (só exibição; os valores em R$ seguem como string decimal). */
  pct: number | null;
}

/**
 * Atingimento da meta no mês final do período (ex.: ate = 2026-09 → setembro de 2026).
 * null quando o mês final não está na evolução ou não tem meta cadastrada.
 */
export function atingimentoDoMes(
  evolucao: VisaoGeral['evolucao'],
  periodo: { de: string; ate: string },
): AtingimentoMes | null {
  const linha = evolucao.meses.find((m) => m.mes === periodo.ate);
  if (!linha?.meta) return null;
  const meta = Number(linha.meta);
  return {
    mes: linha.mes,
    meta: linha.meta,
    real: linha.real,
    pct: meta > 0 ? Number(linha.real) / meta : null,
  };
}
