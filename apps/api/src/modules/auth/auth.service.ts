import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  AuthResposta,
  LoginInput,
  Preferencias,
  RedefinirSenhaInput,
  TrocarSenhaInput,
  UsuarioLogado,
} from '@metabi/shared';
import { ENV, type Env } from '../../config/env.js';
import { ApiException, Erros } from '../../common/errors.js';
import type { ContextoRequisicao, UsuarioAutenticado } from '../../common/auth/types.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { SenhaService } from './senha.service.js';
import { type SessaoEmitida, SessaoService } from './sessao.service.js';
import { TokenService } from './token.service.js';
import { UsuarioLoader } from './usuario-loader.service.js';

export interface ResultadoAuth {
  resposta: AuthResposta;
  sessao: SessaoEmitida;
}

const RESET_TTL_MS = 60 * 60_000; // 1 hora

@Injectable()
export class AuthService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly senhas: SenhaService,
    private readonly sessoes: SessaoService,
    private readonly tokens: TokenService,
    private readonly loader: UsuarioLoader,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async login(dados: LoginInput, ctx: ContextoRequisicao): Promise<ResultadoAuth> {
    const u = await this.prisma.usuario.findUnique({ where: { email: dados.email } });

    if (u?.bloqueadoAte && u.bloqueadoAte > new Date()) {
      await this.audit.registrar({
        acao: 'login.falha',
        usuarioId: u.id,
        detalhes: { motivo: 'bloqueado' },
        ctx,
      });
      throw Erros.contaBloqueada();
    }

    const ok = await this.senhas.verificar(u?.senhaHash ?? null, dados.senha);

    if (!u || !ok) {
      if (u) await this.registrarFalha(u.id, u.tentativasFalhas, ctx);
      else
        await this.audit.registrar({ acao: 'login.falha', detalhes: { motivo: 'email-desconhecido' }, ctx });
      throw Erros.credenciaisInvalidas();
    }

    if (!u.ativo) {
      await this.audit.registrar({
        acao: 'login.falha',
        usuarioId: u.id,
        detalhes: { motivo: 'inativo' },
        ctx,
      });
      throw new ApiException(HttpStatus.FORBIDDEN, 'ACCOUNT_DISABLED', 'Usuário desativado.');
    }

    await this.prisma.usuario.update({
      where: { id: u.id },
      data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoAcessoEm: new Date() },
    });
    const sessao = await this.sessoes.criar(u.id, ctx);
    await this.audit.registrar({ acao: 'login.sucesso', usuarioId: u.id, ctx });
    return { resposta: await this.montarResposta(u.id, sessao.familia), sessao };
  }

  private async registrarFalha(usuarioId: string, tentativasAntes: number, ctx: ContextoRequisicao) {
    const tentativas = tentativasAntes + 1;
    if (tentativas >= this.env.LOGIN_MAX_ATTEMPTS) {
      await this.prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          tentativasFalhas: 0,
          bloqueadoAte: new Date(Date.now() + this.env.LOGIN_LOCK_MINUTES * 60_000),
        },
      });
      await this.audit.registrar({ acao: 'login.bloqueio', usuarioId, detalhes: { tentativas }, ctx });
      throw Erros.contaBloqueada();
    }
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { tentativasFalhas: tentativas } });
    await this.audit.registrar({
      acao: 'login.falha',
      usuarioId,
      detalhes: { motivo: 'senha', tentativas },
      ctx,
    });
  }

  async refresh(refreshToken: string | undefined, ctx: ContextoRequisicao): Promise<ResultadoAuth> {
    if (!refreshToken) throw Erros.naoAutenticado();
    const r = await this.sessoes.rotacionar(refreshToken, ctx);
    if (!r.ok) throw Erros.naoAutenticado();
    return { resposta: await this.montarResposta(r.usuarioId, r.sessao.familia), sessao: r.sessao };
  }

  async logout(refreshToken: string | undefined, ctx: ContextoRequisicao): Promise<void> {
    if (!refreshToken) return;
    const s = await this.sessoes.familiaDoToken(refreshToken);
    if (!s) return;
    await this.sessoes.revogarFamilia(s.familia);
    await this.audit.registrar({ acao: 'logout', usuarioId: s.usuarioId, ctx });
  }

  async trocarSenha(
    usuario: UsuarioAutenticado,
    dados: TrocarSenhaInput,
    ctx: ContextoRequisicao,
  ): Promise<ResultadoAuth> {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    if (!(await this.senhas.verificar(u.senhaHash, dados.senhaAtual))) throw Erros.credenciaisInvalidas();

    await this.prisma.usuario.update({
      where: { id: u.id },
      data: { senhaHash: await this.senhas.hash(dados.novaSenha), trocarSenha: false },
    });
    // Senha nova invalida todas as sessões (inclusive em outros dispositivos) e abre uma nova.
    await this.sessoes.revogarTodas(u.id);
    const sessao = await this.sessoes.criar(u.id, ctx);
    await this.audit.registrar({ acao: 'senha.troca', usuarioId: u.id, ctx });
    return { resposta: await this.montarResposta(u.id, sessao.familia), sessao };
  }

  /** Sempre responde igual, exista ou não o e-mail. */
  async esqueciSenha(email: string, ctx: ContextoRequisicao): Promise<void> {
    const u = await this.prisma.usuario.findUnique({ where: { email } });
    if (!u || !u.ativo) {
      await this.audit.registrar({ acao: 'senha.esqueci', detalhes: { encontrado: false }, ctx });
      return;
    }
    const { token, hash } = this.tokens.gerarOpaco();
    await this.prisma.$transaction([
      this.prisma.tokenRedefinicaoSenha.updateMany({
        where: { usuarioId: u.id, usadoEm: null },
        data: { usadoEm: new Date() },
      }),
      this.prisma.tokenRedefinicaoSenha.create({
        data: { usuarioId: u.id, tokenHash: hash, expiraEm: new Date(Date.now() + RESET_TTL_MS) },
      }),
    ]);
    await this.audit.registrar({
      acao: 'senha.esqueci',
      usuarioId: u.id,
      detalhes: { encontrado: true },
      ctx,
    });

    const link = `${this.env.APP_URL}/redefinir-senha?token=${encodeURIComponent(token)}`;
    // Sem await: o tempo de resposta não deve depender do envio (não revela se o e-mail existe).
    void this.mail.enviar({
      para: u.email,
      assunto: 'Redefinição de senha — MetaBI',
      texto: `Olá, ${u.nome}.\n\nPara definir uma nova senha, acesse:\n${link}\n\nO link vale por 1 hora. Se você não pediu, ignore este e-mail.`,
      html: `<p>Olá, ${escapar(u.nome)}.</p><p>Para definir uma nova senha, clique no link abaixo:</p><p><a href="${link}">Redefinir minha senha</a></p><p>O link vale por 1 hora. Se você não pediu, ignore este e-mail.</p>`,
    });
  }

  async redefinirSenha(dados: RedefinirSenhaInput, ctx: ContextoRequisicao): Promise<void> {
    const t = await this.prisma.tokenRedefinicaoSenha.findUnique({
      where: { tokenHash: TokenService.hash(dados.token) },
      include: { usuario: true },
    });
    if (!t || t.usadoEm || t.expiraEm <= new Date() || !t.usuario.ativo) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Link inválido ou expirado.');
    }
    const senhaHash = await this.senhas.hash(dados.novaSenha);
    await this.prisma.$transaction([
      this.prisma.tokenRedefinicaoSenha.update({ where: { id: t.id }, data: { usadoEm: new Date() } }),
      this.prisma.usuario.update({
        where: { id: t.usuarioId },
        data: { senhaHash, trocarSenha: false, tentativasFalhas: 0, bloqueadoAte: null },
      }),
    ]);
    await this.sessoes.revogarTodas(t.usuarioId);
    await this.audit.registrar({ acao: 'senha.redefinida', usuarioId: t.usuarioId, ctx });
  }

  private async montarResposta(usuarioId: string, familia: string): Promise<AuthResposta> {
    const usuario = await this.loader.carregar(usuarioId, familia);
    if (!usuario) throw Erros.naoAutenticado();
    const { token, expiraEm } = await this.tokens.emitirAccess({ sub: usuarioId, sid: familia });
    return { accessToken: token, expiraEm, usuario: UsuarioLoader.paraResposta(usuario) };
  }

  /** Preferências do próprio usuário (o id vem do token, nunca do corpo da requisição). */
  async salvarPreferencias(usuario: UsuarioAutenticado, prefs: Preferencias): Promise<UsuarioLogado> {
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { paletaGraficos: prefs.paletaGraficos },
    });
    return UsuarioLoader.paraResposta({ ...usuario, paletaGraficos: prefs.paletaGraficos });
  }
}

function escapar(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
