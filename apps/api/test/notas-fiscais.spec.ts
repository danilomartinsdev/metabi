import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Contexto, criarUsuario, iniciarApp, limparBanco, login } from './helpers.js';

// Amostra sintética (dados fictícios) no formato do relatório de itens de nota fiscal do Focco.
// Valores esperados calculados à mão: total 2.000,00 — jan 1.800,00, fev 200,00.
const AMOSTRA = path.resolve(import.meta.dirname, '../../../fixtures/faturamento/amostras/notas-amostra.csv');
let ctx: Contexto;
let tokenGestor: string;

function multipart(arquivo: Buffer, nome = 'notas.csv') {
  const b = '----notas';
  return {
    payload: Buffer.concat([
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nome}"\r\n\r\n`),
      arquivo,
      Buffer.from(`\r\n--${b}--\r\n`),
    ]),
    contentType: `multipart/form-data; boundary=${b}`,
  };
}

const req = (method: 'GET' | 'POST', url: string, token: string, extra: object = {}) =>
  ctx.app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...extra });

async function previa(token: string, arquivo = fs.readFileSync(AMOSTRA)) {
  const m = multipart(arquivo);
  return req('POST', '/api/faturamento/notas/import/previa', token, {
    payload: m.payload,
    headers: { authorization: `Bearer ${token}`, 'content-type': m.contentType },
  });
}
async function importar(token: string) {
  const p = (await previa(token)).json();
  const conf = await req('POST', '/api/faturamento/notas/import/confirmar', token, {
    payload: { hash: p.hash, arquivoNome: 'notas.csv' },
  });
  return { previa: p, confirmar: conf };
}

beforeAll(async () => {
  ctx = await iniciarApp();
  await limparBanco(ctx.prisma);
  await criarUsuario(ctx.prisma, { email: 'gestor@meta.com', papel: 'gestor-comercial' });
  tokenGestor = (await login(ctx.app, 'gestor@meta.com')).body.accessToken;
});

afterAll(async () => {
  await ctx.app.close();
});

describe('notas fiscais — importação', () => {
  it('prévia lê itens, notas, meses e total (linha de total do rodapé é ignorada)', async () => {
    const r = await previa(tokenGestor);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      itens: 5,
      notas: 4,
      total: '2000.00',
      erros: [],
      meses: [
        { mes: '2026-01', itens: 3, total: '1800.00', itensExistentes: 0 },
        { mes: '2026-02', itens: 2, total: '200.00', itensExistentes: 0 },
      ],
    });
  });

  it('confirmar grava; reimportar substitui os meses do arquivo (não duplica)', async () => {
    const a = await importar(tokenGestor);
    expect(a.confirmar.statusCode).toBe(200);
    expect(a.confirmar.json()).toMatchObject({ itens: 5, substituidos: 0, meses: ['2026-01', '2026-02'] });
    const b = await importar(tokenGestor);
    expect(b.previa.meses[0]).toMatchObject({ itensExistentes: 3, totalExistente: '1800.00' });
    expect(b.confirmar.json()).toMatchObject({ itens: 5, substituidos: 5 });
    expect(await ctx.prisma.notaFiscalItem.count()).toBe(5);
    expect(await ctx.prisma.auditLog.count({ where: { acao: 'notas.importadas' } })).toBe(2);
  });

  it('arquivo com linha inválida não é gravado', async () => {
    const ruim = fs.readFileSync(AMOSTRA, 'utf8').replace('05/01/2026 00:00:00', '32/01/2026');
    const p = (await previa(tokenGestor, Buffer.from(ruim))).json();
    expect(p.erros).toHaveLength(1);
    const c = await req('POST', '/api/faturamento/notas/import/confirmar', tokenGestor, {
      payload: { hash: p.hash, arquivoNome: 'notas.csv' },
    });
    expect(c.statusCode).toBe(400);
  });
});

