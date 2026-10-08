import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Contexto, criarUsuario, iniciarApp, limparBanco, login } from './helpers.js';

const AMOSTRA = path.resolve(import.meta.dirname, '../../../fixtures/focco/amostras/amostra-anonimizada.xls');
let ctx: Contexto;
let tokenGestor: string;
let tokenRep: string;
let repId: string;
let outroRepId: string;

const get = (url: string, token: string) =>
  ctx.app
    .inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } })
    .then((r) => ({ status: r.statusCode, body: r.json() }));

beforeAll(async () => {
  ctx = await iniciarApp();
  await limparBanco(ctx.prisma);
  await criarUsuario(ctx.prisma, { email: 'gestor@meta.com', papel: 'gestor-comercial' });
  tokenGestor = (await login(ctx.app, 'gestor@meta.com')).body.accessToken;

  const b = '----escopo';
  const payload = Buffer.concat([
    Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="arquivo"; filename="a.xls"\r\n\r\n`),
    fs.readFileSync(AMOSTRA),
    Buffer.from(`\r\n--${b}--\r\n`),
  ]);
  const h = { authorization: `Bearer ${tokenGestor}` };
  const p = (
    await ctx.app.inject({
      method: 'POST',
      url: '/api/import/previa',
      payload,
      headers: { ...h, 'content-type': `multipart/form-data; boundary=${b}` },
    })
  ).json();
  await ctx.app.inject({
    method: 'POST',
    url: '/api/import/confirmar',
    headers: h,
    payload: { hash: p.hash, arquivoNome: 'a.xls' },
  });

  const reps = await ctx.prisma.representante.findMany({ orderBy: { codigo: 'asc' } });
  repId = reps.find((r) => r.codigo === 'MURILLO')!.id;
  outroRepId = reps.find((r) => r.codigo !== 'MURILLO')!.id;
  const u = await criarUsuario(ctx.prisma, { email: 'rep@meta.com', papel: 'representante' });
  await ctx.prisma.usuario.update({ where: { id: u.id }, data: { escopoTipo: 'REPRESENTANTES' } });
  await ctx.prisma.usuarioRepresentante.create({ data: { usuarioId: u.id, representanteId: repId } });
  tokenRep = (await login(ctx.app, 'rep@meta.com')).body.accessToken;
});

afterAll(async () => {
  await ctx.app.close();
});

describe('escopo de dados (RBAC) nos dashboards e pedidos', () => {
  const periodo = 'de=2026-01&ate=2026-12';

  it('representante vê só o total dos seus pedidos', async () => {
    const todos = await get(`/api/dashboard/ranking/gestores?${periodo}`, tokenGestor);
    const doRep = todos.body.linhas.find((l: { chave: string }) => l.chave === repId);
    const visao = await get(`/api/dashboard/visao-geral?${periodo}`, tokenRep);
    expect(visao.status).toBe(200);
    expect(visao.body.kpis.total.valor).toBe(doRep.total);
    expect(visao.body.topGestores.map((g: { chave: string }) => g.chave)).toEqual([repId]);
    const pedidos = await get(`/api/pedidos?${periodo}`, tokenRep);
    expect(pedidos.body.meta.valorTotal).toBe(doRep.total);
  });

  it('filtrar por outro gestor não vaza dados (interseção com o escopo)', async () => {
    const r = await get(`/api/dashboard/visao-geral?${periodo}&gestor=${outroRepId}`, tokenRep);
    expect(r.body.kpis.total.valor).toBe('0.00');
    const p = await get(`/api/pedidos?${periodo}&gestor=${outroRepId}`, tokenRep);
    expect(p.body.meta.total).toBe(0);
    expect(p.body.meta.valorTotal).toBe('0.00');
  });

  it('lista de pedidos e rankings do representante contêm só o seu gestor', async () => {
    const p = await get(`/api/pedidos?${periodo}&pageSize=200`, tokenRep);
    expect(p.body.data.length).toBeGreaterThan(0);
    expect(new Set(p.body.data.map((x: { gestor: string }) => x.gestor))).toEqual(new Set(['MURILLO']));
    for (const dim of ['estados', 'regioes']) {
      const r = await get(`/api/dashboard/ranking/${dim}?${periodo}`, tokenRep);
      const gestor = await get(`/api/dashboard/ranking/${dim}?${periodo}&gestor=${repId}`, tokenGestor);
      expect(r.body.total).toEqual(gestor.body.total);
    }
    const c = await get(`/api/dashboard/clientes?${periodo}`, tokenRep);
    const cGestor = await get(`/api/dashboard/clientes?${periodo}&gestor=${repId}`, tokenGestor);
    expect(c.body.total).toBe(cGestor.body.total);
  });

  it('representante sem vínculo não vê nada', async () => {
    await criarUsuario(ctx.prisma, { email: 'semvinculo@meta.com', papel: 'representante' }).then((u) =>
      ctx.prisma.usuario.update({ where: { id: u.id }, data: { escopoTipo: 'REPRESENTANTES' } }),
    );
    const t = (await login(ctx.app, 'semvinculo@meta.com')).body.accessToken;
    const v = await get(`/api/dashboard/visao-geral?${periodo}`, t);
    expect(v.body.kpis.total.valor).toBe('0.00');
    expect((await get(`/api/pedidos?${periodo}`, t)).body.meta.total).toBe(0);
  });

  it('filtros inválidos na URL são recusados com 400', async () => {
    expect((await get('/api/dashboard/visao-geral?de=2026-13', tokenGestor)).status).toBe(400);
    expect((await get('/api/dashboard/visao-geral?gestor=nao-e-uuid', tokenGestor)).status).toBe(400);
    expect((await get('/api/dashboard/ranking/clientes-vip', tokenGestor)).status).toBe(400);
  });
});

describe('papel só com "Ver Minhas vendas" (sem Ver dashboards / Ver pedidos)', () => {
  const periodo = 'de=2026-01&ate=2026-12';

  async function usuarioComPapel(email: string, permissoes: string[]) {
    const role = await ctx.prisma.role.create({
      data: {
        chave: `teste-${email}`,
        nome: email,
        permissoes: { create: permissoes.map((permissao) => ({ permissao })) },
      },
    });
    const u = await criarUsuario(ctx.prisma, { email });
    await ctx.prisma.usuario.update({
      where: { id: u.id },
      data: { roleId: role.id, escopoTipo: 'REPRESENTANTES' },
    });
    await ctx.prisma.usuarioRepresentante.create({ data: { usuarioId: u.id, representanteId: repId } });
    return (await login(ctx.app, email)).body.accessToken as string;
  }

  it('vê os próprios números (os mesmos do representante) e nada dos outros', async () => {
    const t = await usuarioComPapel('so-mv@meta.com', ['minhas-vendas.view']);
    const proprio = await get(`/api/dashboard/visao-geral?${periodo}`, t);
    expect(proprio.status).toBe(200);
    expect(proprio.body.kpis.total.valor).toBe(
      (await get(`/api/dashboard/visao-geral?${periodo}`, tokenRep)).body.kpis.total.valor,
    );
    expect(
      (await get(`/api/dashboard/ranking/gestores?${periodo}`, t)).body.linhas.map(
        (l: { chave: string }) => l.chave,
      ),
    ).toEqual([repId]);
    expect((await get(`/api/pedidos?${periodo}&gestor=${outroRepId}`, t)).body.meta.total).toBe(0);
    expect((await get('/api/dashboard/meses', t)).status).toBe(200);
    expect((await get('/api/metas?ano=2026', t)).status).toBe(403);
  });

  it('sem nenhuma das permissões de vendas, as consultas são 403', async () => {
    const t = await usuarioComPapel('sem-vendas@meta.com', ['audit.view']);
    expect((await get(`/api/dashboard/visao-geral?${periodo}`, t)).status).toBe(403);
    expect((await get(`/api/pedidos?${periodo}`, t)).status).toBe(403);
  });
});
