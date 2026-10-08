import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Contexto, criarUsuario, iniciarApp, limparBanco, login } from './helpers.js';

// Amostra sintética (valores fictícios) no formato do relatório diário do Focco.
const AMOSTRA = path.resolve(
  import.meta.dirname,
  '../../../fixtures/faturamento/amostras/faturamento-amostra.xls',
);
let ctx: Contexto;
let tokenGestor: string;

function multipart(arquivo: Buffer, nome = 'faturamento.xls') {
  const b = '----faturamento';
  return {
    payload: Buffer.concat([
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nome}"\r\n\r\n`),
      arquivo,
      Buffer.from(`\r\n--${b}--\r\n`),
    ]),
    contentType: `multipart/form-data; boundary=${b}`,
  };
}

const req = (method: 'GET' | 'POST' | 'PUT', url: string, token: string, extra: object = {}) =>
  ctx.app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...extra });

async function importar(token: string, arquivo = fs.readFileSync(AMOSTRA), meses?: unknown) {
  const m = multipart(arquivo);
  const previa = await req('POST', '/api/faturamento/import/previa', token, {
    payload: m.payload,
    headers: { authorization: `Bearer ${token}`, 'content-type': m.contentType },
  });
  const p = previa.json();
  const conf = await req('POST', '/api/faturamento/import/confirmar', token, {
    payload: { hash: p.hash, arquivoNome: 'faturamento.xls', ...(meses === undefined ? {} : { meses }) },
  });
  return { previa: p, statusPrevia: previa.statusCode, confirmar: conf };
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

describe('faturamento — importação', () => {
  it('prévia lê o relatório: ano, dias, meses e totais (DRE = soma das parcelas)', async () => {
    const { previa, statusPrevia } = await importar(tokenGestor);
    expect(statusPrevia).toBe(200);
    expect(previa).toMatchObject({
      ano: 2026,
      dias: 6,
      erros: [],
      diasSubstituidos: 0,
      totais: {
        bruto: '8000.60',
        antecipado: '-300.10',
        remessa: '250.00',
        devolucao: '-150.25',
        dre: '7800.25',
      },
      meses: [
        { mes: 1, dias: 4, dre: '4400.25', diasExistentes: 0, dreExistente: '0.00' },
        { mes: 2, dias: 2, dre: '3400.00', diasExistentes: 0, dreExistente: '0.00' },
      ],
    });
  });

  it('reimportar o mesmo ano substitui os dias (não duplica)', async () => {
    const { previa, confirmar } = await importar(tokenGestor);
    expect(previa.diasSubstituidos).toBe(6);
    expect(confirmar.statusCode).toBe(200);
    expect(confirmar.json()).toMatchObject({ ano: 2026, dias: 6, substituidos: 6 });
    expect(await ctx.prisma.faturamentoDia.count()).toBe(6);
    expect(await ctx.prisma.faturamentoLote.count()).toBe(2);
  });

  it('arquivo só com fevereiro substitui fevereiro e mantém janeiro', async () => {
    const soFevereiro = fs
      .readFileSync(AMOSTRA, 'latin1')
      .split('\n')
      .filter((l) => !l.includes('/01/2026'))
      .join('\n');
    const { previa, confirmar } = await importar(tokenGestor, Buffer.from(soFevereiro, 'latin1'));
    expect(previa).toMatchObject({ dias: 2, diasSubstituidos: 2, meses: [{ mes: 2, dias: 2 }] });
    expect(confirmar.json()).toMatchObject({ dias: 2, substituidos: 2 });

    const loteNovo = confirmar.json().loteId;
    expect(await ctx.prisma.faturamentoDia.count({ where: { mes: 1 } })).toBe(4);
    expect(await ctx.prisma.faturamentoDia.count({ where: { mes: 1, loteId: loteNovo } })).toBe(0);
    expect(await ctx.prisma.faturamentoDia.count({ where: { mes: 2, loteId: loteNovo } })).toBe(2);
  });

  it('com meses escolhidos: grava e substitui só eles (prévia mostra o que já existe em cada mês)', async () => {
    const { previa, confirmar } = await importar(tokenGestor, undefined, [1]);
    expect(previa.meses).toMatchObject([
      { mes: 1, diasExistentes: 4, dreExistente: '4400.25' },
      { mes: 2, diasExistentes: 2, dreExistente: '3400.00' },
    ]);
    expect(confirmar.json()).toMatchObject({ meses: [1], dias: 4, substituidos: 4 });

    const loteNovo = confirmar.json().loteId;
    expect(await ctx.prisma.faturamentoDia.count({ where: { mes: 1, loteId: loteNovo } })).toBe(4);
    expect(await ctx.prisma.faturamentoDia.count({ where: { mes: 2, loteId: loteNovo } })).toBe(0);
    expect(await ctx.prisma.faturamentoDia.count()).toBe(6);
    const lote = await ctx.prisma.faturamentoLote.findUniqueOrThrow({ where: { id: loteNovo } });
    expect(lote.totalDre.toFixed(2)).toBe('4400.25');
  });

  it('mês que não está no arquivo ou lista vazia: 400 e nada muda', async () => {
    const antes = await ctx.prisma.faturamentoLote.count();
    expect((await importar(tokenGestor, undefined, [3])).confirmar.statusCode).toBe(400);
    expect((await importar(tokenGestor, undefined, [])).confirmar.statusCode).toBe(400);
    expect(await ctx.prisma.faturamentoLote.count()).toBe(antes);
    expect(await ctx.prisma.faturamentoDia.count()).toBe(6);
  });

  it('arquivo com DRE que não fecha aparece como erro de linha e não é gravado', async () => {
    const quebrado = fs.readFileSync(AMOSTRA, 'latin1').replace('<td>1649,75</td>', '<td>1600</td>');
    const { previa, confirmar } = await importar(tokenGestor, Buffer.from(quebrado, 'latin1'));
    expect(previa.erros).toHaveLength(1);
    expect(previa.erros[0].mensagens[0]).toContain('VLR FATURA DRE');
    expect(confirmar.statusCode).toBe(400);
  });
});

describe('faturamento — resumo', () => {
  it('cards, mês a mês e séries do período', async () => {
    const r = await req('GET', '/api/faturamento/resumo?de=2026-01&ate=2026-02', tokenGestor);
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.periodo).toEqual({ de: '2026-01', ate: '2026-02' });
    expect(b.kpis.dre).toEqual({ valor: '7800.25', anterior: '0.00', pct: null });
    expect(b.kpis.devolucao.valor).toBe('-150.25');
    expect(b.mensal.meses.map((m: { mes: number; dre: string }) => [m.mes, m.dre])).toEqual([
      [1, '4400.25'],
      [2, '3400.00'],
    ]);
    expect(b.mensal.total.dre).toBe('7800.25');
    expect(b.diario).toHaveLength(6);
    expect(b.semanal.map((s: { semana: number; dre: string }) => [s.semana, s.dre])).toEqual([
      [1, '1000.50'],
      [2, '3399.75'],
      [6, '3400.00'],
    ]);
  });

  it('sem período informado: de janeiro até o último mês com faturamento', async () => {
    const b = (await req('GET', '/api/faturamento/resumo', tokenGestor)).json();
    expect(b.periodo).toEqual({ de: '2026-01', ate: '2026-02' });
  });
});

