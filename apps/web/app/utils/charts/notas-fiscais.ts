// Gráficos da Análise de faturamento (notas fiscais). Funções puras; os componentes só renderizam.
import type { AnaliseNotas } from '@meta-bi/shared';
import type { EChartsOption } from 'echarts';
import { formatBRL, formatPct } from '../format';
import type { TemaGrafico } from './palette';

/** Donut: no máximo 6 fatias + "Outros" (design system). */
const MAX_FATIAS = 6;

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
 * Legenda do donut (HTML, ao lado do gráfico): uma linha por fatia com a mesma cor dela.
 * `divisao` é null em "Outros", que não filtra o ranking.
 */
export function legendaDivisoes(divisoes: AnaliseNotas['divisoes'], cores: string[]) {
  return fatiasDivisoes(divisoes).map((f, i) => ({
    nome: f.name,
    valor: f.value,
    participacao: f.participacao,
    cor: cores[i % cores.length]!,
    divisao: i < MAX_FATIAS ? f.name : null,
  }));
}

/** Cor da divisão na lista completa: a da sua fatia, ou a de "Outros" fora das 6 maiores. */
export function corDaDivisao(indice: number, cores: string[]) {
  return cores[Math.min(indice, MAX_FATIAS) % cores.length]!;
}

/**
 * Faturamento por divisão de venda (donut). Valores e nomes ficam na legenda HTML ao lado
 * (legendaDivisoes), que não trunca os nomes longos. Com uma divisão selecionada (clique na fatia),
 * ela fica destacada e as demais esmaecidas.
 */
export function divisoesOptions(
  divisoes: AnaliseNotas['divisoes'],
  t: TemaGrafico,
  selecionada: string | null = null,
): EChartsOption {
  const fatias = fatiasDivisoes(divisoes);
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
    series: [
      {
        type: 'pie',
        radius: ['50%', '80%'],
        center: ['50%', '50%'],
        itemStyle: { borderColor: t.fundo, borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
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
