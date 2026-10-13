import { describe, expect, it } from 'vitest';
import { formatBRL } from '../format';
import { divisoesOptions, fatiasDivisoes } from './notas-fiscais';
import { TEMA_CLARO } from './palette';

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
  it('donut com as cores da paleta e valor em R$ só nas fatias de 5% ou mais', () => {
    const o = divisoesOptions([div('PRIVADO', '960.00', 0.96), div('SUCATA', '40.00', 0.04)], TEMA_CLARO);
    expect(o.color).toEqual(TEMA_CLARO.categorica);
    const s = (
      o.series as { type: string; data: unknown[]; label: { formatter: (p: unknown) => string } }[]
    )[0]!;
    expect(s.type).toBe('pie');
    expect(s.data).toEqual([
      { name: 'PRIVADO', value: 960 },
      { name: 'SUCATA', value: 40 },
    ]);
    expect(s.label.formatter({ value: 960, percent: 96 })).toBe(formatBRL(960));
    expect(s.label.formatter({ value: 40, percent: 4 })).toBe('');
    const legenda = (o.legend as { formatter: (n: string) => string }).formatter;
    expect(legenda('PRIVADO')).toBe('PRIVADO 96,0%');
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