describe('faturamento — acesso', () => {
  it('papel sem a permissão (representante) recebe 403', async () => {
    await criarUsuario(ctx.prisma, { email: 'rep@meta.com', papel: 'representante' });
    const t = (await login(ctx.app, 'rep@meta.com')).body.accessToken;
    expect((await req('GET', '/api/faturamento/resumo', t)).statusCode).toBe(403);
    expect((await req('GET', '/api/faturamento/anos', t)).statusCode).toBe(403);
    expect((await req('GET', '/api/faturamento/mensal?ano=2026', t)).statusCode).toBe(403);
    expect((await req('GET', '/api/faturamento/comparativo?anoA=2025&anoB=2026', t)).statusCode).toBe(403);
  });

  it('com a permissão mas escopo parcial (por representante) recebe 403', async () => {
    const u = await criarUsuario(ctx.prisma, { email: 'gestor-parcial@meta.com', papel: 'gestor-comercial' });
    await ctx.prisma.usuario.update({ where: { id: u.id }, data: { escopoTipo: 'REPRESENTANTES' } });
    const t = (await login(ctx.app, 'gestor-parcial@meta.com')).body.accessToken;
    expect((await req('GET', '/api/faturamento/resumo', t)).statusCode).toBe(403);
    expect((await req('GET', '/api/faturamento/comparativo?anoA=2025&anoB=2026', t)).statusCode).toBe(403);
    const m = multipart(fs.readFileSync(AMOSTRA));
    const r = await req('POST', '/api/faturamento/import/previa', t, {
      payload: m.payload,
      headers: { authorization: `Bearer ${t}`, 'content-type': m.contentType },
    });
    expect(r.statusCode).toBe(403);
  });

  it('sem login recebe 401', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/api/faturamento/resumo' })).statusCode).toBe(401);
  });
});

