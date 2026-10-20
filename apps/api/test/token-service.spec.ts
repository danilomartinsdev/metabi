import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import type { Env } from '../src/config/env.js';
import { TokenService } from '../src/modules/auth/token.service.js';

const secret = 'segredo-de-teste-com-pelo-menos-32-caracteres';
const servico = new TokenService({ JWT_ACCESS_SECRET: secret, JWT_ACCESS_TTL_SECONDS: 900 } as Env);

function tokenCom(issuer: string, audience: string) {
  return new SignJWT({ sid: 'sessao-1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('usuario-1')
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));
}

describe('TokenService — troca do nome para MetaBI', () => {
  it('emite com o nome novo e verifica o próprio token', async () => {
    const { token } = await servico.emitirAccess({ sub: 'usuario-1', sid: 'sessao-1' });
    await expect(servico.verificarAccess(token)).resolves.toEqual({ sub: 'usuario-1', sid: 'sessao-1' });
  });

  it('aceita token ainda válido emitido com o nome antigo (meta-bi)', async () => {
    const token = await tokenCom('meta-bi', 'meta-bi-web');
    await expect(servico.verificarAccess(token)).resolves.toEqual({ sub: 'usuario-1', sid: 'sessao-1' });
  });

  it('recusa token de outro emissor', async () => {
    const token = await tokenCom('outro-sistema', 'metabi-web');
    await expect(servico.verificarAccess(token)).rejects.toThrow();
  });
});
