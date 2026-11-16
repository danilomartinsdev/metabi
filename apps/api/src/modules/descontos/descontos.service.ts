import { Injectable } from '@nestjs/common';
import {
  type DescontoProduto,
  type DescontoRepresentante,
  type DescontosAno,
  descricaoProdutoAgrupada,
  type PrecosSalvar,
} from '@metabi/shared';
import type { ContextoRequisicao, UsuarioAutenticado } from '../../common/auth/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new D(0);
const fracao = (v: Decimal, total: Decimal) => (total.isZero() ? null : v.div(total).toNumber());
/** Produto + unidade numa chave só (separador que não aparece nos textos do Focco). */
const chave = (codigo: string, unidade: string | null) => `${codigo}\u0000${unidade ?? ''}`;

/**
 * Previsão de descontos: compara o vendido no ano (itens de NF do Focco) com o preço de tabela do mesmo
 * ano. Desconto = preço × quantidade − vendido. Só entram no desconto os itens com preço cadastrado.
 */
@Injectable()
export class DescontosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async doAno(ano: number): Promise<DescontosAno> {
    const where = { ano };
    const [porProduto, porRepProduto, nomesRep, precos, precosAnteriores, anosNotas, anosPrecos] =
      await Promise.all([
        this.prisma.notaFiscalItem.groupBy({
          by: ['produtoAgrupado', 'unidade'],
          where,
          _sum: { quantidade: true, valorTotal: true },
        }),
        this.prisma.notaFiscalItem.groupBy({
          by: ['repCodigo', 'produtoAgrupado', 'unidade'],
          where,
          _sum: { quantidade: true, valorTotal: true },
        }),
        this.prisma.notaFiscalItem.findMany({
          where,
          distinct: ['repCodigo'],
          orderBy: [{ repCodigo: 'asc' }, { dataEmissao: 'desc' }],
          select: { repCodigo: true, repNome: true },
        }),
        this.prisma.precoTabela.findMany({ where: { ano } }),
        this.prisma.precoTabela.findMany({ where: { ano: ano - 1 } }),
        this.prisma.notaFiscalItem.groupBy({ by: ['ano'] }),
        this.prisma.precoTabela.groupBy({ by: ['ano'] }),
      ]);

    const preco = new Map(precos.map((p) => [chave(p.produtoCodigo, p.unidade), p.preco]));
    const precoAnterior = new Map(precosAnteriores.map((p) => [chave(p.produtoCodigo, p.unidade), p.preco]));

    // Linhas: tudo o que foi vendido no ano + preços cadastrados de produtos sem venda no ano.
    const linhas = new Map<
      string,
      { codigo: string; unidade: string; quantidade: Decimal; vendido: Decimal }
    >();
    for (const p of porProduto) {
      linhas.set(chave(p.produtoAgrupado, p.unidade), {
        codigo: p.produtoAgrupado,
        unidade: p.unidade ?? '',
        quantidade: p._sum.quantidade ?? ZERO,
        vendido: p._sum.valorTotal ?? ZERO,
      });
    }
    for (const p of precos) {
      const k = chave(p.produtoCodigo, p.unidade);
      if (!linhas.has(k))
        linhas.set(k, { codigo: p.produtoCodigo, unidade: p.unidade, quantidade: ZERO, vendido: ZERO });
    }

    // Descrição: a mais recente do produto em qualquer ano (produto com preço pode não ter venda no ano).
    const codigos = [...new Set([...linhas.values()].map((l) => l.codigo))];
    const descricoes = codigos.length
      ? await this.prisma.notaFiscalItem.findMany({
          where: { produtoAgrupado: { in: codigos } },
          distinct: ['produtoAgrupado'],
          orderBy: [{ produtoAgrupado: 'asc' }, { dataEmissao: 'desc' }],
          select: { produtoAgrupado: true, produtoDescricao: true },
        })
      : [];
    const descricao = new Map(
      descricoes.map((d) => [d.produtoAgrupado, descricaoProdutoAgrupada(d.produtoDescricao)]),
    );

