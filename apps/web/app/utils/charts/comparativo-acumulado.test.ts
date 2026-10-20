import type { VisaoGeral } from '@metabi/shared';
import { describe, expect, it } from 'vitest';
import { buildComparativoAcumuladoOptions, temComparativo } from './comparativo-acumulado';
import { TEMA_CLARO } from './palette';

const acumulado: VisaoGeral['acumuladoSegmento'] = {
  meses: 9,
  periodo: { atual: { de: '2026-01', ate: '2026-09' }, anterior: { de: '2025-01', ate: '2025-09' } },
  total: { atual: '56997286.02', anterior: '61336427.14', pct: -0.0707 },
  linhas: [
    { segmento: 'PUBLICO', atual: '26678877.39', anterior: '0.00', pct: null },
    { segmento: 'PRIVADO', atual: '30318408.63', anterior: '0.00', pct: null },
  ],
};

type Serie = { name: string; data: number[]; label?: { formatter: () => string } };

describe('buildComparativoAcumuladoOptions', () => {
  it('compara só os totais dos dois períodos (sem Público/Privado)', () => {
    const o = buildComparativoAcumuladoOptions(acumulado, TEMA_CLARO);
    expect((o.xAxis as { data: string[] }).data).toEqual(['Total vendido']);
    const [ant, atual] = o.series as Serie[];
    expect(ant).toMatchObject({ name: 'jan–set/2025', data: [61336427.14] });
    expect(atual).toMatchObject({ name: 'jan–set/2026', data: [56997286.02] });
  });

  it('legenda mostra o total de cada período', () => {
    const o = buildComparativoAcumuladoOptions(acumulado, TEMA_CLARO);
    const fmt = (o.legend as { formatter: (n: string) => string }).formatter;
    expect(fmt('jan–set/2025')).toMatch(/^jan–set\/2025: R\$\s?61\.336\.427,14$/);
    expect(fmt('jan–set/2026')).toMatch(/^jan–set\/2026: R\$\s?56\.997\.286,02$/);
  });

  it('rótulo da barra atual mostra a variação com seta', () => {
    const o = buildComparativoAcumuladoOptions(acumulado, TEMA_CLARO);
    expect((o.series as Serie[])[1]!.label!.formatter()).toMatch(/^▼ 7,1\s?%$/);
  });

  it('sem vendas nos dois períodos: nada a comparar', () => {
    const vazio = { ...acumulado, total: { atual: '0.00', anterior: '0.00', pct: null }, linhas: [] };
    expect(temComparativo(vazio)).toBe(false);
    const o = buildComparativoAcumuladoOptions(vazio, TEMA_CLARO);
    expect((o.series as Serie[]).every((s) => s.data.length === 0)).toBe(true);
  });
});
