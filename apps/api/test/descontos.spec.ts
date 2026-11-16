import fs from 'node:fs';
import path from 'node:path';
import { analiseDescontosQuerySchema } from '@metabi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Contexto, criarUsuario, iniciarApp, limparBanco, login } from './helpers.js';

const { PrintTokenService } = await import('../src/modules/export/print-token.service.js');
const { UsuarioLoader } = await import('../src/modules/auth/usuario-loader.service.js');

// Mesma amostra da análise de faturamento (dados fictícios), jan–fev/2026:
//   MT169 (MT169. + MT169) UN: qtd 3, R$ 1.500,00 (jan)
//   MT416 UN: qtd 4, R$ 450,00 — jan 3 un./R$ 300,00 + fev 1 un./R$ 150,00
//   ND1150 KG: qtd 1, R$ 50,00 (fev) — sem preço nos testes
// Preços 2026: MT169 = 600,00; MT416 = 125,50. Esperado (à mão):
//   tabela = 3×600 + 4×125,50 = 2.302,00; vendido com preço = 1.950,00; desconto = 352,00
//   MT169: 1.800 − 1.500 = 300 · MT416: 502 − 450 = 52
const AMOSTRA = path.resolve(import.meta.dirname, '../../../fixtures/faturamento/amostras/notas-amostra.csv');
let ctx: Contexto;
let tokenAdmin: string;
let tokenGestor: string;
let adminId: string;

type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE';
const req = (method: Metodo, url: string, token: string, extra: object = {}) =>
  ctx.app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...extra });
type Linha = { codigo: string };
const linha = <T extends Linha>(ls: T[], codigo: string) => ls.find((l) => l.codigo === codigo)!;

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
  req('PUT', '/api/precos', token, { payload: { ano, precos } });
const analise = async (qs = '') => (await req('GET', `/api/descontos${qs}`, tokenAdmin)).json();

beforeAll(async () => {
  ctx = await iniciarApp();
  await limparBanco(ctx.prisma);
  adminId = (await criarUsuario(ctx.prisma, { email: 'admin@meta.com', papel: 'admin' })).id;
  await criarUsuario(ctx.prisma, { email: 'gestor@meta.com', papel: 'gestor-comercial' });
  tokenAdmin = (await login(ctx.app, 'admin@meta.com')).body.accessToken;
  tokenGestor = (await login(ctx.app, 'gestor@meta.com')).body.accessToken;
  await importarAmostra(tokenAdmin);
});

afterAll(async () => {
  await ctx.app.close();
});

