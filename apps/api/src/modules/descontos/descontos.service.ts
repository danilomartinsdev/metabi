import { Injectable } from '@nestjs/common';
import {
  type AnaliseDescontos,
  type AnaliseDescontosQuery,
  type DescontoProduto,
  descricaoProdutoAgrupada,
} from '@metabi/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new D(0);
const fracao = (v: Decimal, total: Decimal) => (total.isZero() ? null : v.div(total).toNumber());
/** Produto + unidade numa chave só (separador que não aparece nos textos do Focco). */
export const chaveProduto = (codigo: string, unidade: string | null) => `${codigo}\u0000${unidade ?? ''}`;
const dataMes = (m: string) => new Date(`${m}-01T00:00:00Z`);
const fimMes = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0));

/**
 * Análise de descontos: compara o vendido no período (itens de NF do Focco) com o preço de tabela.
 * Desconto = preço × quantidade − vendido. Cada mês usa a tabela do seu ano; só entram no desconto as
 * vendas de produtos com preço naquele ano.
 */
@Injectable()
export class DescontosService {
  constructor(private readonly prisma: PrismaService) {}

  async analise(q: AnaliseDescontosQuery): Promise<AnaliseDescontos> {
    // Período padrão: do início do ano até o último mês com notas (como a Análise de faturamento).
    const ultimo = await this.prisma.notaFiscalItem.findFirst({
      orderBy: { dataEmissao: 'desc' },
      select: { dataEmissao: true },
    });
    const ate =
      q.ate ?? ultimo?.dataEmissao.toISOString().slice(0, 7) ?? new Date().toISOString().slice(0, 7);
    const de0 = q.de ?? `${ate.slice(0, 4)}-01`;
    const de = de0 > ate ? ate : de0;
    const where = { dataEmissao: { gte: dataMes(de), lte: fimMes(ate) } };

    const [porAno, nomes] = await Promise.all([
      this.prisma.notaFiscalItem.groupBy({
        by: ['ano', 'produtoAgrupado', 'unidade'],
        where,
        _sum: { quantidade: true, valorTotal: true },
      }),
      this.prisma.notaFiscalItem.findMany({
        where,
        distinct: ['produtoAgrupado'],
        orderBy: [{ produtoAgrupado: 'asc' }, { dataEmissao: 'desc' }],
        select: { produtoAgrupado: true, produtoDescricao: true },
      }),
    ]);
    const anos = [...new Set(porAno.map((l) => l.ano))];
    const precos = anos.length
      ? await this.prisma.precoTabela.findMany({ where: { ano: { in: anos } } })
      : [];
    const preco = new Map(
      precos.map((p) => [`${p.ano}\u0000${chaveProduto(p.produtoCodigo, p.unidade)}`, p.preco]),
    );
    const descricao = new Map(
      nomes.map((n) => [n.produtoAgrupado, descricaoProdutoAgrupada(n.produtoDescricao)]),
    );
    const umAno = de.slice(0, 4) === ate.slice(0, 4);

    type Acumulado = {
      codigo: string;
      unidade: string;
      quantidade: Decimal;
      vendido: Decimal;
      vendidoComPreco: Decimal;
      valorTabela: Decimal | null;
      preco: Decimal | null;
      parcial: boolean;
    };
    const produtos = new Map<string, Acumulado>();
    for (const l of porAno) {
      const k = chaveProduto(l.produtoAgrupado, l.unidade);
      const a: Acumulado = produtos.get(k) ?? {
        codigo: l.produtoAgrupado,
        unidade: l.unidade ?? '',
        quantidade: ZERO,
        vendido: ZERO,
        vendidoComPreco: ZERO,
        valorTabela: null,
        preco: null,
        parcial: false,
      };
      const qtd = l._sum.quantidade ?? ZERO;
      const vendido = l._sum.valorTotal ?? ZERO;
      a.quantidade = a.quantidade.plus(qtd);
      a.vendido = a.vendido.plus(vendido);
      const p = preco.get(`${l.ano}\u0000${k}`);
      if (p) {
        a.valorTabela = (a.valorTabela ?? ZERO).plus(p.mul(qtd));
        a.vendidoComPreco = a.vendidoComPreco.plus(vendido);
        if (umAno) a.preco = p;
      } else a.parcial = true;
      produtos.set(k, a);
    }

    let vendidoTotal = ZERO;
    let vendidoComPreco = ZERO;
    let valorTabela = ZERO;
    const linhas: (DescontoProduto & { _desconto: Decimal | null; _vendido: Decimal })[] = [];
    for (const a of produtos.values()) {
      vendidoTotal = vendidoTotal.plus(a.vendido);
      vendidoComPreco = vendidoComPreco.plus(a.vendidoComPreco);
      if (a.valorTabela) valorTabela = valorTabela.plus(a.valorTabela);
      const desconto = a.valorTabela ? a.valorTabela.minus(a.vendidoComPreco) : null;
      linhas.push({
        codigo: a.codigo,
        descricao: descricao.get(a.codigo) ?? a.codigo,
        unidade: a.unidade,
        quantidade: a.quantidade.toFixed(2),
        vendido: a.vendido.toFixed(2),
        vendidoComPreco: a.vendidoComPreco.toFixed(2),
        preco: a.preco?.toString() ?? null,
        valorTabela: a.valorTabela?.toFixed(2) ?? null,
        desconto: desconto?.toFixed(2) ?? null,
        percentual: a.valorTabela && desconto ? fracao(desconto, a.valorTabela) : null,
        // Só é "parcial" quando parte tem preço e parte não; sem preço nenhum já aparece como "—".
        precoParcial: a.parcial && a.valorTabela !== null,
        _desconto: desconto,
        _vendido: a.vendido,
      });
    }
    // Maior desconto primeiro; os sem preço no fim, pelo valor vendido.
    linhas.sort((x, y) => {
      if (x._desconto && y._desconto) return y._desconto.cmp(x._desconto) || x.codigo.localeCompare(y.codigo);
      if (x._desconto) return -1;
      if (y._desconto) return 1;
      return y._vendido.cmp(x._vendido) || x.codigo.localeCompare(y.codigo);
    });

    const desconto = valorTabela.minus(vendidoComPreco);
    return {
      periodo: { de, ate },
      temDados: !!ultimo,
      resumo: {
        vendidoTotal: vendidoTotal.toFixed(2),
        vendidoComPreco: vendidoComPreco.toFixed(2),
        valorTabela: valorTabela.toFixed(2),
        desconto: desconto.toFixed(2),
        percentual: fracao(desconto, valorTabela),
        cobertura: fracao(vendidoComPreco, vendidoTotal),
        produtos: linhas.length,
        produtosComPreco: linhas.filter((l) => l.valorTabela !== null).length,
      },
      produtos: linhas.map(({ _desconto, _vendido, ...l }) => l),
    };
  }
}
