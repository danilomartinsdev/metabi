import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AnaliseNotas,
  type AnaliseNotasQuery,
  COLUNAS_NOTAS,
  codigoProdutoAgrupado,
  curvaAbc,
  descricaoProdutoAgrupada,
  type ErroLinha,
  type LinhaNota,
  type LoteNotas,
  linhaNotaSchema,
  type PreviaNotas,
} from '@metabi/shared';
import type { ContextoRequisicao, UsuarioAutenticado } from '../../common/auth/types.js';
import { ApiException } from '../../common/errors.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ArquivosTemporariosService } from '../arquivos/arquivos-temporarios.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ArquivoInvalidoError, extrairLinhas, lerMatriz } from '../import/parser.js';

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`;
const dataMes = (m: string) => new Date(`${m}-01T00:00:00Z`);
/** Último dia do mês "AAAA-MM" (UTC). */
const fimMes = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0));
const fracao = (v: Decimal, total: Decimal) => (total.isZero() ? 0 : v.div(total).toNumber());

interface Analise {
  previa: PreviaNotas;
  validas: LinhaNota[];
  meses: string[];
}

/**
 * Notas fiscais (itens de NF do Focco): base da análise de faturamento por divisão, representante,
 * cliente e produto. Como o faturamento, é um número da empresa inteira — o controller exige escopo
 * "todos"; os representantes das notas não estão ligados ao cadastro de representantes dos pedidos.
 */
@Injectable()
export class NotasFiscaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly arquivos: ArquivosTemporariosService,
  ) {}

  async previa(buf: Buffer, arquivoNome: string, usuarioId: string): Promise<PreviaNotas> {
    const hash = createHash('sha256').update(buf).digest('hex');
    const { previa } = await this.analisar(buf, hash, arquivoNome);
    await this.arquivos.guardar('notas', hash, usuarioId, arquivoNome, buf);
    return previa;
  }

  private async analisar(buf: Buffer, hash: string, arquivoNome: string): Promise<Analise> {
    let brutas;
    try {
      brutas = extrairLinhas(lerMatriz(buf).matriz, COLUNAS_NOTAS);
    } catch (e) {
      const msg = e instanceof ArquivoInvalidoError ? e.message : 'Não foi possível ler o arquivo.';
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', msg);
    }

    const erros: ErroLinha[] = [];
    const validas: LinhaNota[] = [];
    const ids = new Set<number>();
    for (const b of brutas) {
      // Linhas de total/rodapé (sem item e sem nota) são ignoradas, não são erro.
      if (!b.itemId && !b.notaId) continue;
      const r = linhaNotaSchema.safeParse(b);
      if (!r.success) {
        erros.push({ linha: b.numeroLinha, mensagens: r.error.issues.map((i) => i.message) });
        continue;
      }
      if (ids.has(r.data.itemId)) {
        erros.push({ linha: b.numeroLinha, mensagens: [`ITNFS_ID ${r.data.itemId} repetido no arquivo`] });
        continue;
      }
      ids.add(r.data.itemId);
      validas.push(r.data);
    }

    const porMes = new Map<string, { itens: number; total: Decimal }>();
    for (const l of validas) {
      const k = l.dataEmissao.slice(0, 7);
      const m = porMes.get(k) ?? { itens: 0, total: new D(0) };
      m.itens++;
      m.total = m.total.plus(l.valorTotal);
      porMes.set(k, m);
    }
    const meses = [...porMes.keys()].sort();
    const existentes = meses.length
      ? await this.prisma.notaFiscalItem.groupBy({
          by: ['ano', 'mes'],
          where: { OR: meses.map((m) => ({ ano: Number(m.slice(0, 4)), mes: Number(m.slice(5, 7)) })) },
          _count: { _all: true },
          _sum: { valorTotal: true },
        })
      : [];
    const existente = new Map(existentes.map((e) => [chaveMes(e.ano, e.mes), e]));
    const total = validas.reduce((t, l) => t.plus(l.valorTotal), new D(0));

    return {
      validas,
      meses,
      previa: {
        hash,
        arquivoNome,
        itens: validas.length,
        notas: new Set(validas.map((l) => l.notaId)).size,
        total: total.toFixed(2),
        meses: meses.map((mes) => {
          const v = porMes.get(mes)!;
          const e = existente.get(mes);
          return {
            mes,
            itens: v.itens,
            total: v.total.toFixed(2),
            itensExistentes: e?._count._all ?? 0,
            totalExistente: (e?._sum.valorTotal ?? new D(0)).toFixed(2),
          };
        }),
        erros,
      },
    };
  }

  /** Grava o arquivo da prévia: cada mês de emissão do arquivo é substituído por completo. */
  async confirmar(hash: string, usuario: UsuarioAutenticado, ctx: ContextoRequisicao) {
    const { arquivoNome, conteudo: buf } = await this.arquivos.recuperar('notas', hash, usuario.id);
    const { previa, validas, meses } = await this.analisar(buf, hash, arquivoNome);
    if (!validas.length)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Nenhuma linha válida.');
    if (previa.erros.length) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION',
        `O arquivo tem ${previa.erros.length} linha(s) com erro. Corrija e envie de novo.`,
      );
    }
    const total = new D(previa.total);

    const lote = await this.prisma.$transaction(async (tx) => {
      const novo = await tx.notaFiscalLote.create({
        data: { arquivoNome, arquivoHash: hash, itens: validas.length, total, meses, usuarioId: usuario.id },
      });
      // Apaga os meses do arquivo e também os itens do arquivo que estavam gravados em outro mês
      // (nota com emissão corrigida), para o ITNFS_ID não repetir.
      const apagados = await tx.notaFiscalItem.deleteMany({
        where: {
          OR: [
            ...meses.map((m) => ({ ano: Number(m.slice(0, 4)), mes: Number(m.slice(5, 7)) })),
            { itemId: { in: validas.map((l) => l.itemId) } },
          ],
        },
      });
      await tx.notaFiscalItem.createMany({
        data: validas.map((l) => ({
          itemId: l.itemId,
          notaId: l.notaId,
          numNota: l.numNota,
          dataEmissao: new Date(`${l.dataEmissao}T00:00:00Z`),
          ano: Number(l.dataEmissao.slice(0, 4)),
          mes: Number(l.dataEmissao.slice(5, 7)),
          tipoNota: l.tipoNota,
          divisao: l.divisao,
          repCodigo: l.repCodigo,
          repNome: l.repNome,
          cliCodigo: l.cliCodigo,
          cliRazaoSocial: l.cliRazaoSocial,
          cliNomeFantasia: l.cliNomeFantasia,
          cliCidade: l.cliCidade,
          cliUf: l.cliUf,
          produtoCodigo: l.produtoCodigo,
          produtoAgrupado: codigoProdutoAgrupado(l.produtoCodigo),
          produtoDescricao: l.produtoDescricao,
          unidade: l.unidade,
          quantidade: new D(l.quantidade),
          valorTotal: new D(l.valorTotal),
          loteId: novo.id,
        })),
      });
      return { ...novo, substituidos: apagados.count };
    });

    await this.audit.registrar({
      acao: 'notas.importadas',
      usuarioId: usuario.id,
      entidade: 'NotaFiscalLote',
      entidadeId: lote.id,
      detalhes: { meses, itens: validas.length, substituidos: lote.substituidos, total: previa.total },
      ctx,
    });
    await this.arquivos.descartar('notas', hash, usuario.id);
    return { loteId: lote.id, meses, itens: validas.length, substituidos: lote.substituidos };
  }

  async lotes(): Promise<LoteNotas[]> {
    const ls = await this.prisma.notaFiscalLote.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { usuario: { select: { nome: true } } },
    });
    return ls.map((l) => ({
      id: l.id,
      arquivoNome: l.arquivoNome,
      itens: l.itens,
      total: l.total.toFixed(2),
      meses: l.meses,
      usuario: l.usuario?.nome ?? null,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  /**
   * Análise do período (padrão: do início do ano até o último mês com notas): faturamento por divisão
   * de venda, ranking de representantes e curvas ABC de clientes e de produtos (variantes agrupadas).
   */
  async analise(q: AnaliseNotasQuery): Promise<AnaliseNotas> {
    const ultimo = await this.prisma.notaFiscalItem.findFirst({
      orderBy: { dataEmissao: 'desc' },
      select: { dataEmissao: true },
    });
    const ate =
      q.ate ?? ultimo?.dataEmissao.toISOString().slice(0, 7) ?? new Date().toISOString().slice(0, 7);
    const de0 = q.de ?? `${ate.slice(0, 4)}-01`;
    const de = de0 > ate ? ate : de0;
    const where = { dataEmissao: { gte: dataMes(de), lte: fimMes(ate) } };

    const [
      porDivisao,
      notasDivisao,
      porRep,
      notasRep,
      clientesRep,
      porCliente,
      notasCliente,
      porProduto,
      notas,
      clientes,
      porDivRep,
      notasDivRep,
      clientesDivRep,
    ] = await Promise.all([
      this.prisma.notaFiscalItem.groupBy({ by: ['divisao'], where, _sum: { valorTotal: true } }),
      this.prisma.notaFiscalItem.groupBy({ by: ['divisao', 'notaId'], where }),
      this.prisma.notaFiscalItem.groupBy({ by: ['repCodigo'], where, _sum: { valorTotal: true } }),
      this.prisma.notaFiscalItem.groupBy({ by: ['repCodigo', 'notaId'], where }),
      this.prisma.notaFiscalItem.groupBy({ by: ['repCodigo', 'cliCodigo'], where }),
      this.prisma.notaFiscalItem.groupBy({ by: ['cliCodigo'], where, _sum: { valorTotal: true } }),
      this.prisma.notaFiscalItem.groupBy({ by: ['cliCodigo', 'notaId'], where }),
      this.prisma.notaFiscalItem.groupBy({
        by: ['produtoAgrupado', 'unidade'],
        where,
        _sum: { valorTotal: true, quantidade: true },
      }),
      this.prisma.notaFiscalItem.groupBy({ by: ['notaId'], where }),
      this.prisma.notaFiscalItem.groupBy({ by: ['cliCodigo'], where }),
      this.prisma.notaFiscalItem.groupBy({ by: ['divisao', 'repCodigo'], where, _sum: { valorTotal: true } }),
      this.prisma.notaFiscalItem.groupBy({ by: ['divisao', 'repCodigo', 'notaId'], where }),
      this.prisma.notaFiscalItem.groupBy({ by: ['divisao', 'repCodigo', 'cliCodigo'], where }),
    ]);

    const total = porDivisao.reduce((t, d) => t.plus(d._sum.valorTotal ?? 0), new D(0));
    const contar = <K extends string>(ls: Record<K, string | number>[], k: K) => {
      const m = new Map<string, number>();
      for (const l of ls) m.set(String(l[k]), (m.get(String(l[k])) ?? 0) + 1);
      return m;
    };
    const valor = (s: { valorTotal: Decimal | null }) => s.valorTotal ?? new D(0);
    const decrescente = <T extends { _sum: { valorTotal: Decimal | null } }>(ls: T[]) =>
      [...ls].sort((a, b) => valor(b._sum).cmp(valor(a._sum)));

    // Nomes: o mais recente de cada representante/cliente/produto no período.
    const [nomesRep, nomesCli, nomesProd] = await Promise.all([
      this.prisma.notaFiscalItem.findMany({
        where,
        distinct: ['repCodigo'],
        orderBy: [{ repCodigo: 'asc' }, { dataEmissao: 'desc' }],
        select: { repCodigo: true, repNome: true },
      }),
      this.prisma.notaFiscalItem.findMany({
        where,
        distinct: ['cliCodigo'],
        orderBy: [{ cliCodigo: 'asc' }, { dataEmissao: 'desc' }],
        select: { cliCodigo: true, cliRazaoSocial: true, cliNomeFantasia: true, cliUf: true },
      }),
      this.prisma.notaFiscalItem.findMany({
        where,
        distinct: ['produtoAgrupado'],
        orderBy: [{ produtoAgrupado: 'asc' }, { dataEmissao: 'desc' }],
        select: { produtoAgrupado: true, produtoDescricao: true },
      }),
    ]);
    const rep = new Map(nomesRep.map((r) => [r.repCodigo, r.repNome]));
    const cli = new Map(nomesCli.map((c) => [c.cliCodigo, c]));
    const prod = new Map(
      nomesProd.map((p) => [p.produtoAgrupado, descricaoProdutoAgrupada(p.produtoDescricao)]),
    );
    const nDivisao = contar(notasDivisao, 'divisao');
    const nRep = contar(notasRep, 'repCodigo');
    const cRep = contar(clientesRep, 'repCodigo');
    const nCli = contar(notasCliente, 'cliCodigo');
    const totalTxt = total.toFixed(2);
    // Divisão + representante numa chave só (separador que não aparece nos textos do Focco).
    const chave = (l: { divisao: string; repCodigo: string }) => `${l.divisao}\u0000${l.repCodigo}`;
    const nDivRep = contar(
      notasDivRep.map((l) => ({ k: chave(l) })),
      'k',
    );
    const cDivRep = contar(
      clientesDivRep.map((l) => ({ k: chave(l) })),
      'k',
    );
    const linhaRep = (codigo: string, soma: Decimal, notas: number, clientes: number, base: Decimal) => ({
      codigo,
      nome: rep.get(codigo) ?? codigo,
      total: soma.toFixed(2),
      notas,
      clientes,
      participacao: fracao(soma, base),
    });
    // Produto × unidade: quantidades de unidades diferentes (UN, KG…) nunca se somam.
    const produtoUnidade = porProduto.map((p) => ({
      codigo: p.produtoAgrupado,
      descricao: prod.get(p.produtoAgrupado) ?? p.produtoAgrupado,
      unidade: p.unidade,
      quantidade: p._sum.quantidade ?? new D(0),
      total: valor(p._sum),
    }));
    // Curva por valor: uma linha por produto. Se o mesmo produto saiu em mais de uma unidade, a
    // quantidade não é somada (fica vazia) e a unidade mostra as que apareceram.
    const porCodigo = new Map<string, typeof produtoUnidade>();
    for (const l of produtoUnidade) porCodigo.set(l.codigo, [...(porCodigo.get(l.codigo) ?? []), l]);
    const produtosPorValor = [...porCodigo.values()]
      .map((ls) => {
        const uma = ls.length === 1;
        return {
          codigo: ls[0]!.codigo,
          descricao: ls[0]!.descricao,
          unidade: uma ? ls[0]!.unidade : ls.map((l) => l.unidade ?? '?').join(' + '),
          quantidade: uma ? ls[0]!.quantidade.toFixed(2) : '',
          total: ls.reduce((t, l) => t.plus(l.total), new D(0)),
        };
      })
      .sort((a, b) => b.total.cmp(a.total))
      .map((l) => ({ ...l, total: l.total.toFixed(2) }));
    // Curva por quantidade, separada por unidade; unidades com mais faturamento primeiro.
    const porUnidade = new Map<string, typeof produtoUnidade>();
    for (const l of produtoUnidade) {
      const u = l.unidade ?? 'sem unidade';
      porUnidade.set(u, [...(porUnidade.get(u) ?? []), l]);
    }
    const abcProdutosQuantidade = [...porUnidade.entries()]
      .map(([unidade, ls]) => ({
        unidade,
        faturamento: ls.reduce((t, l) => t.plus(l.total), new D(0)),
        quantidadeTotal: ls.reduce((t, l) => t.plus(l.quantidade), new D(0)).toFixed(2),
        // Mesma quantidade: desempata pelo valor (maior primeiro).
        linhas: [...ls]
          .sort((a, b) => b.quantidade.cmp(a.quantidade) || b.total.cmp(a.total))
          .map((l) => ({ ...l, quantidade: l.quantidade.toFixed(2), total: l.total.toFixed(2) })),
      }))
      .sort((a, b) => b.faturamento.cmp(a.faturamento))
      .map((u) => ({
        unidade: u.unidade,
        quantidadeTotal: u.quantidadeTotal,
        produtos: curvaAbc(u.linhas, u.quantidadeTotal, 'quantidade'),
      }));

    return {
      periodo: { de, ate },
      temDados: !!ultimo,
      total: totalTxt,
      notas: notas.length,
      clientes: clientes.length,
      divisoes: decrescente(porDivisao).map((d) => ({
        divisao: d.divisao,
        total: valor(d._sum).toFixed(2),
        notas: nDivisao.get(d.divisao) ?? 0,
        participacao: fracao(valor(d._sum), total),
      })),
      representantes: decrescente(porRep).map((r) =>
        linhaRep(r.repCodigo, valor(r._sum), nRep.get(r.repCodigo) ?? 0, cRep.get(r.repCodigo) ?? 0, total),
      ),
      representantesPorDivisao: decrescente(porDivisao).map((d) => {
        const base = valor(d._sum);
        return {
          divisao: d.divisao,
          total: base.toFixed(2),
          representantes: decrescente(porDivRep.filter((l) => l.divisao === d.divisao)).map((l) =>
            linhaRep(
              l.repCodigo,
              valor(l._sum),
              nDivRep.get(chave(l)) ?? 0,
              cDivRep.get(chave(l)) ?? 0,
              base,
            ),
          ),
        };
      }),
      abcClientes: curvaAbc(
        decrescente(porCliente).map((c) => {
          const n = cli.get(c.cliCodigo);
          return {
            codigo: c.cliCodigo,
            nomeFantasia: n?.cliNomeFantasia ?? null,
            razaoSocial: n?.cliRazaoSocial ?? c.cliCodigo,
            uf: n?.cliUf ?? '',
            total: valor(c._sum).toFixed(2),
            notas: nCli.get(c.cliCodigo) ?? 0,
          };
        }),
        totalTxt,
      ),
      abcProdutos: curvaAbc(produtosPorValor, totalTxt),
      abcProdutosQuantidade,
    };
  }
}
