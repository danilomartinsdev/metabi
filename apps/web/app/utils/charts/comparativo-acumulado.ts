// Comparativo com o ano anterior: total do período selecionado × total do mesmo período do ano anterior.
// (Público/Privado ficam de fora por enquanto — decisão do usuário em 2026-10-05.)
import type { VisaoGeral } from '@metabi/shared';
import type { EChartsOption } from 'echarts';
import { formatBRL, formatCompact, formatPct } from '../format';
import { periodoCurto } from '../periodo';
import type { TemaGrafico } from './palette';

type Acumulado = VisaoGeral['acumuladoSegmento'];

/** Nomes das séries: os dois períodos comparados (ex.: "jan–set/2025" e "jan–set/2026"). */
export const nomesPeriodos = (a: Acumulado) => ({
  atual: periodoCurto(a.periodo.atual.de, a.periodo.atual.ate),
  anterior: periodoCurto(a.periodo.anterior.de, a.periodo.anterior.ate),
});

/** Há algo para comparar (venda em pelo menos um dos dois períodos)? */
export const temComparativo = (a: Acumulado) => Number(a.total.atual) > 0 || Number(a.total.anterior) > 0;

export function buildComparativoAcumuladoOptions(a: Acumulado, t: TemaGrafico): EChartsOption {
  const nomes = nomesPeriodos(a);
  const tem = temComparativo(a);
  // Legenda com o total de cada período: "jan–set/2025: R$ 61.336.427,14".
  const totais = new Map([
    [nomes.anterior, a.total.anterior],
    [nomes.atual, a.total.atual],
  ]);
  const seta = (p: number | null) => (p === null ? '' : `${p >= 0 ? '▲' : '▼'} ${formatPct(Math.abs(p))}`);
  return {
    textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: t.texto },
    animationDuration: 300,
    grid: { left: 8, right: 8, top: 16, bottom: 56, containLabel: true },
    legend: {
      bottom: 0,
      left: 'center',
      orient: 'vertical',
      itemGap: 6,
      textStyle: { color: t.texto, fontSize: 12 },
      itemWidth: 14,
      itemHeight: 8,
      formatter: (nome: string) => `${nome}: ${formatBRL(totais.get(nome))}`,
    },
    tooltip: {
      backgroundColor: t.fundo,
      borderColor: t.borda,
      textStyle: { color: t.texto, fontSize: 12 },
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => formatBRL(v as number),
    },
    xAxis: {
      type: 'category',
      data: tem ? ['Total vendido'] : [],
      axisLine: { lineStyle: { color: t.borda } },
      axisLabel: { color: t.textoSuave },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: t.textoSuave, formatter: (v: number) => formatCompact(v) },
      splitLine: { lineStyle: { color: t.borda } },
    },
    series: [
      {
        name: nomes.anterior,
        type: 'bar',
        data: tem ? [Number(a.total.anterior)] : [],
        itemStyle: { color: t.comparacao, opacity: 0.55, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 56,
      },
      {
        name: nomes.atual,
        type: 'bar',
        data: tem ? [Number(a.total.atual)] : [],
        itemStyle: { color: t.primaria, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 56,
        label: {
          show: true,
          position: 'top',
          color: t.textoSuave,
          fontSize: 12,
          formatter: () => seta(a.total.pct),
        },
      },
    ],
  };
}