describe('faturamento — anos, mês a mês e comparativo', () => {
  // 2025: só janeiro, com os mesmos valores da amostra de 2026.
  const so2025Janeiro = () =>
    Buffer.from(
      fs
        .readFileSync(AMOSTRA, 'latin1')
        .split('\n')
        .filter((l) => !l.includes('/02/2026'))
        .join('\n')
        .replaceAll('2026', '2025'),
      'latin1',
    );

  beforeAll(async () => {
    const { confirmar } = await importar(tokenGestor, so2025Janeiro());
    expect(confirmar.json()).toMatchObject({ ano: 2025, dias: 4 });
  });

  it('lista os anos importados (mais recente primeiro)', async () => {
    expect((await req('GET', '/api/faturamento/anos', tokenGestor)).json()).toEqual([2026, 2025]);
  });

  it('mês a mês de um ano escolhido', async () => {
    const b = (await req('GET', '/api/faturamento/mensal?ano=2025', tokenGestor)).json();
    expect(b.ano).toBe(2025);
    expect(b.meses).toEqual([
      {
        mes: 1,
        dias: 4,
        bruto: '4500.50',
        antecipado: '-300.00',
        remessa: '250.00',
        devolucao: '-50.25',
        dre: '4400.25',
      },
    ]);
    expect(b.total.dre).toBe('4400.25');
    const vazio = (await req('GET', '/api/faturamento/mensal?ano=2024', tokenGestor)).json();
    expect(vazio).toMatchObject({ ano: 2024, meses: [], total: { dre: '0.00' } });
  });

  it('comparativo: diferença e variação por mês, no ano todo e só nos meses em comum', async () => {
    const r = await req('GET', '/api/faturamento/comparativo?anoA=2025&anoB=2026', tokenGestor);
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(
      b.meses.map((m: { mes: number; temA: boolean; temB: boolean }) => [m.mes, m.temA, m.temB]),
    ).toEqual([
      [1, true, true],
      [2, false, true],
    ]);
    expect(b.meses[0]).toMatchObject({
      a: { dre: '4400.25' },
      b: { dre: '4400.25' },
      diferenca: { dre: '0.00' },
    });
    expect(b.meses[0].pct.dre).toBe(0);
    expect(b.meses[1]).toMatchObject({
      a: { dre: '0.00' },
      b: { dre: '3400.00' },
      diferenca: { dre: '3400.00' },
    });
    expect(b.meses[1].pct.dre).toBeNull();
    // Ano todo: 7800,25 vs. 4400,25 → +3400,00 (+77,27%).
    expect(b.total).toMatchObject({
      a: { dre: '4400.25' },
      b: { dre: '7800.25' },
      diferenca: { dre: '3400.00' },
    });
    expect(b.total.pct.dre).toBeCloseTo(3400 / 4400.25, 10);
    // Meses em comum: só janeiro.
    expect(b.emComum).toMatchObject({ meses: [1], a: { dre: '4400.25' }, b: { dre: '4400.25' } });
    expect(b.emComum.pct.dre).toBe(0);
  });

  it('comparativo só com os meses escolhidos: linhas e totais restritos a eles', async () => {
    const b = (
      await req('GET', '/api/faturamento/comparativo?anoA=2025&anoB=2026&meses=2', tokenGestor)
    ).json();
    expect(b.mesesDisponiveis).toEqual([1, 2]);
    expect(b).toMatchObject({ mesesA: [1], mesesB: [1, 2] });
    expect(b.meses.map((m: { mes: number }) => m.mes)).toEqual([2]);
    expect(b.total).toMatchObject({ a: { dre: '0.00' }, b: { dre: '3400.00' } });
    expect(b.emComum).toMatchObject({ meses: [], a: { dre: '0.00' }, b: { dre: '0.00' } });

    const jan = (
      await req('GET', '/api/faturamento/comparativo?anoA=2025&anoB=2026&meses=1', tokenGestor)
    ).json();
    expect(jan.total).toMatchObject({
      a: { dre: '4400.25' },
      b: { dre: '4400.25' },
      diferenca: { dre: '0.00' },
    });
  });

  it('meses inválidos no comparativo: 400', async () => {
    for (const meses of ['13', '0', 'jan', '1,,2']) {
      const r = await req(
        'GET',
        `/api/faturamento/comparativo?anoA=2025&anoB=2026&meses=${meses}`,
        tokenGestor,
      );
      expect(r.statusCode, meses).toBe(400);
    }
  });

  it('comparativo com o mesmo ano ou ano inválido: 400', async () => {
    expect(
      (await req('GET', '/api/faturamento/comparativo?anoA=2026&anoB=2026', tokenGestor)).statusCode,
    ).toBe(400);
    expect(
      (await req('GET', '/api/faturamento/comparativo?anoA=abc&anoB=2026', tokenGestor)).statusCode,
    ).toBe(400);
  });
});

