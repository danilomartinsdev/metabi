import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Contexto, criarUsuario, iniciarApp, limparBanco, login } from './helpers.js';

// Mesma amostra da análise de faturamento (dados fictícios), 2026:
//   MT169 (MT169. + MT169) UN: qtd 3, R$ 1.500,00 — rep 1 (ALFA)
//   MT416 UN: qtd 4, R$ 450,00 — rep 2 (BETA) 3 un./R$ 300,00 + rep 1 1 un./R$ 150,00
//   ND1150 KG: qtd 1, R$ 50,00 — sem preço nos testes
// Preços 2026: MT169 = 600,00; MT416 = 125,50. Esperado (à mão):
//   tabela = 3×600 + 4×125,50 = 2.302,00; vendido com preço = 1.950,00; desconto = 352,00
//   ALFA: tabela 1.800 + 125,50 = 1.925,50, vendido 1.650,00, desconto 275,50
//   BETA: tabela 376,50, vendido 300,00, desconto 76,50
const AMOSTRA = path.resolve(import.meta.dirname, '../../../fixtures/faturamento/amostras/notas-amostra.csv');
let ctx: Contexto;
let tokenAdmin: string;
let tokenGestor: string;

const req = (method: 'GET' | 'POST' | 'PUT', url: string, token: string, extra: object = {}) =>
  ctx.app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...extra });

async function importarAmostra(token: string) {
  const b = '----notas';
  const payload = Buffer.concat([
    Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="arquivo"; filename="notas.csv"\r\n\r\n`),
    fs.readFileSync(AMOSTRA),
    Buffer.from(`\r\n--${b}--\r\n`),
  ]);
  const p = await ctx.app.inject({
    method: 'POST',
    url: '/api/faturamento/notas/import/previa',
    payload,
    headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/form-data; boundary=${b}` },
  });
  const conf = await req('POST', '/api/faturamento/notas/import/confirmar', token, {
    payload: { hash: p.json().hash, arquivoNome: 'notas.csv' },
  });
  expect(conf.statusCode).toBe(200);
}

const salvar = (token: string, ano: number, precos: object[]) =>
  req('PUT', '/api/descontos/precos', token, { payload: { ano, precos } });

beforeAll(async () => {
  ctx = await iniciarApp();
  await limparBanco(ctx.prisma);
  await criarUsuario(ctx.prisma, { email: 'admin@meta.com', papel: 'admin' });
  await criarUsuario(ctx.prisma, { email: 'gestor@meta.com', papel: 'gestor-comercial' });
  tokenAdmin = (await login(ctx.app, 'admin@meta.com')).body.accessToken;
  tokenGestor = (await login(ctx.app, 'gestor@meta.com')).body.accessToken;
  await importarAmostra(tokenAdmin);
});

afterAll(async () => {
  await ctx.app.close();
});

