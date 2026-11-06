import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { blocosVisaoGeral, csvDe, planilhaVisaoGeral } from '../src/modules/export/planilhas.js';

describe('CSV e Visão geral em planilha', () => {
  it('csvDe usa ; e vírgula decimal, aspas quando preciso e neutraliza fórmulas', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nome', 'Valor'],
      ['A;B', 1234.5],
      ['=SOMA(A1)', -2],
    ]);
    expect(csvDe(ws)).toBe('Nome;Valor\r\n"A;B";1234,5\r\n\'=SOMA(A1);-2');
  });

  it('só gera os blocos das seções marcadas', () => {
    const v = {
      periodo: { de: '2026-01', ate: '2026-02' },
      kpis: {
        total: { valor: '10', mesAnterior: { anterior: '5', pct: 1 }, anoAnterior: { anterior: '8', pct: 0.25 }, serie: [] },
        qtd: { valor: '2', mesAnterior: { anterior: '1', pct: 1 }, anoAnterior: { anterior: '1', pct: 1 }, serie: [] },
        ticket: { valor: '5', mesAnterior: { anterior: '5', pct: 0 }, anoAnterior: { anterior: '8', pct: -0.4 }, serie: [] },
        pctPublico: { valor: 0.5, anoAnterior: 0.4, serie: [] },
      },
      evolucao: { ano: 2026, meses: [{ mes: 1, real: '1', anoAnterior: '2', meta: null }], atingimento: null },
      porRegiao: [],
      porSegmento: [],
      topGestores: [],
      detalhamentoMensal: { linhas: [], total: { atual: '0', anterior: '0', pct: null } },
      acumuladoSegmento: {
        meses: 2,
        periodo: { atual: { de: '2026-01', ate: '2026-02' }, anterior: { de: '2025-01', ate: '2025-02' } },
        total: { atual: '0', anterior: '0', pct: null },
        linhas: [],
      },
    } as never;
    const blocos = blocosVisaoGeral(v, {}, (id) => id === 'kpis' || id === 'evolucao');
    expect(blocos.map((b) => b.nome)).toEqual(['Indicadores', 'Evolução mensal']);

    const info = {
      titulo: 'Visão geral',
      periodo: { de: '2026-01', ate: '2026-02' },
      filtros: { regiao: [], uf: [], gestor: [], segmento: [], status: [] },
      geradoPor: 'T',
      geradoEm: new Date(),
      linhas: 5,
    };
    const csv = planilhaVisaoGeral(blocos, info, new Map(), 'csv').toString('utf8');
    expect(csv).toContain('Indicadores');
    expect(csv).toContain('Evolução mensal');
    expect(csv).not.toContain('Ranking');
    const wb = XLSX.read(planilhaVisaoGeral(blocos, info, new Map(), 'xlsx'));
    expect(wb.SheetNames).toEqual(['Indicadores', 'Evolução mensal', 'Filtros']);
  });
});
