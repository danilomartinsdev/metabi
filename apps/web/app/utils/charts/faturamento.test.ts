import type { FaturamentoResumo } from '@metabi/shared';
import { describe, expect, it } from 'vitest';
import { barrasFaturamentoOptions, evolucaoFaturamentoOptions } from './faturamento';
import { TEMA_CLARO } from './palette';

const mes = (m: number, dre: string, dreAnoAnterior = '0.00') => ({
  mes: m,
  bruto: dre,
  antecipado: '0.00',
  remessa: '0.00',
  devolucao: '0.00',
  dre,
  dreAnoAnterior,
});
const totais = { bruto: '0', antecipado: '0', remessa: '0', devolucao: '0', dre: '0' };

describe('evolucaoFaturamentoOptions', () => {
  it('barras do ano atual e, sem dados do ano anterior, sem a linha de comparação', () => {
    const m: FaturamentoResumo['mensal'] = {
      ano: 2026,
      meses: [mes(1, '4400.25'), mes(2, '3400.00')],
      total: totais,
    };
    const o = evolucaoFaturamentoOptions(m, TEMA_CLARO);
    expect((o.xAxis as { data: string[] }).data).toEqual(['Jan', 'Fev']);
    const series = o.series as { name: string; data: number[] }[];
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ name: '2026', data: [4400.25, 3400] });
  });

  it('com o ano anterior importado, mostra a linha tracejada', () => {
    const m = { ano: 2026, meses: [mes(1, '10.00', '8.00')], total: totais };
    const series = evolucaoFaturamentoOptions(m, TEMA_CLARO).series as { name: string; data: number[] }[];
    expect(series[1]).toMatchObject({ name: '2025', data: [8] });
  });
});

describe('barrasFaturamentoOptions', () => {
  it('rótulos no eixo e tooltip com a data completa e o valor em R$', () => {
    const o = barrasFaturamentoOptions(
      [
        { rotulo: '08/01', dica: 'quinta, 08/01/2026', valor: 590174.5 },
        { rotulo: '09/01', dica: 'sexta, 09/01/2026', valor: -425 },
      ],
      TEMA_CLARO,
    );
    expect((o.yAxis as { data: string[] }).data).toEqual(['08/01', '09/01']);
    const fmt = (o.tooltip as { formatter: (p: unknown) => string }).formatter;
    expect(fmt([{ dataIndex: 0 }])).toMatch(/^quinta, 08\/01\/2026<br\/><b>R\$\s?590\.174,50<\/b>$/);
  });

  it('dia negativo (só devolução) usa a cor de alerta', () => {
    const o = barrasFaturamentoOptions([{ rotulo: 'x', dica: 'x', valor: -1 }], TEMA_CLARO);
    const cor = (o.series as { itemStyle: { color: (p: { value: number }) => string } }[])[0]!.itemStyle
      .color;
    expect(cor({ value: -1 })).toBe(TEMA_CLARO.categorica[3]);
    expect(cor({ value: 5 })).toBe(TEMA_CLARO.primaria);
  });
});