describe('previsão de descontos', () => {
  it('sem preços: lista os produtos vendidos no ano e não calcula desconto', async () => {
    const r = await req('GET', '/api/descontos?ano=2026', tokenGestor);
    expect(r.statusCode).toBe(200);
    const d = r.json();
    expect(d.temNotas).toBe(true);
    expect(d.anos).toEqual([2026]);
    expect(d.resumo).toMatchObject({
      vendidoTotal: '2000.00',
      vendidoComPreco: '0.00',
      desconto: '0.00',
      cobertura: 0,
      produtos: 3,
      produtosComPreco: 0,
    });
    expect(d.produtos.map((p: { codigo: string }) => p.codigo)).toEqual(['MT169', 'MT416', 'ND1150']);
    expect(d.produtos[0]).toMatchObject({
      unidade: 'UN',
      quantidade: '3.00',
      vendido: '1500.00',
      preco: null,
    });
    expect(d.representantes).toEqual([]);
  });

  it('com preços: calcula desconto total, por produto e por representante', async () => {
    const s = await salvar(tokenAdmin, 2026, [
      { produtoCodigo: 'MT169', unidade: 'UN', preco: '600,00' },
      { produtoCodigo: 'MT416', unidade: 'UN', preco: '125.5' },
    ]);
    expect(s.statusCode).toBe(200);
    const d = s.json();
    expect(d.resumo).toMatchObject({
      vendidoTotal: '2000.00',
      vendidoComPreco: '1950.00',
      valorTabela: '2302.00',
      desconto: '352.00',
      cobertura: 0.975,
      produtosComPreco: 2,
    });
    const mt169 = d.produtos.find((p: { codigo: string }) => p.codigo === 'MT169');
    expect(mt169).toMatchObject({ preco: '600', valorTabela: '1800.00', desconto: '300.00' });
    expect(mt169.percentual).toBeCloseTo(300 / 1800, 6);
    expect(d.produtos.find((p: { codigo: string }) => p.codigo === 'ND1150')).toMatchObject({
      preco: null,
      desconto: null,
    });
    expect(d.representantes).toEqual([
      expect.objectContaining({
        codigo: '1',
        valorTabela: '1925.50',
        vendido: '1650.00',
        desconto: '275.50',
      }),
      expect.objectContaining({ codigo: '2', valorTabela: '376.50', vendido: '300.00', desconto: '76.50' }),
    ]);
  });

  it('cada ano tem sua tabela: mudar 2026 não altera 2025', async () => {
    expect(
      (await salvar(tokenAdmin, 2025, [{ produtoCodigo: 'MT169', unidade: 'UN', preco: '500' }])).statusCode,
    ).toBe(200);
    expect(
      (await salvar(tokenAdmin, 2026, [{ produtoCodigo: 'MT169', unidade: 'UN', preco: '650' }])).statusCode,
    ).toBe(200);

    const d2025 = (await req('GET', '/api/descontos?ano=2025', tokenAdmin)).json();
    expect(d2025.temNotas).toBe(false);
    expect(d2025.produtos).toEqual([
      expect.objectContaining({ codigo: 'MT169', preco: '500', quantidade: '0.00', vendido: '0.00' }),
    ]);
    const d2026 = (await req('GET', '/api/descontos?ano=2026', tokenAdmin)).json();
    const mt169 = d2026.produtos.find((p: { codigo: string }) => p.codigo === 'MT169');
    expect(mt169).toMatchObject({ preco: '650', precoAnoAnterior: '500', valorTabela: '1950.00' });
    expect(d2026.anos).toEqual([2026, 2025]);
  });

  it('preço null apaga só aquele produto/ano', async () => {
    const d = (
      await salvar(tokenAdmin, 2026, [{ produtoCodigo: 'MT416', unidade: 'UN', preco: null }])
    ).json();
    expect(d.produtos.find((p: { codigo: string }) => p.codigo === 'MT416').preco).toBeNull();
    expect(await ctx.prisma.precoTabela.count()).toBe(2); // MT169 em 2025 e 2026
  });

  it('valida preço e ano', async () => {
    expect(
      (await salvar(tokenAdmin, 2026, [{ produtoCodigo: 'MT169', unidade: 'UN', preco: '-1' }])).statusCode,
    ).toBe(400);
    expect((await req('GET', '/api/descontos?ano=1999', tokenAdmin)).statusCode).toBe(400);
  });

  it('alteração de preços fica na auditoria', async () => {
    expect(await ctx.prisma.auditLog.count({ where: { acao: 'precos.alterados' } })).toBeGreaterThan(0);
  });
});

describe('previsão de descontos — acesso', () => {
  it('gestor comercial vê, mas não edita a tabela', async () => {
    expect((await req('GET', '/api/descontos?ano=2026', tokenGestor)).statusCode).toBe(200);
    expect(
      (await salvar(tokenGestor, 2026, [{ produtoCodigo: 'MT169', unidade: 'UN', preco: '1' }])).statusCode,
    ).toBe(403);
  });

  it('representante e visualizador não veem', async () => {
    for (const papel of ['representante', 'visualizador'] as const) {
      await criarUsuario(ctx.prisma, { email: `${papel}@meta.com`, papel });
      const t = (await login(ctx.app, `${papel}@meta.com`)).body.accessToken;
      expect((await req('GET', '/api/descontos?ano=2026', t)).statusCode).toBe(403);
    }
  });

  it('com a permissão mas escopo parcial recebe 403', async () => {
    const u = await criarUsuario(ctx.prisma, { email: 'parcial@meta.com', papel: 'admin' });
    await ctx.prisma.usuario.update({ where: { id: u.id }, data: { escopoTipo: 'REPRESENTANTES' } });
    const t = (await login(ctx.app, 'parcial@meta.com')).body.accessToken;
    expect((await req('GET', '/api/descontos?ano=2026', t)).statusCode).toBe(403);
    expect((await salvar(t, 2026, [{ produtoCodigo: 'MT169', unidade: 'UN', preco: '1' }])).statusCode).toBe(
      403,
    );
  });

  it('sem login recebe 401', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/api/descontos?ano=2026' })).statusCode).toBe(401);
  });
});