describe('notas fiscais — análise', () => {
  it('divisões, representantes e curvas ABC do ano (variantes "MT169." e "MT169" juntas)', async () => {
    const r = await req('GET', '/api/faturamento/notas/analise', tokenGestor);
    expect(r.statusCode).toBe(200);
    const a = r.json();
    expect(a).toMatchObject({
      periodo: { de: '2026-01', ate: '2026-02' },
      total: '2000.00',
      notas: 4,
      clientes: 3,
    });
    expect(a.divisoes).toEqual([
      { divisao: 'PRIVADO - MERCADO INTERNO PRIVADO', total: '1650.00', notas: 2, participacao: 0.825 },
      {
        divisao: 'LICITACAO - LICITACAO ELETRONICA E PRESENCIAL',
        total: '350.00',
        notas: 2,
        participacao: 0.175,
      },
    ]);
    expect(a.representantes).toEqual([
      {
        codigo: '1',
        nome: 'REPRESENTANTE ALFA LTDA',
        total: '1650.00',
        notas: 2,
        clientes: 2,
        participacao: 0.825,
      },
      {
        codigo: '2',
        nome: 'REPRESENTANTE BETA LTDA',
        total: '350.00',
        notas: 2,
        clientes: 1,
        participacao: 0.175,
      },
    ]);
    // Clientes: 1.500 (A) · 350 (acumulado anterior 75% → A) · 150 (anterior 92,5% → B)
    type Cli = { codigo: string; total: string; classe: string };
    expect(a.abcClientes.map((c: Cli) => [c.codigo, c.total, c.classe])).toEqual([
      ['100', '1500.00', 'A'],
      ['200', '350.00', 'A'],
      ['300', '150.00', 'B'],
    ]);
    expect(a.abcClientes[1]).toMatchObject({
      nomeFantasia: null,
      razaoSocial: 'PREFEITURA EXEMPLO B',
      uf: 'MG',
      notas: 2,
    });
    // Produtos: MT169 = 1.000 + 500 (qtde 3) · MT416 = 300 + 150 · ND1150 (anterior 97,5% → C)
    expect(a.abcProdutos).toEqual([
      {
        codigo: 'MT169',
        descricao: 'CAMA EXEMPLO MT169',
        unidade: 'UN',
        quantidade: '3.00',
        total: '1500.00',
        participacao: 0.75,
        acumulado: 0.75,
        classe: 'A',
      },
      {
        codigo: 'MT416',
        descricao: 'MACA EXEMPLO',
        unidade: 'UN',
        quantidade: '4.00',
        total: '450.00',
        participacao: 0.225,
        acumulado: 0.975,
        classe: 'A',
      },
      {
        codigo: 'ND1150',
        descricao: 'SUPORTE EXEMPLO',
        unidade: 'KG',
        quantidade: '1.00',
        total: '50.00',
        participacao: 0.025,
        acumulado: 1,
        classe: 'C',
      },
    ]);
  });

  it('ranking de representantes por divisão (participação dentro da divisão)', async () => {
    const a = (await req('GET', '/api/faturamento/notas/analise', tokenGestor)).json();
    expect(a.representantesPorDivisao).toEqual([
      {
        divisao: 'PRIVADO - MERCADO INTERNO PRIVADO',
        total: '1650.00',
        representantes: [
          {
            codigo: '1',
            nome: 'REPRESENTANTE ALFA LTDA',
            total: '1650.00',
            notas: 2,
            clientes: 2,
            participacao: 1,
          },
        ],
      },
      {
        divisao: 'LICITACAO - LICITACAO ELETRONICA E PRESENCIAL',
        total: '350.00',
        representantes: [
          {
            codigo: '2',
            nome: 'REPRESENTANTE BETA LTDA',
            total: '350.00',
            notas: 2,
            clientes: 1,
            participacao: 1,
          },
        ],
      },
    ]);
  });

  it('curva ABC pela quantidade, separada por unidade (UN e KG não se somam)', async () => {
    const a = (await req('GET', '/api/faturamento/notas/analise', tokenGestor)).json();
    type P = { codigo: string; quantidade: string; participacao: number; acumulado: number; classe: string };
    type U = { unidade: string; quantidadeTotal: string; produtos: P[] };
    // UN (R$ 1.950) antes de KG (R$ 50). UN: MT416 = 3 + 1 (4/7, A) · MT169 = 2 + 1 (anterior 4/7 → A)
    expect(a.abcProdutosQuantidade.map((u: U) => [u.unidade, u.quantidadeTotal])).toEqual([
      ['UN', '7.00'],
      ['KG', '1.00'],
    ]);
    const un = a.abcProdutosQuantidade[0].produtos as P[];
    expect(un.map((p) => [p.codigo, p.quantidade, p.classe])).toEqual([
      ['MT416', '4.00', 'A'],
      ['MT169', '3.00', 'A'],
    ]);
    expect(un[0]!.participacao).toBeCloseTo(4 / 7, 10);
    expect(un[1]!.acumulado).toBeCloseTo(1, 10);
    expect(a.abcProdutosQuantidade[1].produtos).toMatchObject([
      { codigo: 'ND1150', quantidade: '1.00', participacao: 1, acumulado: 1, classe: 'A' },
    ]);
  });

  it('respeita o período', async () => {
    const a = (await req('GET', '/api/faturamento/notas/analise?de=2026-02&ate=2026-02', tokenGestor)).json();
    expect(a).toMatchObject({ total: '200.00', notas: 2 });
    expect(a.abcProdutos.map((p: { codigo: string }) => p.codigo)).toEqual(['MT416', 'ND1150']);
  });

  it('período inválido → 400', async () => {
    const r = await req('GET', '/api/faturamento/notas/analise?de=2026-05&ate=2026-01', tokenGestor);
    expect(r.statusCode).toBe(400);
  });
});

