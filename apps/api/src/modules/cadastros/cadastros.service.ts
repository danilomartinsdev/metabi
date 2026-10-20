import { Injectable } from '@nestjs/common';
import type { ClienteUpdate, RepresentanteUpdate, StatusPdvUpdate } from '@metabi/shared';
import { normalizarNome } from '@metabi/shared';
import { Erros } from '../../common/errors.js';
import type { ContextoRequisicao, UsuarioAutenticado } from '../../common/auth/types.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class CadastrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Usuário com escopo por representante só enxerga os seus (lista usada no filtro de gestor). */
  representantes(u: UsuarioAutenticado) {
    return this.prisma.representante.findMany({
      where: u.escopo.tipo === 'representantes' ? { id: { in: u.escopo.representanteIds } } : {},
      orderBy: { nomeExibicao: 'asc' },
      select: { id: true, codigo: true, nomeExibicao: true, segmentoPadrao: true, ativo: true },
    });
  }

  async atualizarRepresentante(
    id: string,
    dados: RepresentanteUpdate,
    u: UsuarioAutenticado,
    ctx: ContextoRequisicao,
  ) {
    await this.existe(this.prisma.representante.findUnique({ where: { id } }));
    const r = await this.prisma.representante.update({ where: { id }, data: dados });
    await this.audit.registrar({
      acao: 'cadastro.alterado',
      usuarioId: u.id,
      entidade: 'Representante',
      entidadeId: id,
      detalhes: dados,
      ctx,
    });
    return r;
  }

  status() {
    return this.prisma.statusPdv.findMany({ orderBy: { codigo: 'asc' } });
  }

  async atualizarStatus(id: string, dados: StatusPdvUpdate, u: UsuarioAutenticado, ctx: ContextoRequisicao) {
    await this.existe(this.prisma.statusPdv.findUnique({ where: { id } }));
    const s = await this.prisma.statusPdv.update({ where: { id }, data: dados });
    await this.audit.registrar({
      acao: 'cadastro.alterado',
      usuarioId: u.id,
      entidade: 'StatusPdv',
      entidadeId: id,
      detalhes: dados,
      ctx,
    });
    return s;
  }

  async clientes(q: { busca?: string; page: number; pageSize: number }) {
    const where = q.busca ? { nomeNormalizado: { contains: normalizarNome(q.busca) } } : {};
    const [data, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        orderBy: { nomeNormalizado: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: { id: true, nomeOriginal: true, segmentoOverride: true },
      }),
      this.prisma.cliente.count({ where }),
    ]);
    return { data, meta: { page: q.page, pageSize: q.pageSize, total } };
  }

  async atualizarCliente(id: string, dados: ClienteUpdate, u: UsuarioAutenticado, ctx: ContextoRequisicao) {
    await this.existe(this.prisma.cliente.findUnique({ where: { id } }));
    const c = await this.prisma.cliente.update({ where: { id }, data: dados });
    await this.audit.registrar({
      acao: 'cadastro.alterado',
      usuarioId: u.id,
      entidade: 'Cliente',
      entidadeId: id,
      detalhes: dados,
      ctx,
    });
    return c;
  }

  private async existe(p: Promise<unknown>) {
    if (!(await p)) throw Erros.naoEncontrado();
  }
}
