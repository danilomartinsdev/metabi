import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resumirDispositivo } from '../src/modules/audit/dispositivo.js';
import { type Contexto, criarUsuario, iniciarApp, limparBanco, login } from './helpers.js';

let ctx: Contexto;
let tokenAdmin: string;

const UA_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0';

const get = (url: string, token: string) =>
  ctx.app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });
const ping = (token: string, ua = UA_EDGE) =>
  ctx.app.inject({
    method: 'POST',
    url: '/api/auth/presenca',
    headers: { authorization: `Bearer ${token}`, 'user-agent': ua },
  });

/** A presença é gravada em segundo plano: espera aparecer (ou sumir) na lista. */
async function onlineAte(cond: (emails: string[]) => boolean) {
  let emails: string[] = [];
  for (let i = 0; i < 20; i++) {
    const r = await get('/api/auditoria/online', tokenAdmin);
    emails = r.json().usuarios.map((u: { email: string }) => u.email);
    if (cond(emails)) return emails;
    await new Promise((ok) => setTimeout(ok, 50));
  }
  return emails;
}

beforeAll(async () => {
  ctx = await iniciarApp();
  await limparBanco(ctx.prisma);
  await criarUsuario(ctx.prisma, { email: 'admin@meta.com', papel: 'admin' });
  await criarUsuario(ctx.prisma, { email: 'rep@meta.com', papel: 'representante' });
  tokenAdmin = (await login(ctx.app, 'admin@meta.com')).body.accessToken;
});

afterAll(async () => {
  await ctx?.app.close();
});

describe('auditoria — usuários online', () => {
  it('quem usa o sistema aparece com papel, dispositivo e horário', async () => {
    const rep = await login(ctx.app, 'rep@meta.com');
    expect((await ping(rep.body.accessToken)).statusCode).toBe(204);
    const emails = await onlineAte((e) => e.includes('rep@meta.com'));
    expect(emails).toContain('rep@meta.com');

    const b = (await get('/api/auditoria/online', tokenAdmin)).json();
    expect(b.janelaMinutos).toBe(5);
    const u = b.usuarios.find((x: { email: string }) => x.email === 'rep@meta.com');
    expect(u).toMatchObject({
      nome: expect.any(String),
      papel: expect.any(String),
      dispositivo: 'Edge · Windows',
    });
    expect(Date.now() - new Date(u.ultimaAtividadeEm).getTime()).toBeLessThan(60_000);
  });

  it('atividade antiga (fora da janela) não conta como online', async () => {
    const rep = await ctx.prisma.usuario.findUniqueOrThrow({ where: { email: 'rep@meta.com' } });
    await ctx.prisma.presenca.update({
      where: { usuarioId: rep.id },
      data: { ultimaAtividadeEm: new Date(Date.now() - 6 * 60_000) },
    });
    expect(await onlineAte((e) => !e.includes('rep@meta.com'))).not.toContain('rep@meta.com');
  });

  it('depois do logout (sessão revogada) sai da lista', async () => {
    await criarUsuario(ctx.prisma, { email: 'gestor@meta.com', papel: 'gestor-comercial' });
    const g = await login(ctx.app, 'gestor@meta.com');
    await ping(g.body.accessToken);
    expect(await onlineAte((e) => e.includes('gestor@meta.com'))).toContain('gestor@meta.com');
    const out = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: `mb_rt=${g.refresh}` },
    });
    expect(out.statusCode).toBe(204);
    expect(await onlineAte((e) => !e.includes('gestor@meta.com'))).not.toContain('gestor@meta.com');
  });

  it('sem audit.view: 403; sem login: 401', async () => {
    const rep = (await login(ctx.app, 'rep@meta.com')).body.accessToken;
    expect((await get('/api/auditoria/online', rep)).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: 'GET', url: '/api/auditoria/online' })).statusCode).toBe(401);
    expect((await ctx.app.inject({ method: 'POST', url: '/api/auth/presenca' })).statusCode).toBe(401);
  });
});

describe('resumirDispositivo', () => {
  it.each([
    [UA_EDGE, 'Edge · Windows'],
    [
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
      'Chrome · Android',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1',
      'Safari · iOS',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0',
      'Firefox · macOS',
    ],
    ['curl/8.0', null],
    [null, null],
  ])('%s → %s', (ua, esperado) => {
    expect(resumirDispositivo(ua)).toBe(esperado);
  });
});
