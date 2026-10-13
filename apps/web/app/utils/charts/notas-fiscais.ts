// Gráficos da Análise de faturamento (notas fiscais). Funções puras; os componentes só renderizam.
import type { AnaliseNotas } from '@meta-bi/shared';
import type { EChartsOption } from 'echarts';
import { formatBRL, formatPct } from '../format';
import type { TemaGrafico } from './palette';

/** Donut: no máximo 6 fatias + "Outros" (design system). */
const MAX_FATIAS = 6;
const curto = (s: string, n = 26) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Fatias do donut de divisões: as 6 maiores e o restante somado em "Outros". */
export function fatiasDivisoes(divisoes: AnaliseNotas['divisoes']) {
  const fatias = divisoes
    .slice(0, MAX_FATIAS)
    .map((d) => ({ name: d.divisao, value: Number(d.total), participacao: d.participacao }));
  const resto = divisoes.slice(MAX_FATIAS);
  if (resto.length) {
    fatias.push({
      name: `Outros (${resto.length})`,
      value: resto.reduce((s, d) => s + Number(d.total), 0),
      participacao: resto.reduce((s, d) => s + d.participacao, 0),
    });
  }
  return fatias;
}

/**
 * Faturamento por divisão de venda (donut) com o valor nas fatias de 5% ou mais. Com uma divisão
 * selecionada (clique na fatia), ela fica destacada e as demais esmaecidas.
 */
export function divisoesOptions(
  divisoes: AnaliseNotas['divisoes'],
  t: TemaGrafico,
  selecionada: string | null = null,
): EChartsOption {
  const fatias = fatiasDivisoes(divisoes);
  const pct = new Map(fatias.map((f) => [f.name, f.participacao]));
  return {
    textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: t.texto },
    animationDuration: 300,
    color: t.categorica,
    tooltip: {
      trigger: 'item',
      backgroundColor: t.fundo,
      borderColor: t.borda,
      textStyle: { color: t.texto, fontSize: 12 },
      formatter: (p) => {
        const x = p as { name: string; value: number; percent: number };
        return `${x.name}<br/><b>${formatBRL(x.value)}</b> · ${formatPct(x.percent / 100)}`;
      },
    },
    legend: {
      bottom: 0,
      type: 'scroll',
      textStyle: { color: t.textoSuave },
      itemWidth: 10,
      itemHeight: 10,
      formatter: (nome: string) => `${curto(nome)} ${formatPct(pct.get(nome) ?? null)}`,
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        itemStyle: { borderColor: t.fundo, borderWidth: 2 },
        label: {
          color: t.texto,
          fontSize: 11,
          formatter: (p) => {
            const x = p as { value: number; percent: number };
            return x.percent >= 5 ? formatBRL(x.value) : '';
          },
        },
        labelLine: { lineStyle: { color: t.borda } },
        cursor: 'pointer',
        data: fatias.map(({ name, value }) =>
          selecionada && name !== selecionada
            ? { name, value, itemStyle: { opacity: 0.35 } }
            : { name, value },
        ),
      },
    ],
  };
}
