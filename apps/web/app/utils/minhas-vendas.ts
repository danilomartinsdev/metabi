import type { VisaoGeral } from '@metabi/shared';

export interface AtingimentoMes {
  mes: number;
  meta: string;
  real: string;
  /** realizado ÷ meta (só exibição; os valores em R$ seguem como string decimal). */
  pct: number | null;
}

/**
 * Atingimento da meta no mês final do período (ex.: ate = 2026-09 → setembro).
 * null quando o mês final não é do ano da evolução ou não tem meta cadastrada.
 */
export function atingimentoDoMes(
  evolucao: VisaoGeral['evolucao'],
  periodo: { de: string; ate: string },
): AtingimentoMes | null {
  if (Number(periodo.ate.slice(0, 4)) !== evolucao.ano) return null;
  const mes = Number(periodo.ate.slice(5, 7));
  const linha = evolucao.meses.find((m) => m.mes === mes);
  if (!linha?.meta) return null;
  const meta = Number(linha.meta);
  return { mes, meta: linha.meta, real: linha.real, pct: meta > 0 ? Number(linha.real) / meta : null };
}