describe('análise de descontos', () => {
  it('sem preços: período padrão do ano, produtos pelo vendido e nenhum desconto', async () => {
    const r = await req('GET', '/api/descontos', tokenGestor);
    expect(r.statusCode).toBe(200);
    const d = r.json();
    expect(d.periodo).toEqual({ de: '2026-01', ate: '2026-02' });
    expect(d.temDados).toBe(true);
    expect(d.resumo).toMatchObject({
      vendidoTotal: '2000.00',
      vendidoComPreco: '0.00',
      desconto: '0.00',
      cobertura: 0,
      produtos: 3,
      produtosComPreco: 0,
    });
    expect(d.produtos.map((p: Linha) => p.codigo)).toEqual(['MT169', 'MT416', 'ND1150']);
    expect(d.produtos[0]).toMatchObject({
      unidade: 'UN',
      quantidade: '3.00',
      vendido: '1500.00',
      preco: null,
    });
  });

  it('com preços: desconto total e por produto (maior desconto primeiro, sem preço no fim)', async () => {
    const s = await salvar(tokenAdmin, 2026, [
      { produtoCodigo: 'MT169', unidade: 'UN', preco: '600,00' },
      { produtoCodigo: 'MT416', unidade: 'UN', preco: '125.5' },
    ]);
    expect(s.statusCode).toBe(200);
    const d = await analise();
    expect(d.resumo).toMatchObject({
      vendidoTotal: '2000.00',
      vendidoComPreco: '1950.00',
      valorTabela: '2302.00',
      desconto: '352.00',
      cobertura: 0.975,
      produtosComPreco: 2,
    });
    expect(d.produtos.map((p: Linha) => p.codigo)).toEqual(['MT169', 'MT416', 'ND1150']);
    const mt169 = linha(d.produtos, 'MT169');
    expect(mt169).toMatchObject({
      preco: '600',
      valorTabela: '1800.00',
      desconto: '300.00',
      precoParcial: false,
    });
    expect((mt169 as Linha & { percentual: number }).percentual).toBeCloseTo(300 / 1800, 6);
    expect(linha(d.produtos, 'MT416')).toMatchObject({ valorTabela: '502.00', desconto: '52.00' });
    expect(linha(d.produtos, 'ND1150')).toMatchObject({ preco: null, valorTabela: null, desconto: null });
  });

  it('respeita o período: só fevereiro', async () => {
    const d = await analise('?de=2026-02&ate=2026-02');
    expect(d.periodo).toEqual({ de: '2026-02', ate: '2026-02' });
    expect(d.produtos.map((p: Linha) => p.codigo)).toEqual(['MT416', 'ND1150']);
    // 1 × 125,50 − 150,00: vendido acima da tabela → desconto negativo.
    expect(linha(d.produtos, 'MT416')).toMatchObject({ valorTabela: '125.50', desconto: '-24.50' });
  });

  it('período que cruza anos: cada mês usa a tabela do seu ano; sem preço único por produto', async () => {
    // 2025 com outro preço não muda nada: não há vendas em 2025.
    expect(
      (await salvar(tokenAdmin, 2025, [{ produtoCodigo: 'MT169', unidade: 'UN', preco: '500' }])).statusCode,
    ).toBe(200);
    const d = await analise('?de=2025-11&ate=2026-02');
    expect(d.resumo).toMatchObject({ valorTabela: '2302.00', desconto: '352.00' });
    expect(linha(d.produtos, 'MT169')).toMatchObject({ preco: null, valorTabela: '1800.00' });
  });

  it('produto sem preço sai do cálculo (e a cobertura cai)', async () => {
    await salvar(tokenAdmin, 2026, [{ produtoCodigo: 'MT416', unidade: 'UN', preco: null }]);
    const d = await analise();
    expect(linha(d.produtos, 'MT416')).toMatchObject({ valorTabela: null, desconto: null });
    expect(d.resumo).toMatchObject({ vendidoComPreco: '1500.00', desconto: '300.00', cobertura: 0.75 });
    await salvar(tokenAdmin, 2026, [{ produtoCodigo: 'MT416', unidade: 'UN', preco: '125,50' }]);
  });

  it('período inválido: 400', async () => {
    expect((await req('GET', '/api/descontos?de=2026-05&ate=2026-01', tokenAdmin)).statusCode).toBe(400);
  });
});