    let vendidoTotal = ZERO;
    let vendidoComPreco = ZERO;
    let valorTabelaTotal = ZERO;
    const produtos: (DescontoProduto & { _ordem: Decimal })[] = [];
    for (const [k, l] of linhas) {
      const p = preco.get(k) ?? null;
      const valorTabela = p ? p.mul(l.quantidade) : null;
      const desconto = valorTabela ? valorTabela.minus(l.vendido) : null;
      vendidoTotal = vendidoTotal.plus(l.vendido);
      if (valorTabela) {
        vendidoComPreco = vendidoComPreco.plus(l.vendido);
        valorTabelaTotal = valorTabelaTotal.plus(valorTabela);
      }
      produtos.push({
        codigo: l.codigo,
        descricao: descricao.get(l.codigo) ?? l.codigo,
        unidade: l.unidade,
        quantidade: l.quantidade.toFixed(2),
        vendido: l.vendido.toFixed(2),
        preco: p?.toString() ?? null,
        precoAnoAnterior: precoAnterior.get(k)?.toString() ?? null,
        valorTabela: valorTabela?.toFixed(2) ?? null,
        desconto: desconto?.toFixed(2) ?? null,
        percentual: valorTabela && desconto ? fracao(desconto, valorTabela) : null,
        _ordem: l.vendido,
      });
    }
    produtos.sort((a, b) => b._ordem.cmp(a._ordem) || a.codigo.localeCompare(b.codigo));

    // Por representante: só itens com preço de tabela no ano.
    const reps = new Map<string, { vendido: Decimal; valorTabela: Decimal }>();
    for (const r of porRepProduto) {
      const p = preco.get(chave(r.produtoAgrupado, r.unidade));
      if (!p) continue;
      const atual = reps.get(r.repCodigo) ?? { vendido: ZERO, valorTabela: ZERO };
      atual.vendido = atual.vendido.plus(r._sum.valorTotal ?? ZERO);
      atual.valorTabela = atual.valorTabela.plus(p.mul(r._sum.quantidade ?? ZERO));
      reps.set(r.repCodigo, atual);
    }
    const nomeRep = new Map(nomesRep.map((r) => [r.repCodigo, r.repNome]));
    const representantes: DescontoRepresentante[] = [...reps.entries()]
      .map(([codigo, v]) => ({ codigo, ...v, desconto: v.valorTabela.minus(v.vendido) }))
      .sort((a, b) => b.desconto.cmp(a.desconto))
      .map((r) => ({
        codigo: r.codigo,
        nome: nomeRep.get(r.codigo) ?? r.codigo,
        vendido: r.vendido.toFixed(2),
        valorTabela: r.valorTabela.toFixed(2),
        desconto: r.desconto.toFixed(2),
        percentual: fracao(r.desconto, r.valorTabela),
      }));

    const descontoTotal = valorTabelaTotal.minus(vendidoComPreco);
    const anos = [...new Set([...anosNotas.map((a) => a.ano), ...anosPrecos.map((a) => a.ano)])].sort(
      (a, b) => b - a,
    );
    return {
      ano,
      anos,
      temNotas: porProduto.length > 0,
      resumo: {
        vendidoTotal: vendidoTotal.toFixed(2),
        vendidoComPreco: vendidoComPreco.toFixed(2),
        valorTabela: valorTabelaTotal.toFixed(2),
        desconto: descontoTotal.toFixed(2),
        percentual: fracao(descontoTotal, valorTabelaTotal),
        cobertura: fracao(vendidoComPreco, vendidoTotal),
        produtos: produtos.length,
        produtosComPreco: produtos.filter((p) => p.preco !== null).length,
      },
      produtos: produtos.map(({ _ordem, ...p }) => p),
      representantes,
    };
  }

  /** Grava só o ano informado: os preços de outros anos nunca são tocados. */
  async salvarPrecos(dados: PrecosSalvar, usuario: UsuarioAutenticado, ctx: ContextoRequisicao) {
    await this.prisma.$transaction(async (tx) => {
      for (const p of dados.precos) {
        const where = {
          ano_produtoCodigo_unidade: { ano: dados.ano, produtoCodigo: p.produtoCodigo, unidade: p.unidade },
        };
        if (p.preco === null) await tx.precoTabela.deleteMany({ where: where.ano_produtoCodigo_unidade });
        else
          await tx.precoTabela.upsert({
            where,
            update: { preco: new D(p.preco) },
            create: { ...where.ano_produtoCodigo_unidade, preco: new D(p.preco) },
          });
      }
    });
    await this.audit.registrar({
      acao: 'precos.alterados',
      usuarioId: usuario.id,
      entidade: 'PrecoTabela',
      detalhes: { ano: dados.ano, precos: dados.precos },
      ctx,
    });
    return this.doAno(dados.ano);
  }
}
