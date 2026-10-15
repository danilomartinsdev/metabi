import { analiseNotasQuerySchema, faturamentoPdfQuerySchema, filtrosSchema } from '@meta-bi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Contexto, criarUsuario, iniciarApp, limparBanco, login } from './helpers.js';

const { PrintTokenService } = await import('../src/modules/export/print-token.service.js');
const { UsuarioLoader } = await import('../src/modules/auth/usuario-loader.service.js');

let ctx: Contexto;
let usuarioId: string;
let tokens: InstanceType<typeof PrintTokenService>;

const ler = (pagina: 'relatorio' | 'faturamento' | 'analise-faturamento', token: string) =>
  ctx.app.inject({ method: 'GET', url: `/api/print/${pagina}?token=${encodeURIComponent(token)}` });
const relatorio = (token: string) => ler('relatorio', token);

async function novoToken(agora?: Date) {
  const u = await ctx.app.get(UsuarioLoader).carregarAtivo(usuarioId);
  return tokens.criar(
    u!,
    { tipo: 'vendas', filtros: filtrosSchema.parse({ de: '2026-01', ate: '2026-03' }) },
    agora,
  );
}

async function tokenFaturamento(id = usuarioId) {
  const u = await ctx.app.get(UsuarioLoader).carregarAtivo(id);
  const params = faturamentoPdfQuerySchema.parse({
    de: '2026-01',
    ate: '2026-03',
    anoA: '2025',
    anoB: '2026',
    meses: '1,2',
  });
  return tokens.criar(u!, { tipo: 'faturamento', params });
}

async function tokenAnalise(id = usuarioId) {
  const u = await ctx.app.get(UsuarioLoader).carregarAtivo(id);
  const params = analiseNotasQuerySchema.parse({ de: '2026-01', ate: '2026-03' });
  return tokens.criar(u!, { tipo: 'analise-faturamento', params });
}

beforeAll(async () => {
  ctx = await iniciarApp();
  await limparBanco(ctx.prisma);
  usuarioId = (await criarUsuario(ctx.prisma, { email: 'gestor@meta.com', papel: 'gestor-comercial' })).id;
  tokens = ctx.app.get(PrintTokenService);
});

afterAll(async () => {
  await ctx.app.close();
});

describe('token de impressão do PDF (banco, uso único)', () => {
  it('o token vale uma vez e traz o usuário e os filtros de quem pediu', async () => {
    const token = await novoToken();
    const r = await relatorio(token);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      geradoPor: expect.any(String),
      filtros: { de: '2026-01', ate: '2026-03' },
    });
    // Só o hash fica no banco.
    expect(await ctx.prisma.tokenImpressao.count({ where: { tokenHash: token } })).toBe(0);
    expect((await relatorio(token)).statusCode).toBe(401);
  });

  it('token expirado é recusado', async () => {
    const token = await novoToken(new Date(Date.now() - 2 * 60_000));
    expect((await relatorio(token)).statusCode).toBe(401);
  });

  it('usuário desativado depois de pedir o PDF não consegue ler os dados', async () => {
    const token = await novoToken();
    await ctx.prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: false } });
    expect((await relatorio(token)).statusCode).toBe(401);
    await ctx.prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: true } });
  });

  it('token inventado é recusado', async () => {
    expect((await relatorio('a'.repeat(43))).statusCode).toBe(401);
  });
});

describe('PDF de faturamento', () => {
  it('token de faturamento traz resumo, mês a mês e o comparativo pedido', async () => {
    const r = await ler('faturamento', await tokenFaturamento());
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.params).toMatchObject({ de: '2026-01', ate: '2026-03', anoA: 2025, anoB: 2026, meses: [1, 2] });
    expect(b.resumo.periodo).toEqual({ de: '2026-01', ate: '2026-03' });
    expect(b.mensal.ano).toBe(2026);
    expect(b.comparativo).toMatchObject({ anoA: 2025, anoB: 2026 });
  });

  it('um token só abre o relatório do seu tipo', async () => {
    expect((await ler('faturamento', await novoToken())).statusCode).toBe(401);
    expect((await ler('relatorio', await tokenFaturamento())).statusCode).toBe(401);
  });

  it('quem não vê faturamento: 403 ao pedir o PDF e ao ler os dados', async () => {
    const rep = await criarUsuario(ctx.prisma, { email: 'rep@meta.com', papel: 'representante' });
    const t = (await login(ctx.app, 'rep@meta.com')).body.accessToken;
    const pedir = await ctx.app.inject({
      method: 'GET',
      url: '/api/export/pdf/faturamento',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(pedir.statusCode).toBe(403);
    expect((await ler('faturamento', await tokenFaturamento(rep.id))).statusCode).toBe(403);
  });

  it('parâmetros inválidos do PDF de faturamento: 400', async () => {
    const t = (await login(ctx.app, 'gestor@meta.com')).body.accessToken;
    for (const qs of ['anoA=2025', 'anoA=2026&anoB=2026', 'de=2026-05&ate=2026-01', 'indicador=lucro']) {
      const r = await ctx.app.inject({
        method: 'GET',
        url: `/api/export/pdf/faturamento?${qs}`,
        headers: { authorization: `Bearer ${t}` },
      });
      expect(r.statusCode, qs).toBe(400);
    }
  });
});

describe('PDF da Análise de faturamento', () => {
  it('token da análise traz o período pedido e a análise das notas', async () => {
    const r = await ler('analise-faturamento', await tokenAnalise());
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.params).toEqual({ de: '2026-01', ate: '2026-03' });
    expect(b.analise.periodo).toEqual({ de: '2026-01', ate: '2026-03' });
    expect(b.analise).toMatchObject({ temDados: false, divisoes: [], representantes: [] });
  });

  it('um token só abre o relatório do seu tipo', async () => {
    expect((await ler('analise-faturamento', await tokenFaturamento())).statusCode).toBe(401);
    expect((await ler('faturamento', await tokenAnalise())).statusCode).toBe(401);
  });

  it('quem não vê a análise: 403 ao pedir o PDF e ao ler os dados', async () => {
    const rep = await criarUsuario(ctx.prisma, { email: 'rep-analise@meta.com', papel: 'representante' });
    const t = (await login(ctx.app, 'rep-analise@meta.com')).body.accessToken;
    const pedir = await ctx.app.inject({
      method: 'GET',
      url: '/api/export/pdf/analise-faturamento',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(pedir.statusCode).toBe(403);
    expect((await ler('analise-faturamento', await tokenAnalise(rep.id))).statusCode).toBe(403);
  });

  it('período inválido no PDF da análise: 400', async () => {
    const t = (await login(ctx.app, 'gestor@meta.com')).body.accessToken;
    for (const qs of ['de=2026-05&ate=2026-01', 'de=2026-13']) {
      const r = await ctx.app.inject({
        method: 'GET',
        url: `/api/export/pdf/analise-faturamento?${qs}`,
        headers: { authorization: `Bearer ${t}` },
      });
      expect(r.statusCode, qs).toBe(400);
    }
  });
});
