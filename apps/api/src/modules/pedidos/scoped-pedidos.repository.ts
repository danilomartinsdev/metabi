import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../../common/auth/types.js';
import { REGIAO_ENUM } from '../../common/regiao.js';

/**
 * ÚNICO ponto de acesso à tabela de pedidos (regra inegociável #1, reforçada pelo ESLint).
 * Toda leitura passa por `whereEscopo(usuario)`, que restringe aos pedidos que o usuário pode ver.
 */
@Injectable()
export class ScopedPedidosRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Filtro de escopo do usuário. Intersecte com os filtros do pedido; nunca substitua. */
  whereEscopo(u: UsuarioAutenticado): Prisma.PedidoWhereInput {
    switch (u.escopo.tipo) {
      case 'todos':
        return {};
      case 'regiao':
        return { regiao: { in: u.escopo.regioes.map((r) => REGIAO_ENUM[r]) } };
      case 'representantes':
        return { representanteId: { in: u.escopo.representanteIds } };
    }
  }

  findMany<A extends Prisma.PedidoFindManyArgs>(
    u: UsuarioAutenticado,
    args: A,
  ): Promise<Prisma.PedidoGetPayload<A>[]> {
    const a = args as Prisma.PedidoFindManyArgs;
    return this.prisma.pedido.findMany({
      ...a,
      where: { AND: [this.whereEscopo(u), a.where ?? {}] },
    }) as unknown as Promise<Prisma.PedidoGetPayload<A>[]>;
  }

  count(u: UsuarioAutenticado, where: Prisma.PedidoWhereInput = {}) {
    return this.prisma.pedido.count({ where: { AND: [this.whereEscopo(u), where] } });
  }

  /** Soma de valor dos pedidos (no escopo) que atendem ao filtro. */
  async soma(u: UsuarioAutenticado, where: Prisma.PedidoWhereInput): Promise<Prisma.Decimal | null> {
    const r = await this.prisma.pedido.aggregate({
      where: { AND: [this.whereEscopo(u), where] },
      _sum: { valor: true },
    });
    return r._sum.valor;
  }

  async ultimaCompetencia(u: UsuarioAutenticado, where: Prisma.PedidoWhereInput): Promise<Date | null> {
    const r = await this.prisma.pedido.aggregate({
      where: { AND: [this.whereEscopo(u), where] },
      _max: { competencia: true },
    });
    return r._max.competencia;
  }

  groupBy<K extends Prisma.PedidoScalarFieldEnum>(
    u: UsuarioAutenticado,
    by: K[],
    where: Prisma.PedidoWhereInput,
  ) {
    // O tipo genérico do groupBy do Prisma não aceita `by` dinâmico; o resultado é tipado abaixo.
    const groupBy = this.prisma.pedido.groupBy as unknown as (args: unknown) => Promise<unknown>;
    return groupBy({
      by,
      where: { AND: [this.whereEscopo(u), where] },
      _sum: { valor: true },
      _count: { _all: true },
    }) as Promise<
      (Pick<Prisma.PedidoGroupByOutputType, K> & {
        _sum: { valor: Prisma.Decimal | null };
        _count: { _all: number };
      })[]
    >;
  }
}

/**
 * Escrita de pedidos — usada só pela importação (que exige import.run e vale para toda a base).
 * Recebe o client da transação.
 */
@Injectable()
export class PedidosEscritaRepository {
  existentes(tx: Prisma.TransactionClient, focoIds: number[]) {
    return tx.pedido.findMany({ where: { focoId: { in: focoIds } } });
  }

  criar(tx: Prisma.TransactionClient, data: Prisma.PedidoUncheckedCreateInput) {
    return tx.pedido.create({ data });
  }

  atualizar(tx: Prisma.TransactionClient, focoId: number, data: Prisma.PedidoUncheckedUpdateInput) {
    return tx.pedido.update({ where: { focoId }, data });
  }

  apagar(tx: Prisma.TransactionClient, focoIds: number[]) {
    return tx.pedido.deleteMany({ where: { focoId: { in: focoIds } } });
  }

  /** Pedidos alterados por lotes posteriores a `loteId` (bloqueiam o rollback). */
  tocadosDepois(tx: Prisma.TransactionClient, focoIds: number[], loteId: string) {
    return tx.pedido.count({ where: { focoId: { in: focoIds }, ultimoLoteId: { not: loteId } } });
  }
}
