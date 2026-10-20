// Mapa do Brasil por região ou por UF (malhas do IBGE em public/geo, registradas pelo MapaBrasilChart).
// Sem filtro: intensidade proporcional à participação. Com filtro: selecionados em destaque.
import { type LinhaRanking, REGIAO_ENUM_ROTULO, type RegiaoEnum, UFS } from '@metabi/shared';
import type { EChartsOption } from 'echarts';
import { formatBRL, formatInt, formatPct } from '../format';
import type { TemaGrafico } from './palette';

export type NivelMapa = 'regiao' | 'uf';

export const MAPAS: Record<NivelMapa, { nome: string; arquivo: string; chaves: readonly string[] }> = {
  regiao: {
    nome: 'br-regioes',
    arquivo: '/geo/br-regioes.json',
    // Exterior não tem área no mapa.
    chaves: ['NORTE', 'NORDESTE', 'CENTRO_OESTE', 'SUDESTE', 'SUL'],
  },
  uf: { nome: 'br-ufs', arquivo: '/geo/br-ufs.json', chaves: (UFS as string[]).filter((u) => u !== 'EX') },
};

const rotulo = (nivel: NivelMapa, chave: string) =>
  nivel === 'regiao' ? REGIAO_ENUM_ROTULO[chave as RegiaoEnum] : chave;

export function buildMapaBrasilOptions(
  nivel: NivelMapa,
  linhas: LinhaRanking[],
  selecionados: string[],
  t: TemaGrafico,
): EChartsOption {
  const { nome, chaves } = MAPAS[nivel];
  const porChave = new Map(linhas.map((l) => [l.chave, l]));
  const maior = Math.max(0, ...chaves.map((c) => porChave.get(c)?.participacao ?? 0));
  const filtrando = selecionados.length > 0;

  const dados = chaves.map((c) => {
    const l = porChave.get(c);
    const part = l?.participacao ?? 0;
    const destaque = filtrando ? selecionados.includes(c) : part > 0;
    // Sem filtro: 25% a 100% de opacidade conforme a participação relativa à maior.
    const opacidade = filtrando ? 1 : maior > 0 ? 0.25 + 0.75 * (part / maior) : 0.25;
    return {
      name: c,
      value: l ? Number(l.total) : 0,
      linha: l,
      itemStyle: {
        areaColor: destaque ? t.primaria : t.borda,
        opacity: destaque ? opacidade : 1,
        borderColor: t.fundo,
        borderWidth: nivel === 'uf' ? 0.8 : 1.5,
      },
      label: { color: destaque && opacidade > 0.55 ? t.fundo : t.texto },
    };
  });

  /** O ECharts tipa os params de forma genérica; o item é sempre um dos `dados` acima. */
  const dadoDe = (p: unknown) => (p as { data: (typeof dados)[number] }).data;

  return {
    textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: t.texto },
    animationDuration: 300,
    tooltip: {
      trigger: 'item',
      backgroundColor: t.fundo,
      borderColor: t.borda,
      textStyle: { color: t.texto, fontSize: 12 },
      formatter: (p) => {
        const d = dadoDe(p);
        const n = rotulo(nivel, d.name);
        if (!d.linha) return `${n}<br/>Sem vendas no período`;
        return `${n}<br/><b>${formatBRL(d.linha.total)}</b> · ${formatPct(d.linha.participacao)}<br/>${formatInt(d.linha.qtd)} pedidos`;
      },
    },
    series: [
      {
        type: 'map',
        map: nome,
        roam: false,
        selectedMode: false,
        layoutCenter: ['50%', '50%'],
        layoutSize: '100%',
        label: {
          show: true,
          fontSize: nivel === 'uf' ? 9 : 11,
          fontWeight: 600,
          // Por UF só a sigla (os estados pequenos não comportam mais); o % fica no tooltip.
          formatter: (p) => {
            const d = dadoDe(p);
            const n = rotulo(nivel, d.name);
            return nivel === 'regiao' && d.linha ? `${n}\n${formatPct(d.linha.participacao)}` : n;
          },
        },
        emphasis: {
          label: { show: true, color: t.texto },
          itemStyle: { areaColor: t.destaque, opacity: 1 },
        },
        data: dados,
      },
    ],
  };
}
