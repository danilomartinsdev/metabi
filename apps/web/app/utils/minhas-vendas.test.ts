import { describe, expect, it } from 'vitest';
import { atingimentoDoMes } from './minhas-vendas';

const evolucao = {
  meses: [
    { mes: '2026-08', real: '45000.00', anoAnterior: '30000.00', meta: '50000.00' },
    { mes: '2026-09', real: '60000.00', anoAnterior: '40000.00', meta: null },
    { mes: '2026-10', real: '0.00', anoAnterior: '0.00', meta: '0.00' },
  ],
  atingimento: null,
};

describe('atingimentoDoMes', () => {
  it('calcula o % do mês final do período', () => {
    expect(atingimentoDoMes(evolucao, { de: '2026-08', ate: '2026-08' })).toEqual({
      mes: '2026-08',
      meta: '50000.00',
      real: '45000.00',
      pct: 0.9,
    });
  });

  it('mês sem meta cadastrada → null', () => {
    expect(atingimentoDoMes(evolucao, { de: '2026-09', ate: '2026-09' })).toBeNull();
  });

  it('meta zero não divide por zero', () => {
    expect(atingimentoDoMes(evolucao, { de: '2026-10', ate: '2026-10' })?.pct).toBeNull();
  });

  it('mês final fora da evolução → null', () => {
    expect(atingimentoDoMes(evolucao, { de: '2025-01', ate: '2025-08' })).toBeNull();
  });
});
