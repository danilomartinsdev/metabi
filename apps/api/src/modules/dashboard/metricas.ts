// Cálculos de KPI puros (sem banco), em Decimal. Fórmulas: docs/dados/metricas-kpis.md.
import type { LinhaRanking } from '@metabi/shared';
import { Prisma } from '../../generated/prisma/client.js';

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export interface LinhaVenda {
  valor: Decimal;
  /** Mês de competência "AAAA-MM". */
  mes: string;
  uf: string;
  regiao: string;
  gestorId: string;
  gestorNome: string;
  clienteId: string;
  clienteNome: string;
  /** Segmento efetivo: override do cliente ?? padrão do representante. */
  segmento: 'PUBLICO' | 'PRIVADO' | null;
}

export const zero = () => new D(0);

export function somar(linhas: LinhaVenda[]): { total: Decimal; qtd: number } {
  return { total: linhas.reduce((s, l) => s.plus(l.valor), zero()), qtd: linhas.length };
}

export function ticket(total: Decimal, qtd: number): Decimal | null {
  return qtd === 0 ? null : total.div(qtd);
}

/** (atual − anterior) ÷ anterior; null se anterior = 0. */
export function variacao(atual: Decimal, anterior: Decimal): number | null {
  return anterior.isZero() ? null : atual.minus(anterior).div(anterior).toNumber();
}

export function fracao(parte: Decimal, total: Decimal): number | null {
  return total.isZero() ? null : parte.div(total).toNumber();
}

export function deslocarMes(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export function mesesEntre(de: string, ate: string): string[] {
  const r: string[] = [];
  for (let m = de; m <= ate; m = deslocarMes(m, 1)) r.push(m);
  return r;
}

export const noPeriodo = (linhas: LinhaVenda[], de: string, ate: string) =>
  linhas.filter((l) => l.mes >= de && l.mes <= ate);

/** Agrupa e ordena por total desc, com % de participação no conjunto. */
export function agrupar(
  linhas: LinhaVenda[],
  chave: (l: LinhaVenda) => string,
  rotulo: (l: LinhaVenda) => string,
): LinhaRanking[] {
  const grupos = new Map<string, { rotulo: string; total: Decimal; qtd: number }>();
  for (const l of linhas) {
    const k = chave(l);
    const g = grupos.get(k) ?? { rotulo: rotulo(l), total: zero(), qtd: 0 };
    g.total = g.total.plus(l.valor);
    g.qtd++;
    grupos.set(k, g);
  }
  const geral = somar(linhas).total;
  return [...grupos]
    .map(([k, g]) => ({
      chave: k,
      rotulo: g.rotulo,
      total: g.total.toFixed(2),
      qtd: g.qtd,
      ticket: ticket(g.total, g.qtd)?.toFixed(2) ?? null,
      participacao: fracao(g.total, geral),
    }))
    .sort((a, b) => new D(b.total).comparedTo(new D(a.total)) || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}

/** Série mensal (inclui meses sem venda como zero). */
export function serieMensal(linhas: LinhaVenda[], meses: string[], f: (ls: LinhaVenda[]) => Decimal) {
  const porMes = new Map<string, LinhaVenda[]>();
  for (const l of linhas) porMes.set(l.mes, [...(porMes.get(l.mes) ?? []), l]);
  return meses.map((mes) => ({ mes, valor: f(porMes.get(mes) ?? []) }));
}

/**
 * Comparativo por segmento com o MESMO período do ano anterior:
 * de..ate (ex.: jan–set/2026) vs de−12..ate−12 (jan–set/2025).
 */
export function acumuladoPorSegmento(linhas: LinhaVenda[], de: string, ate: string) {
  const periodo = {
    atual: { de, ate },
    anterior: { de: deslocarMes(de, -12), ate: deslocarMes(ate, -12) },
  };
  const atual = noPeriodo(linhas, de, ate);
  const anterior = noPeriodo(linhas, periodo.anterior.de, periodo.anterior.ate);
  const segs = ['PUBLICO', 'PRIVADO', 'SEM'] as const;
  const somaSeg = (ls: LinhaVenda[], s: (typeof segs)[number]) =>
    somar(ls.filter((l) => (l.segmento ?? 'SEM') === s)).total;
  const tAtual = somar(atual).total;
  const tAnterior = somar(anterior).total;
  return {
    meses: mesesEntre(de, ate).length,
    periodo,
    total: { atual: tAtual.toFixed(2), anterior: tAnterior.toFixed(2), pct: variacao(tAtual, tAnterior) },
    linhas: segs
      .map((s) => ({ segmento: s, atual: somaSeg(atual, s), anterior: somaSeg(anterior, s) }))
      .filter((r) => !r.atual.isZero() || !r.anterior.isZero())
      .map((r) => ({
        segmento: r.segmento,
        atual: r.atual.toFixed(2),
        anterior: r.anterior.toFixed(2),
        pct: variacao(r.atual, r.anterior),
      })),
  };
}

/**
 * Atingimento acumulado: Σ real ÷ Σ meta nos meses jan..mesFinal que têm meta (> 0).
 * Sem nenhuma meta no intervalo → null ("sem meta").
 */
export function atingimentoAcumulado(
  real: Map<number, Decimal>,
  metas: Map<number, Decimal> | null,
  mesFinal: number,
): { mesInicial: number; mesFinal: number; meta: string; real: string; pct: number | null } | null {
  if (!metas) return null;
  const meses = Array.from({ length: mesFinal }, (_, i) => i + 1).filter((m) => metas.get(m)?.gt(0));
  if (!meses.length) return null;
  const meta = meses.reduce((s, m) => s.plus(metas.get(m)!), zero());
  const realizado = meses.reduce((s, m) => s.plus(real.get(m) ?? zero()), zero());
  return {
    mesInicial: meses[0]!,
    mesFinal: meses.at(-1)!,
    meta: meta.toFixed(2),
    real: realizado.toFixed(2),
    pct: fracao(realizado, meta),
  };
}

/**
 * Detalhamento mês a mês: cada mês de de..ate × o mesmo mês do ano anterior, e o total do período.
 * `totalPeriodo(a, b)` é a soma do intervalo (o service passa a versão que inclui o faturamento manual).
 */
export function detalhamentoMensal(totalPeriodo: (a: string, b: string) => Decimal, de: string, ate: string) {
  const linhas = mesesEntre(de, ate).map((mes) => {
    const atual = totalPeriodo(mes, mes);
    const anterior = totalPeriodo(deslocarMes(mes, -12), deslocarMes(mes, -12));
    return { mes, atual: atual.toFixed(2), anterior: anterior.toFixed(2), pct: variacao(atual, anterior) };
  });
  const atual = totalPeriodo(de, ate);
  const anterior = totalPeriodo(deslocarMes(de, -12), deslocarMes(ate, -12));
  return {
    linhas,
    total: { atual: atual.toFixed(2), anterior: anterior.toFixed(2), pct: variacao(atual, anterior) },
  };
}
