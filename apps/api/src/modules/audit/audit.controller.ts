import { Controller, Get, Query } from '@nestjs/common';
import {
  type AuditoriaLinha,
  type AuditoriaQuery,
  auditoriaQuerySchema,
  type UsuariosOnline,
} from '@metabi/shared';
import { RequirePermission } from '../../common/auth/decorators.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { resumirDispositivo } from './dispositivo.js';

/** Conta como online quem teve atividade nestes últimos minutos (a tela manda sinal a cada 5 minutos). */
const JANELA_ONLINE_MINUTOS = 10;

@Controller('auditoria')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermission('audit.view')
  @Get()
  async listar(@Query(new ZodPipe(auditoriaQuerySchema)) q: AuditoriaQuery) {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.acao ? { acao: { startsWith: q.acao } } : {}),
      ...(q.usuarioId ? { usuarioId: q.usuarioId } : {}),
      ...(q.de || q.ate
        ? {
            createdAt: {
              ...(q.de ? { gte: new Date(`${q.de}T00:00:00-03:00`) } : {}),
              ...(q.ate ? { lte: new Date(`${q.ate}T23:59:59.999-03:00`) } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { usuario: { select: { id: true, nome: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const data: AuditoriaLinha[] = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      acao: r.acao,
      usuario: r.usuario,
      entidade: r.entidade,
      entidadeId: r.entidadeId,
      detalhes: r.detalhes,
      ip: r.ip,
    }));
    return { data, meta: { page: q.page, pageSize: q.pageSize, total } };
  }

  @RequirePermission('audit.view')
  @Get('acoes')
  async acoes() {
    const r = await this.prisma.auditLog.findMany({
      distinct: ['acao'],
      select: { acao: true },
      orderBy: { acao: 'asc' },
    });
    return r.map((x) => x.acao);
  }

  /** Usuários ativos, com sessão válida e atividade recente. */
  @RequirePermission('audit.view')
  @Get('online')
  async online(): Promise<UsuariosOnline> {
    const agora = new Date();
    const desde = new Date(agora.getTime() - JANELA_ONLINE_MINUTOS * 60_000);
    const rows = await this.prisma.presenca.findMany({
      where: {
        ultimaAtividadeEm: { gte: desde },
        usuario: { ativo: true, sessoes: { some: { revogadaEm: null, expiraEm: { gt: agora } } } },
      },
      orderBy: { ultimaAtividadeEm: 'desc' },
      include: {
        usuario: { select: { id: true, nome: true, email: true, role: { select: { nome: true } } } },
      },
    });
    return {
      janelaMinutos: JANELA_ONLINE_MINUTOS,
      usuarios: rows.map((r) => ({
        id: r.usuario.id,
        nome: r.usuario.nome,
        email: r.usuario.email,
        papel: r.usuario.role.nome,
        ultimaAtividadeEm: r.ultimaAtividadeEm.toISOString(),
        dispositivo: resumirDispositivo(r.userAgent),
        ip: r.ip,
      })),
    };
  }
}
