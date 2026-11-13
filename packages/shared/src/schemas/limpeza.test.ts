import { describe, expect, it } from 'vitest';
import { limpezaExecutarSchema } from './limpeza.js';

describe('limpezaExecutarSchema', () => {
  it('aceita ano e áreas válidos', () => {
    const r = limpezaExecutarSchema.safeParse({ ano: 2023, areas: ['pedidos', 'metas'], confirmacao: 2023 });
    expect(r.success).toBe(true);
  });

  it('rejeita sem área, área desconhecida e ano fora da faixa', () => {
    expect(limpezaExecutarSchema.safeParse({ ano: 2023, areas: [], confirmacao: 2023 }).success).toBe(false);
    expect(limpezaExecutarSchema.safeParse({ ano: 2023, areas: ['usuarios'], confirmacao: 2023 }).success).toBe(false);
    expect(limpezaExecutarSchema.safeParse({ ano: 1999, areas: ['pedidos'], confirmacao: 1999 }).success).toBe(false);
  });
});
