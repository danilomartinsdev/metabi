import { describe, expect, it } from 'vitest';
import { migrarChavesAntigas } from './migrar-chaves';

function armazenamento(inicial: Record<string, string>): Storage {
  const m = new Map(Object.entries(inicial));
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe('migrarChavesAntigas', () => {
  it('passa as preferências de meta-bi* para metabi* e apaga as antigas', () => {
    const s = armazenamento({
      'meta-bi-tema': 'dark',
      'meta-bi-fonte': '110',
      'meta-bi-novidades:u1': '2026-10-19-1',
      'meta-bi:menu-grupos-abertos': '["Administração"]',
      outra: 'fica',
    });
    const migradas = migrarChavesAntigas(s);
    expect(migradas.sort()).toEqual(
      ['metabi-fonte', 'metabi-novidades:u1', 'metabi-tema', 'metabi:menu-grupos-abertos'].sort(),
    );
    expect(s.getItem('metabi-tema')).toBe('dark');
    expect(s.getItem('metabi:menu-grupos-abertos')).toBe('["Administração"]');
    expect(s.getItem('meta-bi-tema')).toBeNull();
    expect(s.getItem('outra')).toBe('fica');
  });

  it('não sobrescreve uma chave nova que já existe', () => {
    const s = armazenamento({ 'meta-bi-tema': 'dark', 'metabi-tema': 'light' });
    expect(migrarChavesAntigas(s)).toEqual([]);
    expect(s.getItem('metabi-tema')).toBe('light');
    expect(s.getItem('meta-bi-tema')).toBeNull();
  });

  it('sem chaves antigas, não faz nada', () => {
    const s = armazenamento({ 'metabi-fonte': '100' });
    expect(migrarChavesAntigas(s)).toEqual([]);
    expect(s.length).toBe(1);
  });
});
