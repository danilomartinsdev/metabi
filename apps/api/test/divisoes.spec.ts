import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Contexto, criarUsuario, iniciarApp, limparBanco, login } from './helpers.js';

// Tela "Divisões de venda": ranking por divisão e filtro ?divisao= (nomes com vírgula, "SEM" = sem divisão).
const AMOSTRA = path.resolve(import.meta.dirname, '../../../fixtures/focco/amostras/amostra-anonimizada.xls');
const CORP = 'CORPORATIVA - VENDA DIRETORIA, GERENCIA E ASSISTENTE COMERCIAL';
const PRIV = 'PRIVADO - MERCADO INTERNO PRIVADO';
const periodo = 'de=2026-01&ate=2026-12';
let ctx: Contexto;
let token: string;
let tokenRep: string;
let repId: string;

const get = (url: string, t = token) =>
  ctx.app
    .inject({ method: 'GET', url, headers: { authorization: `Bearer ${t}` } })
    .then((r) => ({ status: r.statusCode, body: r.json() }));
const enc = encodeURIComponent;
type Linha = { chave: string; rotulo: string; total: string; qtd: number };

beforeAll(async () => {
  ctx = await iniciarApp();
  await limparBanco(ctx.prisma);
  await criarUsuario(ctx.prisma, { email: 'gestor@meta.com', papel: 'gestor-comercial' });
  token = (await login(ctx.app, 'gestor@meta.com')).body.accessToken;

  const b = '----div';
  const payload = Buffer.concat([
    Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="arquivo"; filename="a.xls"\r\n\r\n`),
    fs.readFileSync(AMOSTRA),
    Buffer.from(`\r\n--${b}--\r\n`),
  ]);
  const h = { authorization: `Bearer ${token}` };
  const p = (
    await ctx.app.inject({
      method: 'POST',
      url: '/api/import/previa',
      payload,
      headers: { ...h, 'content-type': `multipart/form-data; boundary=${b}` },
    })
  ).json();
  await ctx.app.inject({ method: 'POST', url: '/api/import/confirmar', headers: h, payload: { hash: p.hash } });

  // A amostra é anterior à coluna: distribui divisões à mão (1/3 CORP, 1/3 PRIV, 1/3 sem divisão).
  const pedidos = await ctx.prisma.pedido.findMany({ select: { id: true }, orderBy: { focoId: 'asc' } });
  const terco = Math.floor(pedidos.length / 3);
  await ctx.prisma.pedido.updateMany({
    where: { id: { in: pedidos.slice(0, terco).map((x) => x.id) } },
    data: { divisao: CORP },
  });
  await ctx.prisma.pedido.updateMany({
    where: { id: { in: pedidos.slice(terco, 2 * terco).map((x) => x.id) } },
    data: { divisao: PRIV },
  });

  repId = (await ctx.prisma.representante.findFirstOrThrow({ where: { codigo: 'MURILLO' } })).id;
  const u = await criarUsuario(ctx.prisma, { email: 'rep@meta.com', papel: 'representante' });
  await ctx.prisma.usuario.update({ where: { id: u.id }, data: { escopoTipo: 'REPRESENTANTES' } });
  await ctx.prisma.usuarioRepresentante.create({ data: { usuarioId: u.id, representanteId: repId } });
  tokenRep = (await login(ctx.app, 'rep@meta.com')).body.accessToken;
});

afterAll(async () => {
  await ctx.app.close();
});

describe('divisões de venda', () => {
  it('ranking por divisão soma o total do período, com "Sem divisão"', async () => {
    const r = await get(`/api/dashboard/ranking/divisoes?${periodo}`);
    expect(r.status).toBe(200);
    const chaves = r.body.linhas.map((l: Linha) => l.chave).sort();
    expect(chaves).toEqual([CORP, PRIV, 'SEM'].sort());
    expect(r.body.linhas.find((l: Linha) => l.chave === 'SEM').rotulo).toBe('Sem divisão');
    const geral = await get(`/api/dashboard/visao-geral?${periodo}`);
    expect(r.body.total.total).toBe(geral.body.kpis.total.valor);
  });

  it('filtro com nome que tem vírgula não é quebrado em dois', async () => {
    const todas = (await get(`/api/dashboard/ranking/divisoes?${periodo}`)).body.linhas as Linha[];
    const corp = todas.find((l) => l.chave === CORP)!;
    const r = await get(`/api/dashboard/ranking/divisoes?${periodo}&divisao=${enc(CORP)}`);
    expect(r.body.linhas.map((l: Linha) => l.chave)).toEqual([CORP]);
    expect(r.body.linhas[0].participacao).toBe(1);
    const p = await get(`/api/pedidos?${periodo}&divisao=${enc(CORP)}&pageSize=200`);
    expect(p.body.meta.total).toBe(corp.qtd);
    expect(p.body.meta.valorTotal).toBe(corp.total);
    expect(new Set(p.body.data.map((x: { divisao: string }) => x.divisao))).toEqual(new Set([CORP]));
  });

  it('várias divisões (parâmetro repetido) e "SEM" = pedidos sem divisão', async () => {
    const todas = (await get(`/api/dashboard/ranking/divisoes?${periodo}`)).body.linhas as Linha[];
    const r = await get(`/api/dashboard/ranking/divisoes?${periodo}&divisao=${enc(PRIV)}&divisao=SEM`);
    expect(r.body.linhas.map((l: Linha) => l.chave).sort()).toEqual([PRIV, 'SEM'].sort());
    const sem = await get(`/api/pedidos?${periodo}&divisao=SEM&pageSize=200`);
    expect(sem.body.meta.total).toBe(todas.find((l) => l.chave === 'SEM')!.qtd);
    expect(sem.body.data.every((x: { divisao: string | null }) => x.divisao === null)).toBe(true);
  });

  it('respeita o escopo do representante', async () => {
    const rep = await get(`/api/dashboard/ranking/divisoes?${periodo}`, tokenRep);
    const gestor = await get(`/api/dashboard/ranking/divisoes?${periodo}&gestor=${repId}`);
    expect(rep.status).toBe(200);
    expect(rep.body.linhas).toEqual(gestor.body.linhas);
  });
});
