import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { type Contexto, criarUsuario, iniciarApp, limparBanco, login } from './helpers.js';

// Gráficos e séries da Visão geral mostram só os meses do período escolhido (de..ate).
const AMOSTRA = path.resolve(import.meta.dirname, '../../../fixtures/focco/amostras/amostra-anonimizada.xls');
let ctx: Contexto;
let token: string;

const visao = async (qs: string) =>
  (
    await ctx.app.inject({
      method: 'GET',
      url: `/api/dashboard/visao-geral?${qs}`,
      headers: { authorization: `Bearer ${token}` },
    })
  ).json();

beforeAll(async () => {
  ctx = await iniciarApp();
  await limparBanco(ctx.prisma);
  await criarUsuario(ctx.prisma, { email: 'gestor@meta.com', papel: 'gestor-comercial' });
  token = (await login(ctx.app, 'gestor@meta.com')).body.accessToken;

  const b = '----periodo';
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
  await ctx.app.inject({
    method: 'POST',
    url: '/api/import/confirmar',
    headers: h,
    payload: { hash: p.hash, arquivoNome: 'a.xls' },
  });
  // Metas da empresa em fevereiro (fora do período testado) e em abril (dentro).
  await ctx.prisma.meta.createMany({
    data: [
      { ano: 2026, mes: 2, representanteId: null, valor: new Prisma.Decimal(1000) },
      { ano: 2026, mes: 4, representanteId: null, valor: new Prisma.Decimal(2000) },
    ],
  });
});

afterAll(async () => {
  await ctx.app.close();
});

describe('Visão geral: gráficos só com os meses do período', () => {
  it('mar–mai: evolução, minigráficos e atingimento só de março a maio', async () => {
    const v = await visao('de=2026-03&ate=2026-05');
    const meses = ['2026-03', '2026-04', '2026-05'];
    expect(v.evolucao.meses.map((m: { mes: string }) => m.mes)).toEqual(meses);
    expect(v.kpis.total.serie.map((s: { mes: string }) => s.mes)).toEqual(meses);
    expect(v.kpis.qtd.serie.map((s: { mes: string }) => s.mes)).toEqual(meses);
    expect(v.kpis.pctPublico.serie.map((s: { mes: string }) => s.mes)).toEqual(meses);
    // A soma do gráfico bate com o card de total vendido.
    const soma = v.evolucao.meses.reduce(
      (t: Prisma.Decimal, m: { real: string }) => t.plus(m.real),
      new Prisma.Decimal(0),
    );
    expect(soma.toFixed(2)).toBe(v.kpis.total.valor);
    // Meta de fevereiro fica fora; só abril entra no atingimento.
    expect(v.evolucao.meses.map((m: { meta: string | null }) => m.meta)).toEqual([null, '2000.00', null]);
    expect(v.evolucao.atingimento).toMatchObject({
      mesInicial: '2026-04',
      mesFinal: '2026-04',
      meta: '2000.00',
    });
  });

  it('período cruzando o ano: dez/2025–jan/2026', async () => {
    const v = await visao('de=2025-12&ate=2026-01');
    expect(v.evolucao.meses.map((m: { mes: string }) => m.mes)).toEqual(['2025-12', '2026-01']);
    expect(v.kpis.total.serie.map((s: { mes: string }) => s.mes)).toEqual(['2025-12', '2026-01']);
  });

  it('um mês só: um ponto em cada série', async () => {
    const v = await visao('de=2026-04&ate=2026-04');
    expect(v.evolucao.meses).toHaveLength(1);
    expect(v.kpis.total.serie).toHaveLength(1);
    expect(v.evolucao.meses[0].real).toBe(v.kpis.total.valor);
  });
});