describe('faturamento — manual (Administração › Histórico)', () => {
  const salvar = (ano: number, meses: { mes: number; valor: string | null }[], token = tokenGestor) =>
    req('PUT', '/api/historico/faturamento', token, { payload: { ano, meses } });

  it('grava, lista e marca os meses que já têm faturamento importado', async () => {
    const r = await salvar(2026, [
      { mes: 2, valor: '9.999,99' },
      { mes: 3, valor: '1.000,00' },
    ]);
    expect(r.statusCode).toBe(200);
    const meses = (await req('GET', '/api/historico/faturamento?ano=2026', tokenGestor)).json();
    expect(meses.slice(0, 4)).toEqual([
      { mes: 1, valor: null, temImportado: true },
      { mes: 2, valor: '9999.99', temImportado: true },
      { mes: 3, valor: '1000.00', temImportado: false },
      { mes: 4, valor: null, temImportado: false },
    ]);
  });

  it('entra como DRE só nos meses sem faturamento importado (resumo)', async () => {
    const b = (await req('GET', '/api/faturamento/resumo?de=2026-01&ate=2026-03', tokenGestor)).json();
    // 7.800,25 importados (jan + fev; o manual de fev é ignorado) + 1.000,00 manual de março.
    expect(b.kpis.dre.valor).toBe('8800.25');
    expect(b.kpis.bruto.valor).toBe('8000.60');
    expect(b.mensal.meses.map((m: { mes: number; dre: string }) => [m.mes, m.dre])).toEqual([
      [1, '4400.25'],
      [2, '3400.00'],
      [3, '1000.00'],
    ]);
    expect(b.mensal.total.dre).toBe('8800.25');
    // Sem período: vai até o último mês com faturamento, importado ou manual.
    expect((await req('GET', '/api/faturamento/resumo', tokenGestor)).json().periodo).toEqual({
      de: '2026-01',
      ate: '2026-03',
    });
  });

  it('ano só com valores manuais aparece em anos, mês a mês e comparativo', async () => {
    await salvar(2024, [{ mes: 1, valor: '500,00' }]);
    expect((await req('GET', '/api/faturamento/anos', tokenGestor)).json()).toEqual([2026, 2025, 2024]);
    const m = (await req('GET', '/api/faturamento/mensal?ano=2024', tokenGestor)).json();
    expect(m.meses).toEqual([
      {
        mes: 1,
        dias: 0,
        bruto: '0.00',
        antecipado: '0.00',
        remessa: '0.00',
        devolucao: '0.00',
        dre: '500.00',
      },
    ]);
    const c = (await req('GET', '/api/faturamento/comparativo?anoA=2024&anoB=2025', tokenGestor)).json();
    expect(c.total.diferenca.dre).toBe('3900.25');
  });

  it('valor null apaga o mês', async () => {
    await salvar(2024, [{ mes: 1, valor: null }]);
    expect((await req('GET', '/api/faturamento/anos', tokenGestor)).json()).toEqual([2026, 2025]);
  });

  it('valor inválido: 400', async () => {
    expect((await salvar(2026, [{ mes: 3, valor: 'abc' }])).statusCode).toBe(400);
    expect((await salvar(2026, [{ mes: 13, valor: '1,00' }])).statusCode).toBe(400);
  });

  it('sem a permissão ou com escopo parcial: 403', async () => {
    const rep = (await login(ctx.app, 'rep@meta.com')).body.accessToken;
    const parcial = (await login(ctx.app, 'gestor-parcial@meta.com')).body.accessToken;
    for (const t of [rep, parcial]) {
      expect((await req('GET', '/api/historico/faturamento?ano=2026', t)).statusCode).toBe(403);
      expect((await salvar(2026, [{ mes: 3, valor: '1,00' }], t)).statusCode).toBe(403);
    }
  });
});