describe('tabela de preços', () => {
  it('lista os produtos das notas com última venda, preço do ano e do ano anterior', async () => {
    const r = await req('GET', '/api/precos?ano=2026', tokenAdmin);
    expect(r.statusCode).toBe(200);
    const t = r.json();
    // Salvar preço num ano inclui o ano na lista.
    expect(t.anos).toEqual([
      { ano: 2026, precos: 2 },
      { ano: 2025, precos: 1 },
    ]);
    expect(t.produtos.map((p: Linha) => p.codigo)).toEqual(['MT169', 'MT416', 'ND1150']);
    expect(linha(t.produtos, 'MT169')).toMatchObject({
      descricao: 'CAMA EXEMPLO MT169',
      unidade: 'UN',
      manual: false,
      ultimaVenda: '2026-01-05',
      preco: '600',
      precoAnoAnterior: '500',
    });
  });

  it('ano sem preços ainda: lista os mesmos produtos para preencher', async () => {
    const t = (await req('GET', '/api/precos?ano=2027', tokenAdmin)).json();
    expect(t.produtos).toHaveLength(3);
    expect(linha(t.produtos, 'MT169')).toMatchObject({ preco: null, precoAnoAnterior: '600' });
  });

  it('cada ano tem sua tabela: mudar 2027 não altera 2026', async () => {
    await salvar(tokenAdmin, 2027, [{ produtoCodigo: 'MT169', unidade: 'UN', preco: '700' }]);
    expect((await analise()).resumo.valorTabela).toBe('2302.00');
  });

  it('inclui produto à mão (sem nota), com preço, e exclui com os preços', async () => {
    const r = await req('POST', '/api/precos/produtos', tokenAdmin, {
      payload: { codigo: 'MT900.', descricao: 'CAMA NOVA', unidade: 'un' },
    });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toEqual({ codigo: 'MT900', unidade: 'UN' });
    await salvar(tokenAdmin, 2026, [{ produtoCodigo: 'MT900', unidade: 'UN', preco: '999' }]);
    const t = (await req('GET', '/api/precos?ano=2026', tokenAdmin)).json();
    expect(linha(t.produtos, 'MT900')).toMatchObject({
      descricao: 'CAMA NOVA',
      manual: true,
      ultimaVenda: null,
      preco: '999',
    });
    // Sem venda, não muda a análise.
    expect((await analise()).resumo.produtos).toBe(3);

    const del = await req('DELETE', '/api/precos/produtos?codigo=MT900&unidade=UN', tokenAdmin);
    expect(del.statusCode).toBe(204);
    expect(await ctx.prisma.precoTabela.count({ where: { produtoCodigo: 'MT900' } })).toBe(0);
    const depois = (await req('GET', '/api/precos?ano=2026', tokenAdmin)).json();
    expect(depois.produtos.some((p: Linha) => p.codigo === 'MT900')).toBe(false);
  });

  it('não inclui produto repetido nem um que já está nas notas (409); não exclui produto das notas (404)', async () => {
    const incluir = (codigo: string, unidade: string) =>
      req('POST', '/api/precos/produtos', tokenAdmin, { payload: { codigo, descricao: 'X', unidade } });
    expect((await incluir('MT169', 'UN')).statusCode).toBe(409);
    expect((await incluir('PX1', '')).statusCode).toBe(201);
    expect((await incluir('PX1', '')).statusCode).toBe(409);
    expect((await req('DELETE', '/api/precos/produtos?codigo=MT169&unidade=UN', tokenAdmin)).statusCode).toBe(
      404,
    );
    expect((await req('DELETE', '/api/precos/produtos?codigo=PX1', tokenAdmin)).statusCode).toBe(204);
  });

  it('preço null apaga só aquele produto/ano', async () => {
    await salvar(tokenAdmin, 2027, [{ produtoCodigo: 'MT169', unidade: 'UN', preco: null }]);
    expect(await ctx.prisma.precoTabela.count({ where: { produtoCodigo: 'MT169' } })).toBe(2); // 2025 e 2026
  });

  it('valida preço, ano e produto', async () => {
    expect(
      (await salvar(tokenAdmin, 2026, [{ produtoCodigo: 'MT169', unidade: 'UN', preco: '-1' }])).statusCode,
    ).toBe(400);
    expect((await req('GET', '/api/precos?ano=1999', tokenAdmin)).statusCode).toBe(400);
    expect(
      (
        await req('POST', '/api/precos/produtos', tokenAdmin, {
          payload: { codigo: '', descricao: '', unidade: '' },
        })
      ).statusCode,
    ).toBe(400);
  });

  it('inclui ano vazio ou copiando os preços de outro ano; não repete ano (409)', async () => {
    const vazio = await req('POST', '/api/precos/anos', tokenAdmin, { payload: { ano: 2030 } });
    expect(vazio.statusCode).toBe(201);
    expect(vazio.json().anos[0]).toEqual({ ano: 2030, precos: 0 });

    const copia = await req('POST', '/api/precos/anos', tokenAdmin, {
      payload: { ano: 2031, copiarDe: 2026 },
    });
    expect(copia.statusCode).toBe(201);
    const t = copia.json();
    expect(t.ano).toBe(2031);
    expect(linha(t.produtos, 'MT169')).toMatchObject({ preco: '600' });
    expect(linha(t.produtos, 'MT416')).toMatchObject({ preco: '125.5' });
    // A cópia é independente: mudar 2031 não mexe em 2026.
    await salvar(tokenAdmin, 2031, [{ produtoCodigo: 'MT169', unidade: 'UN', preco: '1' }]);
    expect((await analise()).resumo.valorTabela).toBe('2302.00');

    expect((await req('POST', '/api/precos/anos', tokenAdmin, { payload: { ano: 2030 } })).statusCode).toBe(
      409,
    );
    expect((await req('POST', '/api/precos/anos', tokenAdmin, { payload: { ano: 1990 } })).statusCode).toBe(
      400,
    );
  });

  it('retirar ano apaga só os preços dele e tira da lista', async () => {
    expect((await req('DELETE', '/api/precos/anos/2031', tokenAdmin)).statusCode).toBe(204);
    expect(await ctx.prisma.precoTabela.count({ where: { ano: 2031 } })).toBe(0);
    expect(await ctx.prisma.precoTabela.count({ where: { ano: 2026 } })).toBe(2);
    const t = (await req('GET', '/api/precos?ano=2026', tokenAdmin)).json();
    expect(t.anos.map((a: { ano: number }) => a.ano)).not.toContain(2031);
    expect((await req('DELETE', '/api/precos/anos/2031', tokenAdmin)).statusCode).toBe(404);
    expect((await req('DELETE', '/api/precos/anos/2030', tokenAdmin)).statusCode).toBe(204);
  });

  it('gestor comercial não inclui nem retira ano', async () => {
    expect((await req('POST', '/api/precos/anos', tokenGestor, { payload: { ano: 2040 } })).statusCode).toBe(
      403,
    );
    expect((await req('DELETE', '/api/precos/anos/2026', tokenGestor)).statusCode).toBe(403);
  });

  it('alterações ficam na auditoria', async () => {
    for (const acao of [
      'precos.alterados',
      'produto.incluido',
      'produto.excluido',
      'precos.ano-incluido',
      'precos.ano-excluido',
    ]) {
      expect(await ctx.prisma.auditLog.count({ where: { acao } }), acao).toBeGreaterThan(0);
    }
  });
});

