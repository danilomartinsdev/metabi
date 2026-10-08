import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ContextoRequisicao } from '../../common/auth/types.js';

/** Intervalo mínimo entre gravações da presença de um mesmo usuário (por instância da API). */
const INTERVALO_MS = 60_000;

/** Guarda a última atividade de cada usuário autenticado (aba "Online" da auditoria). */
@Injectable()
export class PresencaService {
  private readonly logger = new Logger(PresencaService.name);
  private readonly ultimaGravacao = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  /** Não bloqueia a requisição: grava em segundo plano e ignora falhas (só registra no log). */
  registrar(usuarioId: string, ctx: ContextoRequisicao): void {
    const agora = Date.now();
    if (agora - (this.ultimaGravacao.get(usuarioId) ?? 0) < INTERVALO_MS) return;
    this.ultimaGravacao.set(usuarioId, agora);
    const dados = {
      ultimaAtividadeEm: new Date(agora),
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent?.slice(0, 500) ?? null,
    };
    this.prisma.presenca
      .upsert({ where: { usuarioId }, update: dados, create: { usuarioId, ...dados } })
      .catch((e: unknown) => {
        this.ultimaGravacao.delete(usuarioId);
        this.logger.warn(`Falha ao registrar presença: ${e instanceof Error ? e.message : String(e)}`);
      });
  }
}
