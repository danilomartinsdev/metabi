import { HttpStatus, Injectable } from '@nestjs/common';
import {
  descricaoProdutoAgrupada,
  type PrecosSalvar,
  type ProdutoChave,
  type ProdutoNovo,
  type ProdutoPreco,
  type TabelaPrecos,
} from '@metabi/shared';
import type { ContextoRequisicao, UsuarioAutenticado } from '../../common/auth/types.js';
import { ApiException, Erros } from '../../common/errors.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { chaveProduto } from './descontos.service.js';

const D = Prisma.Decimal;

/**
 * Tabela de preços por ano. A lista de produtos é a união dos que já saíram em alguma nota fiscal (qualquer
 * ano) com os incluídos à mão; os preços de cada ano ficam separados.
 */
@Injectable()
export class PrecosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async tabela(ano: number): Promise<TabelaPrecos> {
    const [vendidos, manuais, precos, anteriores, anosNotas, anosPrecos] = await Promise.all([
      this.prisma.notaFiscalItem.groupBy({ by: ['produtoAgrupado', 'unidade'], _max: { dataEmissao: true } }),
      this.prisma.produtoCadastro.findMany(),
      this.prisma.precoTabela.findMany({ where: { ano } }),
      this.prisma.precoTabela.findMany({ where: { ano: ano - 1 } }),
      this.prisma.notaFiscalItem.groupBy({ by: ['ano'] }),
      this.prisma.precoTabela.groupBy({ by: ['ano'] }),
    ]);
    const codigos = [...new Set(vendidos.map((v) => v.produtoAgrupado))];
    const nomes = codigos.length
      ? await this.prisma.notaFiscalItem.findMany({
          distinct: ['produtoAgrupado'],
          orderBy: [{ produtoAgrupado: 'asc' }, { dataEmissao: 'desc' }],
          select: { produtoAgrupado: true, produtoDescricao: true },
        })
      : [];
    const descricao = new Map(
      nomes.map((n) => [n.produtoAgrupado, descricaoProdutoAgrupada(n.produtoDescricao)]),
    );
    const preco = new Map(precos.map((p) => [chaveProduto(p.produtoCodigo, p.unidade), p.preco.toString()]));
    const anterior = new Map(
      anteriores.map((p) => [chaveProduto(p.produtoCodigo, p.unidade), p.preco.toString()]),
    );

    const produtos = new Map<string, ProdutoPreco>();
    const incluir = (
      codigo: string,
      unidade: string,
      desc: string,
      manual: boolean,
      ultimaVenda: string | null,
    ) => {
      const k = chaveProduto(codigo, unidade);
      produtos.set(k, {
        codigo,
        descricao: desc,
        unidade,
        manual,
        ultimaVenda,
        preco: preco.get(k) ?? null,
        precoAnoAnterior: anterior.get(k) ?? null,
      });
    };
    for (const v of vendidos) {
      incluir(
        v.produtoAgrupado,
        v.unidade ?? '',
        descricao.get(v.produtoAgrupado) ?? v.produtoAgrupado,
        false,
        v._max.dataEmissao?.toISOString().slice(0, 10) ?? null,
      );
    }
    // Incluído à mão que depois saiu em nota: vale o das notas (deixa de ser "manual").
    for (const m of manuais) {
      if (!produtos.has(chaveProduto(m.codigo, m.unidade)))
        incluir(m.codigo, m.unidade, m.descricao, true, null);
    }
    // Preço gravado de produto que não está em lugar nenhum (ex.: notas apagadas): continua visível.
    for (const p of [...precos, ...anteriores]) {
      if (!produtos.has(chaveProduto(p.produtoCodigo, p.unidade)))
        incluir(p.produtoCodigo, p.unidade, p.produtoCodigo, false, null);
    }

    const anos = [...new Set([...anosNotas.map((a) => a.ano), ...anosPrecos.map((a) => a.ano)])].sort(
      (a, b) => b - a,
    );
    return {
      ano,
      anos,
      produtos: [...produtos.values()].sort(
        (a, b) =>
          a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }) || a.unidade.localeCompare(b.unidade),
      ),
    };
  }

  /** Grava só o ano informado: os preços de outros anos nunca são tocados. */
  async salvar(dados: PrecosSalvar, usuario: UsuarioAutenticado, ctx: ContextoRequisicao) {
    await this.prisma.$transaction(async (tx) => {
      for (const p of dados.precos) {
        const chave = { ano: dados.ano, produtoCodigo: p.produtoCodigo, unidade: p.unidade };
        if (p.preco === null) await tx.precoTabela.deleteMany({ where: chave });
        else
          await tx.precoTabela.upsert({
            where: { ano_produtoCodigo_unidade: chave },
            update: { preco: new D(p.preco) },
            create: { ...chave, preco: new D(p.preco) },
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
    return this.tabela(dados.ano);
  }

  /** Inclui um produto que ainda não saiu em nota. Recusa o que já existe (nas notas ou incluído antes). */
  async incluirProduto(p: ProdutoNovo, usuario: UsuarioAutenticado, ctx: ContextoRequisicao) {
    const [nasNotas, jaIncluido] = await Promise.all([
      this.prisma.notaFiscalItem.findFirst({
        where: { produtoAgrupado: p.codigo, unidade: p.unidade || null },
        select: { id: true },
      }),
      this.prisma.produtoCadastro.findUnique({
        where: { codigo_unidade: { codigo: p.codigo, unidade: p.unidade } },
      }),
    ]);
    if (nasNotas || jaIncluido) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        `O produto ${p.codigo}${p.unidade ? ` (${p.unidade})` : ''} já está na tabela.`,
      );
    }
    const criado = await this.prisma.produtoCadastro.create({ data: p });
    await this.audit.registrar({
      acao: 'produto.incluido',
      usuarioId: usuario.id,
      entidade: 'ProdutoCadastro',
      entidadeId: criado.id,
      detalhes: p,
      ctx,
    });
    return { codigo: criado.codigo, unidade: criado.unidade };
  }

  /** Exclui um produto incluído à mão e os preços dele em todos os anos. Produtos das notas não saem. */
  async excluirProduto(c: ProdutoChave, usuario: UsuarioAutenticado, ctx: ContextoRequisicao) {
    const produto = await this.prisma.produtoCadastro.findUnique({
      where: { codigo_unidade: { codigo: c.codigo, unidade: c.unidade } },
    });
    if (!produto) throw Erros.naoEncontrado();
    const precos = await this.prisma.$transaction(async (tx) => {
      const r = await tx.precoTabela.deleteMany({ where: { produtoCodigo: c.codigo, unidade: c.unidade } });
      await tx.produtoCadastro.delete({ where: { id: produto.id } });
      return r.count;
    });
    await this.audit.registrar({
      acao: 'produto.excluido',
      usuarioId: usuario.id,
      entidade: 'ProdutoCadastro',
      entidadeId: produto.id,
      detalhes: {
        codigo: c.codigo,
        unidade: c.unidade,
        descricao: produto.descricao,
        precosApagados: precos,
      },
      ctx,
    });
  }
}
