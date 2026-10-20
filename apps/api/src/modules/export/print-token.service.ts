import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type SolicitacaoImpressao, solicitacaoImpressaoSchema } from '@metabi/shared';
import type { UsuarioAutenticado } from '../../common/auth/types.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UsuarioLoader } from '../auth/usuario-loader.service.js';

const hashDe = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Tokens de impressão (ADR 0004): uso único, 60 s, presos ao usuário e ao solicitacao de PDF (qual relatório
 * e com quais parâmetros — um token de vendas não abre o relatório de faturamento, e vice-versa).
 * Ficam no banco (TokenImpressao, só o hash) — o Chromium busca os dados numa outra requisição, que em
 * serverless pode cair noutra instância. Ao consumir, o usuário é recarregado (ativo, permissões e escopo
 * atuais) e o token é marcado como usado.
 */
@Injectable()
export class PrintTokenService {
  static readonly TTL_MS = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: UsuarioLoader,
  ) {}

  async criar(usuario: UsuarioAutenticado, solicitacao: SolicitacaoImpressao, agora = new Date()): Promise<string> {
    await this.prisma.tokenImpressao.deleteMany({ where: { expiraEm: { lt: agora } } });
    const token = randomBytes(32).toString('base64url');
    await this.prisma.tokenImpressao.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: hashDe(token),
        // A coluna se chama "filtros" desde a primeira versão; guarda o solicitacao inteiro ({ tipo, ... }).
        filtros: solicitacao as unknown as Prisma.InputJsonValue,
        expiraEm: new Date(agora.getTime() + PrintTokenService.TTL_MS),
      },
    });
    return token;
  }

  /**
   * Devolve usuário e solicitacao e invalida o token; null se não existe, já foi usado, expirou ou é de
   * outro tipo de relatório.
   */
  async consumir<T extends SolicitacaoImpressao['tipo']>(
    token: string,
    tipo: T,
    agora = new Date(),
  ): Promise<{ usuario: UsuarioAutenticado; solicitacao: Extract<SolicitacaoImpressao, { tipo: T }> } | null> {
    // updateMany com as condições no where: marca como usado de forma atômica (duas leituras simultâneas
    // do mesmo token não passam as duas).
    const tokenHash = hashDe(token);
    const r = await this.prisma.tokenImpressao.updateMany({
      where: { tokenHash, usadoEm: null, expiraEm: { gt: agora } },
      data: { usadoEm: agora },
    });
    if (r.count !== 1) return null;
    const t = await this.prisma.tokenImpressao.findUnique({ where: { tokenHash } });
    if (!t) return null;
    const usuario = await this.loader.carregarAtivo(t.usuarioId);
    const solicitacao = solicitacaoImpressaoSchema.safeParse(t.filtros);
    if (!usuario || !solicitacao.success || solicitacao.data.tipo !== tipo) return null;
    return { usuario, solicitacao: solicitacao.data as Extract<SolicitacaoImpressao, { tipo: T }> };
  }

  /** Invalida um token não consumido (ex.: o Chromium falhou antes de abrir a página). */
  async descartar(token: string) {
    await this.prisma.tokenImpressao.deleteMany({ where: { tokenHash: hashDe(token), usadoEm: null } });
  }
}
