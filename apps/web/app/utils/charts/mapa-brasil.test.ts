import type { LinhaRanking } from '@metabi/shared';
import { describe, expect, it } from 'vitest';
import { buildMapaBrasilOptions } from './mapa-brasil';
import { TEMA_CLARO } from './palette';

const linha = (chave: string, total: string, participacao: number): LinhaRanking => ({
  chave,
  rotulo: chave,
  total,
  qtd: 1,
  ticket: total,
  participacao,
});
const LINHAS = [
  linha('SUDESTE', '600.00', 0.6),
  linha('SUL', '300.00', 0.3),
  linha('EXTERIOR', '100.00', 0.1),
];
type Dado = { name: string; value: number; itemStyle: { areaColor: string; opacity: number } };
const dados = (sel: string[]) =>
  (buildMapaBrasilOptions('regiao', LINHAS, sel, TEMA_CLARO).series as { data: Dado[] }[])[0]!.data;

describe('buildMapaBrasilOptions', () => {
  it('desenha as 5 regiões (sem Exterior), com zero onde não há venda', () => {
    const d = dados([]);
    expect(d.map((x) => x.name)).toEqual(['NORTE', 'NORDESTE', 'CENTRO_OESTE', 'SUDESTE', 'SUL']);
    expect(d.find((x) => x.name === 'NORTE')!.value).toBe(0);
    expect(d.find((x) => x.name === 'SUDESTE')!.value).toBe(600);
  });

  it('sem filtro: intensidade proporcional à maior participação; sem venda fica neutro', () => {
    const d = dados([]);
    expect(d.find((x) => x.name === 'SUDESTE')!.itemStyle).toMatchObject({
      areaColor: TEMA_CLARO.primaria,
      opacity: 1,
    });
    expect(d.find((x) => x.name === 'SUL')!.itemStyle.opacity).toBeCloseTo(0.625, 5);
    expect(d.find((x) => x.name === 'NORTE')!.itemStyle.areaColor).toBe(TEMA_CLARO.borda);
  });

  it('com filtro: só as regiões selecionadas ficam em destaque', () => {
    const d = dados(['SUL']);
    expect(d.find((x) => x.name === 'SUL')!.itemStyle).toMatchObject({
      areaColor: TEMA_CLARO.primaria,
      opacity: 1,
    });
    expect(d.find((x) => x.name === 'SUDESTE')!.itemStyle.areaColor).toBe(TEMA_CLARO.borda);
  });
});

describe('buildMapaBrasilOptions por UF', () => {
  it('desenha as 27 UFs (sem EX) e destaca as filtradas', () => {
    const linhas = [linha('SP', '700.00', 0.7), linha('GO', '200.00', 0.2), linha('EX', '100.00', 0.1)];
    const o = buildMapaBrasilOptions('uf', linhas, ['GO'], TEMA_CLARO);
    const d = (o.series as { map: string; data: Dado[] }[])[0]!;
    expect(d.map).toBe('br-ufs');
    expect(d.data).toHaveLength(27);
    expect(d.data.some((x) => x.name === 'EX')).toBe(false);
    expect(d.data.find((x) => x.name === 'GO')!.itemStyle.areaColor).toBe(TEMA_CLARO.primaria);
    expect(d.data.find((x) => x.name === 'SP')!.itemStyle.areaColor).toBe(TEMA_CLARO.borda);
  });
});