describe('notas fiscais — acesso', () => {
  it('papel sem a permissão (representante) recebe 403', async () => {
    await criarUsuario(ctx.prisma, { email: 'rep@meta.com', papel: 'representante' });
    const t = (await login(ctx.app, 'rep@meta.com')).body.accessToken;
    expect((await req('GET', '/api/faturamento/notas/analise', t)).statusCode).toBe(403);
    expect((await previa(t)).statusCode).toBe(403);
  });

  it('com a permissão mas escopo parcial (por representante) recebe 403', async () => {
    const u = await criarUsuario(ctx.prisma, { email: 'gestor-parcial@meta.com', papel: 'gestor-comercial' });
    await ctx.prisma.usuario.update({ where: { id: u.id }, data: { escopoTipo: 'REPRESENTANTES' } });
    const t = (await login(ctx.app, 'gestor-parcial@meta.com')).body.accessToken;
    expect((await req('GET', '/api/faturamento/notas/analise', t)).statusCode).toBe(403);
    expect((await req('GET', '/api/faturamento/notas/import/lotes', t)).statusCode).toBe(403);
    expect((await previa(t)).statusCode).toBe(403);
  });

  /** Papel sob medida com escopo "todos" (o escopo não é o que está em teste aqui). */
  async function tokenComPermissoes(email: string, permissoes: string[]) {
    const role = await ctx.prisma.role.create({
      data: {
        chave: `teste-${email}`,
        nome: email,
        permissoes: { create: permissoes.map((permissao) => ({ permissao })) },
      },
    });
    const u = await criarUsuario(ctx.prisma, { email });
    await ctx.prisma.usuario.update({ where: { id: u.id }, data: { roleId: role.id } });
    return (await login(ctx.app, email)).body.accessToken as string;
  }

  it('"Ver faturamento" sozinho não abre a análise (permissão própria)', async () => {
    const t = await tokenComPermissoes('so-fat@meta.com', ['faturamento.view']);
    expect((await req('GET', '/api/faturamento/notas/analise', t)).statusCode).toBe(403);
    expect((await req('GET', '/api/faturamento/resumo', t)).statusCode).toBe(200);
  });

  it('"Ver análise de faturamento" sozinho abre a análise e não o faturamento', async () => {
    const t = await tokenComPermissoes('so-analise@meta.com', ['faturamento-analise.view']);
    expect((await req('GET', '/api/faturamento/notas/analise', t)).statusCode).toBe(200);
    expect((await req('GET', '/api/faturamento/resumo', t)).statusCode).toBe(403);
    expect((await previa(t)).statusCode).toBe(403);
  });

  it('sem login recebe 401', async () => {
    const r = await ctx.app.inject({ method: 'GET', url: '/api/faturamento/notas/analise' });
    expect(r.statusCode).toBe(401);
  });
});
