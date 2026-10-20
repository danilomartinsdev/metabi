import { PALETAS_GRAFICO } from '@metabi/shared';
import { describe, expect, it } from 'vitest';
import { evolucaoOptions } from './options';
import { PALETAS, TEMA_CLARO, aplicarPaleta } from './palette';

describe('aplicarPaleta', () => {
  it('padrão (ou nenhuma) não altera o tema base', () => {
    expect(aplicarPaleta(TEMA_CLARO, null, false)).toEqual(TEMA_CLARO);
    expect(aplicarPaleta(TEMA_CLARO, 'padrao', true)).toEqual(TEMA_CLARO);
  });

  it('troca principal, comparação, meta e fatias conforme o tema claro/escuro', () => {
    const claro = aplicarPaleta(TEMA_CLARO, 'esmeralda', false);
    expect(claro).toMatchObject({
      primaria: PALETAS.esmeralda.principal!.claro,
      comparacao: PALETAS.esmeralda.comparacao!.claro,
      destaque: PALETAS.esmeralda.meta!.claro,
      categorica: PALETAS.esmeralda.fatias,
    });
    expect(aplicarPaleta(TEMA_CLARO, 'esmeralda', true).primaria).toBe(PALETAS.esmeralda.principal!.escuro);
    // Texto e eixos continuam do tema.
    expect(claro.textoSuave).toBe(TEMA_CLARO.textoSuave);
  });

  it('toda paleta tem nome e pelo menos 6 cores de fatia', () => {
    for (const p of PALETAS_GRAFICO) {
      expect(PALETAS[p].nome).toBeTruthy();
      expect(PALETAS[p].fatias.length).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('gráficos usam a cor de comparação no ano anterior', () => {
  it('evolução mensal: linha do ano anterior com t.comparacao', () => {
    const t = aplicarPaleta(TEMA_CLARO, 'vinho', false);
    const ev = {
      ano: 2026,
      meses: [{ mes: 1, real: '10', anoAnterior: '8', meta: null }],
      atingimento: null,
    };
    const series = evolucaoOptions(ev, t).series as { name: string; lineStyle?: { color: string } }[];
    expect(series[1]!.lineStyle!.color).toBe(PALETAS.vinho.comparacao!.claro);
  });
});
