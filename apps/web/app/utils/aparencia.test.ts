import { describe, expect, it } from 'vitest';
import { ESCALA_PADRAO, lerEscalaSalva, lerTemaSalvo, mudarEscala } from './aparencia';

describe('aparência', () => {
  it('aumenta e diminui a fonte parando nas pontas', () => {
    expect(mudarEscala(100, 1)).toBe(110);
    expect(mudarEscala(100, -1)).toBe(90);
    expect(mudarEscala(90, -1)).toBe(90);
    expect(mudarEscala(130, 1)).toBe(130);
  });

  it('valor salvo inválido volta ao padrão', () => {
    expect(lerEscalaSalva('115')).toBe(ESCALA_PADRAO);
    expect(lerEscalaSalva(null)).toBe(ESCALA_PADRAO);
    expect(lerEscalaSalva('120')).toBe(120);
    expect(lerTemaSalvo('vinho')).toBe('vinho');
    expect(lerTemaSalvo('toString')).toBe('padrao');
    expect(lerTemaSalvo(undefined)).toBe('padrao');
  });
});
