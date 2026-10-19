// Funções puras que geram as options do ECharts (testáveis; componentes só renderizam).
import type { LinhaRanking, VisaoGeral } from '@meta-bi/shared';
import type { EChartsOption } from 'echarts';
import { formatBRL, formatCompact, formatPct } from '../format';
import type { TemaGrafico } from './palette';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const base = (t: TemaGrafico): EChartsOption => ({
  textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: t.texto },
  tooltip: {
    backgroundColor: t.fundo,
    borderColor: t.borda,
    textStyle: { color: t.texto, fontSize: 12 },
  },
  animationDuration: 300,
});

const eixoValor = (t: TemaGrafico) => ({
  type: 'value' as const,
  axisLabel: { color: t.textoSuave, formatter: (v: number) => formatCompact(v) },
  splitLine: { lineStyle: { color: t.borda } },
});

/** Evolução mensal: Real (barras) × Ano anterior (linha tracejada) × Meta (linha). */
export function evolucaoOptions(ev: VisaoGeral['evolucao'], t: TemaGrafico): EChartsOption {
  const temMeta = ev.meses.some((m) => m.meta !== null);
  return {
    ...base(t),
    grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, right: 0, textStyle: { color: t.textoSuave }, itemWidth: 14, itemHeight: 8 },
    tooltip: {
      ...(base(t).tooltip as object),
      trigger: 'axis',
      valueFormatter: (v) => formatBRL(v as number),
    },
    xAxis: {
      type: 'category',
      data: MESES,
      axisLine: { lineStyle: { color: t.borda } },
      axisLabel: { color: t.textoSuave },
      axisTick: { show: false },
    },
    yAxis: eixoValor(t),
    series: [
      {
        name: String(ev.ano),
        type: 'bar',
        data: ev.meses.map((m) => Number(m.real)),
        itemStyle: { color: t.primaria, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 28,
      },
      {
        name: String(ev.ano - 1),
        type: 'line',
        data: ev.meses.map((m) => Number(m.anoAnterior)),
        lineStyle: { type: 'dashed', color: t.comparacao, width: 2 },
        itemStyle: { color: t.comparacao },
        symbol: 'circle',
        symbolSize: 5,
      },
      ...(temMeta
        ? [
            {
              name: 'Meta',
              type: 'line' as const,
              data: ev.meses.map((m) => (m.meta === null ? null : Number(m.meta))),
              lineStyle: { color: t.destaque, width: 2 },
              itemStyle: { color: t.destaque },
              symbol: 'none',
              step: 'middle' as const,
            },
          ]
        : []),
    ],
  };
}

/** Fatias do donut de participação: as 6 maiores e o restante somado em "Outros". */
export function fatiasDonut(linhas: LinhaRanking[]) {
  const fatias = linhas
    .slice(0, 6)
    .map((l) => ({ name: l.rotulo, value: Number(l.total), participacao: l.participacao ?? null }));
  const resto = linhas.slice(6);
  // % vem da participação calculada na API (Decimal); "Outros" soma as participações.
  if (resto.length)
    fatias.push({
      name: 'Outros',
      value: resto.reduce((s, l) => s + Number(l.total), 0),
      participacao: resto.reduce((s, l) => s + (l.participacao ?? 0), 0),
    });
  return fatias;
}

/**
 * Donut de participação (máx. 6 fatias + "Outros").
 * `impressao`: legenda inteira quebrando em linhas (no PDF não há como clicar nas setas da legenda
 * paginada) e rosca menor para caber.
 * `semLegenda`: a tela mostra a legenda como lista HTML abaixo do gráfico (não trunca nem pagina).
 */
export function donutOptions(
  linhas: LinhaRanking[],
  t: TemaGrafico,
  { impressao = false, semLegenda = false }: { impressao?: boolean; semLegenda?: boolean } = {},
): EChartsOption {
  const fatias = fatiasDonut(linhas);
  const dados = fatias.map(({ name, value }) => ({ name, value }));
  const pct = new Map(fatias.map((f) => [f.name, f.participacao]));
  return {
    ...base(t),
    color: t.categorica,
    tooltip: {
      ...(base(t).tooltip as object),
      trigger: 'item',
      formatter: (p) => {
        const x = p as { name: string; value: number; percent: number };
        return `${x.name}<br/><b>${formatBRL(x.value)}</b> · ${formatPct(x.percent / 100)}`;
      },
    },
    legend: {
      show: !semLegenda,
      bottom: 0,
      textStyle: { color: t.textoSuave },
      itemWidth: 10,
      itemHeight: 10,
      type: impressao ? 'plain' : 'scroll',
      formatter: (nome: string) => `${nome} ${formatPct(pct.get(nome) ?? null)}`,
    },
    series: [
      {
        type: 'pie',
        radius: impressao ? ['45%', '66%'] : semLegenda ? ['62%', '90%'] : ['55%', '80%'],
        center: ['50%', impressao ? '36%' : semLegenda ? '50%' : '44%'],
        itemStyle: { borderColor: t.fundo, borderWidth: 2 },
        label: { show: false },
        data: dados,
      },
    ],
  };
}

/** Barras horizontais de ranking (maior em cima). */
export function barrasRankingOptions(linhas: LinhaRanking[], t: TemaGrafico, limite = 10): EChartsOption {
  const top = linhas.slice(0, limite).reverse();
  return {
    ...base(t),
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      ...(base(t).tooltip as object),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => formatBRL(v as number),
    },
    xAxis: { ...eixoValor(t), splitLine: { show: false }, axisLabel: { show: false } },
    yAxis: {
      type: 'category',
      data: top.map((l) => (l.rotulo.length > 22 ? `${l.rotulo.slice(0, 21)}…` : l.rotulo)),
      axisLabel: { color: t.texto },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: top.map((l) => Number(l.total)),
        itemStyle: { color: t.primaria, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'right',
          color: t.textoSuave,
          formatter: (p) => formatCompact(p.value as number),
        },
      },
    ],
  };
}

/** Sparkline (sem eixos) para os cards de KPI; `null` vira lacuna (mês sem base). */
export function sparklineOptions(valores: (number | null)[], t: TemaGrafico): EChartsOption {
  return {
    grid: { left: 0, right: 0, top: 2, bottom: 2 },
    xAxis: { type: 'category', show: false, data: valores.map((_, i) => i) },
    yAxis: { type: 'value', show: false, min: 'dataMin' },
    series: [
      {
        type: 'line',
        data: valores,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: t.primaria, width: 2 },
        areaStyle: { color: t.primaria, opacity: 0.08 },
      },
    ],
    animation: false,
  };
}
