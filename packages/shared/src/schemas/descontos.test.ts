import { describe, expect, it } from 'vitest';
import { precosSalvarSchema, precoTabelaSchema } from './descontos.js';

describe('precoTabelaSchema', () => {
  it('aceita formatos pt-BR e ponto decimal, até 4 casas', () => {
    expect(precoTabelaSchema.parse('1.234,56')).toBe('1234.56');
    expect(precoTabelaSchema.parse('12,3456')).toBe('12.3456');
    expect(precoTabelaSchema.parse('99.9')).toBe('99.9');
    expect(precoTabelaSchema.parse(15)).toBe('15');
  });

  it('rejeita negativo, texto e mais de 4 casas', () => {
    expect(precoTabelaSchema.safeParse('-1').success).toBe(false);
    expect(precoTabelaSchema.safeParse('abc').success).toBe(false);
    expect(precoTabelaSchema.safeParse('1,23456').success).toBe(false);
  });
});

describe('precosSalvarSchema', () => {
  it('aceita preço null (apagar) e unidade vazia', () => {
    const r = precosSalvarSchema.safeParse({
      ano: 2026,
      precos: [
        { produtoCodigo: 'MT169', unidade: 'UN', preco: '10,50' },
        { produtoCodigo: 'MT170', unidade: '', preco: null },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('rejeita lista vazia, código vazio e ano fora da faixa', () => {
    expect(precosSalvarSchema.safeParse({ ano: 2026, precos: [] }).success).toBe(false);
    expect(
      precosSalvarSchema.safeParse({ ano: 2026, precos: [{ produtoCodigo: ' ', unidade: '', preco: '1' }] })
        .success,
    ).toBe(false);
    expect(
      precosSalvarSchema.safeParse({ ano: 1999, precos: [{ produtoCodigo: 'A', unidade: '', preco: '1' }] })
        .success,
    ).toBe(false);
  });
});
