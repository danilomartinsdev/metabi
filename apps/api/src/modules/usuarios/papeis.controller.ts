import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  type PapelAdmin,
  type PapelSalvar,
  PERMISSOES_ADMIN,
  type Permission,
  papelSalvarSchema,
} from '@metabi/shared';
import type { FastifyRequest } from 'fastify';
import { CurrentUser, RequirePermission } from '../../common/auth/decorators.js';
import type { UsuarioAutenticado } from '../../common/auth/types.js';
import { ApiException, Erros } from '../../common/errors.js';
import { exigirAdmin, PERMISSOES_ADMINISTRATIVAS } from '../../common/auth/privilegios.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

const ctx = (req: FastifyRequest) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });
const uuid = new ParseUUIDPipe();

/** Papéis editáveis. O papel "admin" tem sempre todas as permissões (evita perder o acesso administrativo). */
@Controller('papeis')
export class PapeisController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @RequirePermission('users.manage')
  @Get()
  async listar(): Promise<PapelAdmin[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ sistema: 'desc' }, { nome: 'asc' }],
      include: { permissoes: true, _count: { select: { usuarios: true } } },
    });
    return roles.map((r) => ({
      id: r.id,
      chave: r.chave,
      nome: r.nome,
      sistema: r.sistema,
      permissoes: r.permissoes.map((p) => p.permissao as Permission),
      usuarios: r._count.usuarios,
    }));
  }

  @RequirePermission('users.manage')
  @Post()
  async criar(
    @Body(new ZodPipe(papelSalvarSchema)) d: PapelSalvar,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    if (d.permissoes.some((p) => PERMISSOES_ADMINISTRATIVAS.includes(p))) {
      exigirAdmin(u, 'Só um Admin pode conceder permissões administrativas.');
    }
    const r = await this.prisma.role.create({
      data: {
        chave: `custom-${randomUUID().slice(0, 8)}`,
        nome: d.nome,
        permissoes: { create: [...new Set(d.permissoes)].map((permissao) => ({ permissao })) },
      },
    });
    await this.audit.registrar({
      acao: 'papel.criado',
      usuarioId: u.id,
      entidade: 'Role',
      entidadeId: r.id,
      detalhes: d,
      ctx: ctx(req),
    });
    return (await this.listar()).find((x) => x.id === r.id);
  }

  @RequirePermission('users.manage')
  @Patch(':id')
  async atualizar(
    @Param('id', uuid) id: string,
    @Body(new ZodPipe(papelSalvarSchema)) d: PapelSalvar,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { permissoes: true } });
    if (!role) throw Erros.naoEncontrado();
    // Ninguém edita o próprio papel (evita autopromoção); permissões administrativas só por um Admin.
    if (role.chave === u.papel.chave) {
      throw new ApiException(HttpStatus.CONFLICT, 'CONFLICT', 'Você não pode alterar o papel que você usa.');
    }
    const concedeAdministrativa = d.permissoes.some(
      (p) => PERMISSOES_ADMINISTRATIVAS.includes(p) && !role.permissoes.some((x) => x.permissao === p),
    );
    if (role.chave === 'admin' || concedeAdministrativa) {
      exigirAdmin(u, 'Só um Admin pode alterar o papel Admin ou conceder permissões administrativas.');
    }
    const permissoes = role.chave === 'admin' ? [...PERMISSOES_ADMIN] : [...new Set(d.permissoes)];
    if (role.chave === 'admin' && d.permissoes.length !== PERMISSOES_ADMIN.length) {
      throw new ApiException(HttpStatus.CONFLICT, 'CONFLICT', 'O papel Admin mantém todas as permissões.');
    }
    const antes = role.permissoes.map((p) => p.permissao).sort();
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: permissoes.map((permissao) => ({ roleId: id, permissao })),
      }),
      this.prisma.role.update({ where: { id }, data: { nome: d.nome } }),
    ]);
    await this.audit.registrar({
      acao: 'papel.alterado',
      usuarioId: u.id,
      entidade: 'Role',
      entidadeId: id,
      detalhes: { nome: d.nome, antes, depois: [...permissoes].sort() },
      ctx: ctx(req),
    });
    return (await this.listar()).find((x) => x.id === id);
  }

  @RequirePermission('users.manage')
  @Delete(':id')
  @HttpCode(204)
  async remover(
    @Param('id', uuid) id: string,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { usuarios: true } } },
    });
    if (!role) throw Erros.naoEncontrado();
    if (role.sistema)
      throw new ApiException(HttpStatus.CONFLICT, 'CONFLICT', 'Papéis padrão não podem ser removidos.');
    if (role._count.usuarios > 0) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'Há usuários com este papel. Troque o papel deles antes.',
      );
    }
    await this.prisma.role.delete({ where: { id } });
    await this.audit.registrar({
      acao: 'papel.removido',
      usuarioId: u.id,
      entidade: 'Role',
      entidadeId: id,
      detalhes: { nome: role.nome },
      ctx: ctx(req),
    });
  }
}
