import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ContextoRequisicao } from '../../common/auth/types.js';

export type AcaoAuditada =
  | 'login.sucesso'
  | 'login.falha'
  | 'login.bloqueio'
  | 'logout'
  | 'sessao.reuso-detectado'
  | 'senha.troca'
  | 'senha.esqueci'
  | 'senha.redefinida'
  | 'usuario.desativado'
  | 'usuario.reativado'
  | 'usuario.sessoes-derrubadas'
  | 'import.executado'
  | 'import.revertido'
  | 'cadastro.alterado'
  | 'metas.alteradas'
  | 'usuario.criado'
  | 'usuario.alterado'
  | 'usuario.senha-redefinida'
  | 'papel.criado'
  | 'papel.alterado'
  | 'papel.removido'
  | 'export.xlsx'
  | 'export.pdf'
  | 'historico.alterado'
  | 'historico-faturamento.alterado'
  | 'faturamento.importado'
  | 'notas.importadas'
  // Gravada só pela migration que encerra as sessões numa atualização (todos entram de novo).
  | 'sessoes.todas-encerradas';

interface Registro {
  acao: AcaoAuditada;
  usuarioId?: string | null;
  entidade?: string;
  entidadeId?: string;
  /** Nunca inclua senha, token ou conteúdo de planilha. */
  detalhes?: Prisma.InputJsonValue;
  ctx?: ContextoRequisicao;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(r: Registro, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    try {
      await tx.auditLog.create({
        data: {
          acao: r.acao,
          usuarioId: r.usuarioId ?? null,
          entidade: r.entidade,
          entidadeId: r.entidadeId,
          detalhes: r.detalhes,
          ip: r.ctx?.ip,
          userAgent: r.ctx?.userAgent?.slice(0, 300),
        },
      });
    } catch (e) {
      // Falha de auditoria não pode derrubar o fluxo, mas precisa aparecer no log.
      this.logger.error(`Falha ao auditar ${r.acao}: ${(e as Error).message}`);
    }
  }
}
