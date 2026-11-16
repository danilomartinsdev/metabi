// Valores esperados escritos à mão a partir do "Exemplo base" de docs/dados/metricas-kpis.md.
import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import {
  acumuladoPorSegmento,
  agrupar,
  atingimentoAcumulado,
  detalhamentoMensal,
  deslocarMes,
  type LinhaVenda,
  mesesEntre,
  noPeriodo,
  somar,
  ticket,
  variacao,
} from './metricas.js';

const p = (mes: string, segmento: LinhaVenda['segmento'], valor: string, gestor = 'G1'): LinhaVenda => ({
  valor: new Prisma.Decimal(valor),
  mes,
  uf: 'GO',
  regiao: 'CENTRO_OESTE',
  gestorId: gestor,
  gestorNome: gestor,
  clienteId: 'C1',
  clienteNome: 'Cliente 1',
  segmento,
});

const BASE: LinhaVenda[] = [
  p('2026-08', 'PUBLICO', '10000.00', 'G1'),
  p('2026-08', 'PRIVADO', '5000.00', 'G2'),
  p('2026-08', 'PUBLICO', '15000.00', 'G1'),
  p('2026-07', 'PRIVADO', '20000.00'),
  p('2025-08', 'PUBLICO', '12000.00'),
  p('2025-08', 'PRIVADO', '8000.00'),
];
const agosto = noPeriodo(BASE, '2026-08', '2026-08');

describe('KPIs do exemplo base (agosto/2026)', () => {
  it('total vendido = R$ 30.000,00 e qtd = 3', () => {
    const { total, qtd } = somar(agosto);
    expect(total.toFixed(2)).toBe('30000.00');
    expect(qtd).toBe(3);
  });

  it('ticket médio = R$ 10.000,00; sem pedidos → null', () => {
    const { total, qtd } = somar(agosto);
    expect(ticket(total, qtd)!.toFixed(2)).toBe('10000.00');
    expect(ticket(new Prisma.Decimal(0), 0)).toBeNull();
  });

  it('% público = 83,3%', () => {
    const publico = somar(agosto.filter((l) => l.segmento === 'PUBLICO')).total;
    expect(publico.div(somar(agosto).total).toNumber()).toBeCloseTo(0.8333, 4);
  });

  it('variação vs julho/2026 = +50%; vs agosto/2025 = +50%; anterior zero = null', () => {
    const atual = somar(agosto).total;
    expect(variacao(atual, somar(noPeriodo(BASE, '2026-07', '2026-07')).total)).toBe(0.5);
    expect(variacao(atual, somar(noPeriodo(BASE, '2025-08', '2025-08')).total)).toBe(0.5);
    expect(variacao(atual, new Prisma.Decimal(0))).toBeNull();
  });

  it('acumulado compara só meses em comum: YTD 2026 (até ago) = 50.000 vs 2025 = 20.000 → +150%', () => {
    const ytd26 = somar(noPeriodo(BASE, '2026-01', '2026-08')).total;
    const ytd25 = somar(noPeriodo(BASE, '2025-01', '2025-08')).total;
    expect(ytd26.toFixed(2)).toBe('50000.00');
    expect(ytd25.toFixed(2)).toBe('20000.00');
    expect(variacao(ytd26, ytd25)).toBe(1.5);

    const seg = acumuladoPorSegmento(BASE, '2026-01', '2026-08');
    expect(seg.periodo).toEqual({
      atual: { de: '2026-01', ate: '2026-08' },
      anterior: { de: '2025-01', ate: '2025-08' },
    });
    expect(seg.linhas).toEqual([
      { segmento: 'PUBLICO', atual: '25000.00', anterior: '12000.00', pct: expect.closeTo(1.0833, 4) },
      { segmento: 'PRIVADO', atual: '25000.00', anterior: '8000.00', pct: 2.125 },
    ]);
    expect(seg.total).toEqual({ atual: '50000.00', anterior: '20000.00', pct: 1.5 });
  });

  it('atingimento acumulado: Σ real ÷ Σ meta só nos meses do período com meta (30.000 ÷ 40.000 = 75%)', () => {
    const D = Prisma.Decimal;
    const real = new Map([
      ['2026-06', new D(10000)],
      ['2026-07', new D(20000)],
      ['2026-08', new D(30000)],
    ]);
    // Período jul–ago: junho e setembro ficam fora do período; julho sem meta (0) fica de fora.
    const metas = new Map([
      ['2026-06', new D(99999)],
      ['2026-07', new D(0)],
      ['2026-08', new D(40000)],
      ['2026-09', new D(50000)],
    ]);
    const periodo = ['2026-07', '2026-08'];
    expect(atingimentoAcumulado(real, metas, periodo)).toEqual({
      mesInicial: '2026-08',
      mesFinal: '2026-08',
      meta: '40000.00',
      real: '30000.00',
      pct: 0.75,
    });
    expect(atingimentoAcumulado(real, null, periodo)).toBeNull();
    expect(atingimentoAcumulado(real, new Map([['2026-09', new D(1)]]), periodo)).toBeNull();
  });

  it('atingimento cruzando o ano: nov/2025–jan/2026', () => {
    const D = Prisma.Decimal;
    const real = new Map([
      ['2025-12', new D(30)],
      ['2026-01', new D(50)],
    ]);
    const metas = new Map([
      ['2025-12', new D(60)],
      ['2026-01', new D(40)],
    ]);
    expect(atingimentoAcumulado(real, metas, ['2025-11', '2025-12', '2026-01'])).toMatchObject({
      mesInicial: '2025-12',
      mesFinal: '2026-01',
      meta: '100.00',
      real: '80.00',
      pct: 0.8,
    });
  });

  it('ranking ordena por total e participação soma 100%', () => {
    const r = agrupar(
      agosto,
      (l) => l.gestorId,
      (l) => l.gestorNome,
    );
    expect(r.map((x) => [x.chave, x.total, x.qtd])).toEqual([
      ['G1', '25000.00', 2],
      ['G2', '5000.00', 1],
    ]);
    expect(r[0]!.participacao! + r[1]!.participacao!).toBeCloseTo(1, 10);
    expect(r[0]!.ticket).toBe('12500.00');
  });

  it('Decimal não acumula erro de float (0,1 + 0,2 = 0,30)', () => {
    const { total } = somar([p('2026-01', null, '0.10'), p('2026-01', null, '0.20')]);
    expect(total.toFixed(2)).toBe('0.30');
    expect(total.equals('0.3')).toBe(true);
  });
});

describe('meses', () => {
  it('desloca e lista meses atravessando o ano', () => {
    expect(deslocarMes('2026-01', -1)).toBe('2025-12');
    expect(deslocarMes('2025-12', 13)).toBe('2027-01');
    expect(mesesEntre('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('detalhamentoMensal', () => {
  it('mês a mês × mesmo mês do ano anterior, com o total do período', () => {
    const tp = (a: string, b: string) => somar(noPeriodo(BASE, a, b)).total;
    const d = detalhamentoMensal(tp, '2026-07', '2026-08');
    expect(d.linhas).toEqual([
      // julho/2025 não tem venda: variação sem base
      { mes: '2026-07', atual: '20000.00', anterior: '0.00', pct: null },
      { mes: '2026-08', atual: '30000.00', anterior: '20000.00', pct: 0.5 },
    ]);
    expect(d.total).toEqual({ atual: '50000.00', anterior: '20000.00', pct: 1.5 });
  });
});