describe('relatórios da análise de descontos', () => {
  it('CSV: uma linha por produto, com total', async () => {
    const r = await req('GET', '/api/export/descontos?formato=csv&de=2026-01&ate=2026-02', tokenAdmin);
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-disposition']).toContain('metabi-analise-descontos-2026-01_2026-02.csv');
    const linhas = r.body.replace(/^\uFEFF/, '').split('\r\n');
    expect(linhas[0]).toContain('Código;Descrição');
    expect(linhas[1]).toContain('MT169');
    expect(linhas.at(-1)).toContain('Total');
    expect(linhas.at(-1)).toContain('352');
  });

  it('Excel: arquivo .xlsx', async () => {
    const r = await req('GET', '/api/export/descontos?formato=xlsx', tokenAdmin);
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('spreadsheetml');
    expect(r.rawPayload.subarray(0, 2).toString()).toBe('PK');
  });

  it('PDF: o token de impressão traz a análise do período pedido (uso único)', async () => {
    const u = await ctx.app.get(UsuarioLoader).carregarAtivo(adminId);
    const token = await ctx.app.get(PrintTokenService).criar(u!, {
      tipo: 'analise-descontos',
      params: analiseDescontosQuerySchema.parse({ de: '2026-01', ate: '2026-02' }),
      secoes: ['produtos'],
    });
    const ler = () => ctx.app.inject({ method: 'GET', url: `/api/print/analise-descontos?token=${token}` });
    const r = await ler();
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      secoes: ['produtos'],
      params: { de: '2026-01', ate: '2026-02' },
      analise: { resumo: { desconto: '352.00' } },
    });
    expect((await ler()).statusCode).toBe(401);
  });

  it('quem não vê descontos não exporta', async () => {
    await criarUsuario(ctx.prisma, { email: 'diretoria-sem@meta.com', papel: 'visualizador' });
    const t = (await login(ctx.app, 'diretoria-sem@meta.com')).body.accessToken;
    expect((await req('GET', '/api/export/descontos?formato=csv', t)).statusCode).toBe(403);
    expect((await req('GET', '/api/export/pdf/analise-descontos', t)).statusCode).toBe(403);
  });
});

describe('acesso', () => {
  it('gestor comercial vê a análise, mas não a tabela de preços', async () => {
    expect((await req('GET', '/api/descontos', tokenGestor)).statusCode).toBe(200);
    expect((await req('GET', '/api/precos?ano=2026', tokenGestor)).statusCode).toBe(403);
    expect(
      (await salvar(tokenGestor, 2026, [{ produtoCodigo: 'MT169', unidade: 'UN', preco: '1' }])).statusCode,
    ).toBe(403);
    const incluir = await req('POST', '/api/precos/produtos', tokenGestor, {
      payload: { codigo: 'Z1', descricao: 'Z', unidade: '' },
    });
    expect(incluir.statusCode).toBe(403);
  });

  it('representante e visualizador não veem', async () => {
    for (const papel of ['representante', 'visualizador'] as const) {
      await criarUsuario(ctx.prisma, { email: `${papel}@meta.com`, papel });
      const t = (await login(ctx.app, `${papel}@meta.com`)).body.accessToken;
      expect((await req('GET', '/api/descontos', t)).statusCode).toBe(403);
      expect((await req('GET', '/api/precos?ano=2026', t)).statusCode).toBe(403);
    }
  });

  it('com a permissão mas escopo parcial recebe 403', async () => {
    const u = await criarUsuario(ctx.prisma, { email: 'parcial@meta.com', papel: 'admin' });
    await ctx.prisma.usuario.update({ where: { id: u.id }, data: { escopoTipo: 'REPRESENTANTES' } });
    const t = (await login(ctx.app, 'parcial@meta.com')).body.accessToken;
    expect((await req('GET', '/api/descontos', t)).statusCode).toBe(403);
    expect((await req('GET', '/api/precos?ano=2026', t)).statusCode).toBe(403);
    expect((await salvar(t, 2026, [{ produtoCodigo: 'MT169', unidade: 'UN', preco: '1' }])).statusCode).toBe(
      403,
    );
  });

  it('sem login recebe 401', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/api/descontos' })).statusCode).toBe(401);
    expect((await ctx.app.inject({ method: 'GET', url: '/api/precos?ano=2026' })).statusCode).toBe(401);
  });
});
