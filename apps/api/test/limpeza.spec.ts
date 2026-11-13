import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Contexto, criarUsuario, iniciarApp, limparBanco, login } from './helpers.js';

let ctx: Contexto;
let tokenAdmin: string;
let tokenGestor: string;

const req = (method: 'GET' | 'POST', url: string, token: string, payload?: object) =>
  ctx.app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });

async function semear() {
  const { prisma } = ctx;
  const rep = await prisma.representante.create({ data: { codigo: 'R1', nomeExibicao: 'Rep 1' } });
  const cliente = await prisma.cliente.create({ data: { nomeNormalizado: 'cliente 1', nomeOriginal: 'Cliente 1' } });
  const status = await prisma.statusPdv.create({ data: { codigo: 'FAT', descricao: 'Faturado' } });
  const pedido = (focoId: number, data: string) =>
    prisma.pedido.create({
      data: {
        focoId,
        numPedido: String(focoId),
        dtEmissao: new Date(`${data}T00:00:00Z`),
        competencia: new Date(`${data.slice(0, 8)}01T00:00:00Z`),
        statusId: status.id,
        clienteId: cliente.id,
        representanteId: rep.id,
        uf: 'SP',
        regiao: 'SUDESTE',
        valor: '100.00',
      },
    });
  await pedido(1, '2023-03-10');
  await pedido(2, '2023-11-02');
  await pedido(3, '2024-01-15');
  await prisma.meta.createMany({
    data: [
      { ano: 2023, mes: 1, representanteId: null, valor: '1000.00' },
      { ano: 2024, mes: 1, representanteId: null, valor: '2000.00' },
    ],
  });
  await prisma.faturamentoManual.create({ data: { ano: 2023, mes: 5, valor: '50.00' } });
}

beforeAll(async () => {
  ctx = await iniciarApp();
  await limparBanco(ctx.prisma);
  await criarUsuario(ctx.prisma, { email: 'admin@meta.com', papel: 'admin' });
  await criarUsuario(ctx.prisma, { email: 'gestor@meta.com', papel: 'gestor-comercial' });
  tokenAdmin = (await login(ctx.app, 'admin@meta.com')).body.accessToken;
  tokenGestor = (await login(ctx.app, 'gestor@meta.com')).body.accessToken;
  await semear();
});

afterAll(async () => {
  await ctx.app.close();
});

describe('limpeza por ano', () => {
  it('só Admin lista e executa', async () => {
    expect((await req('GET', '/api/limpeza', tokenGestor)).statusCode).toBe(403);
    const exec = await req('POST', '/api/limpeza', tokenGestor, { ano: 2023, areas: ['metas'], confirmacao: 2023 });
    expect(exec.statusCode).toBe(403);
    expect(await ctx.prisma.meta.count({ where: { ano: 2023 } })).toBe(1);
  });

  it('lista os anos com a contagem por área', async () => {
    const res = await req('GET', '/api/limpeza', tokenAdmin);
    expect(res.statusCode).toBe(200);
    const anos = res.json() as { ano: number; contagens: Record<string, number> }[];
    expect(anos.map((a) => a.ano)).toEqual([2024, 2023]);
    expect(anos[1]?.contagens).toMatchObject({ pedidos: 2, metas: 1, 'faturamento-manual': 1 });
  });

  it('recusa confirmação diferente do ano e área vazia', async () => {
    const errada = await req('POST', '/api/limpeza', tokenAdmin, { ano: 2023, areas: ['pedidos'], confirmacao: 2024 });
    expect(errada.statusCode).toBe(400);
    const vazia = await req('POST', '/api/limpeza', tokenAdmin, { ano: 2023, areas: [], confirmacao: 2023 });
    expect(vazia.statusCode).toBe(400);
    expect(await ctx.prisma.pedido.count()).toBe(3);
  });

  it('apaga só as áreas marcadas, só do ano escolhido, e audita', async () => {
    const res = await req('POST', '/api/limpeza', tokenAdmin, { ano: 2023, areas: ['pedidos', 'metas'], confirmacao: 2023 });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ ano: 2023, pedidos: 2, metas: 1 });

    expect(await ctx.prisma.pedido.count({ where: { dtEmissao: { lt: new Date('2024-01-01') } } })).toBe(0);
    expect(await ctx.prisma.pedido.count()).toBe(1); // 2024 intacto
    expect(await ctx.prisma.meta.count()).toBe(1); // meta de 2024 intacta
    expect(await ctx.prisma.faturamentoManual.count()).toBe(1); // área não marcada intacta
    expect(await ctx.prisma.representante.count()).toBe(1); // cadastros nunca são apagados

    const log = await ctx.prisma.auditLog.findFirst({ where: { acao: 'limpeza.executada' } });
    expect(log?.entidadeId).toBe('2023');
  });
});
