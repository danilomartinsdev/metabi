import { describe, expect, it } from 'vitest';
import { corDaDivisao, divisoesOptions, fatiasDivisoes, legendaDivisoes } from './notas-fiscais';
import { coresFatias, PALETA_CATEGORICA, PALETAS, TEMA_CLARO } from './palette';

const div = (divisao: string, total: string, participacao: number) => ({
  divisao,
  total,
  notas: 1,
  participacao,
});

describe('fatiasDivisoes', () => {
  it('até 6 divisões: uma fatia por divisão, sem "Outros"', () => {
    const f = fatiasDivisoes([div('PRIVADO', '750.00', 0.75), div('LICITACAO', '250.00', 0.25)]);
    expect(f).toEqual([
      { name: 'PRIVADO', value: 750, participacao: 0.75 },
      { name: 'LICITACAO', value: 250, participacao: 0.25 },
    ]);
  });

  it('mais de 6: as 6 maiores e o restante somado em "Outros"', () => {
    const ds = [70, 10, 6, 5, 4, 2, 2, 1].map((v, i) => div(`D${i}`, `${v}.00`, v / 100));
    const f = fatiasDivisoes(ds);
    expect(f).toHaveLength(7);
    expect(f.at(-1)).toEqual({ name: 'Outros (2)', value: 3, participacao: 0.03 });
  });

  it('sem divisões: nenhuma fatia', () => {
    expect(fatiasDivisoes([])).toEqual([]);
  });
});

describe('divisoesOptions', () => {
  it('donut com as cores da paleta, sem rótulos nem legenda do ECharts (a legenda é HTML)', () => {
    const o = divisoesOptions([div('PRIVADO', '960.00', 0.96), div('SUCATA', '40.00', 0.04)], TEMA_CLARO);
    expect(o.color).toEqual(TEMA_CLARO.categorica);
    expect(o.legend).toBeUndefined();
    const s = (o.series as { type: string; data: unknown[]; label: { show: boolean } }[])[0]!;
    expect(s.type).toBe('pie');
    expect(s.label.show).toBe(false);
    expect(s.data).toEqual([
      { name: 'PRIVADO', value: 960 },
      { name: 'SUCATA', value: 40 },
    ]);
  });

  it('com divisão selecionada, as outras fatias ficam esmaecidas', () => {
    const o = divisoesOptions(
      [div('PRIVADO', '960.00', 0.96), div('SUCATA', '40.00', 0.04)],
      TEMA_CLARO,
      'PRIVADO',
    );
    const s = (o.series as { data: unknown[] }[])[0]!;
    expect(s.data).toEqual([
      { name: 'PRIVADO', value: 960 },
      { name: 'SUCATA', value: 40, itemStyle: { opacity: 0.35 } },
    ]);
  });
});

describe('legendaDivisoes', () => {
  const cores = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777'];

  it('uma linha por fatia, na ordem e com a cor de cada fatia', () => {
    const l = legendaDivisoes([div('PRIVADO', '750.00', 0.75), div('LICITACAO', '250.00', 0.25)], cores);
    expect(l).toEqual([
      { nome: 'PRIVADO', valor: 750, participacao: 0.75, cor: '#111111', divisao: 'PRIVADO' },
      { nome: 'LICITACAO', valor: 250, participacao: 0.25, cor: '#222222', divisao: 'LICITACAO' },
    ]);
  });

  it('"Outros" recebe a 7ª cor e não filtra o ranking (divisao null)', () => {
    const ds = [70, 10, 6, 5, 4, 2, 2, 1].map((v, i) => div(`D${i}`, `${v}.00`, v / 100));
    const l = legendaDivisoes(ds, cores);
    expect(l).toHaveLength(7);
    expect(l.at(-1)).toMatchObject({ nome: 'Outros (2)', cor: '#777777', divisao: null });
  });

  it('sem divisões: legenda vazia', () => {
    expect(legendaDivisoes([], cores)).toEqual([]);
  });
});

describe('corDaDivisao', () => {
  const cores = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777'];

  it('as 6 maiores têm a cor da própria fatia; as demais, a cor de "Outros"', () => {
    expect(corDaDivisao(0, cores)).toBe('#111111');
    expect(corDaDivisao(5, cores)).toBe('#666666');
    expect(corDaDivisao(6, cores)).toBe('#777777');
    expect(corDaDivisao(12, cores)).toBe('#777777');
  });
});

describe('coresFatias', () => {
  it('padrão (ou sem paleta) usa a paleta categórica; as demais, as fatias da paleta escolhida', () => {
    expect(coresFatias(null)).toEqual(PALETA_CATEGORICA);
    expect(coresFatias('padrao')).toEqual(PALETA_CATEGORICA);
    expect(coresFatias('oceano')).toEqual(PALETAS.oceano.fatias);
  });
});
