import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import {
  type AuthResposta,
  type EsqueciSenhaInput,
  type LoginInput,
  type Preferencias,
  type RedefinirSenhaInput,
  type TrocarSenhaInput,
  type UsuarioLogado,
  esqueciSenhaSchema,
  loginSchema,
  preferenciasSchema,
  redefinirSenhaSchema,
  trocarSenhaSchema,
} from '@metabi/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ENV, type Env } from '../../config/env.js';
import {
  AllowPendingPassword,
  AuthenticatedOnly,
  CurrentUser,
  Public,
} from '../../common/auth/decorators.js';
import type { ContextoRequisicao, UsuarioAutenticado } from '../../common/auth/types.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import type { SessaoEmitida } from './sessao.service.js';
import { UsuarioLoader } from './usuario-loader.service.js';

export const REFRESH_COOKIE = 'mb_rt';
const COOKIE_PATH = '/api/auth';

/** Limites mais rígidos nas rotas de autenticação (por IP). */
const LIMITE_LOGIN = { rateLimit: { max: 10, timeWindow: '1 minute' } };
const LIMITE_SENHA = { rateLimit: { max: 5, timeWindow: '15 minutes' } };

function contexto(req: FastifyRequest): ContextoRequisicao {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly auth: AuthService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @RouteConfig(LIMITE_LOGIN)
  async login(
    @Body(new ZodPipe(loginSchema)) dados: LoginInput,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthResposta> {
    const r = await this.auth.login(dados, contexto(req));
    this.gravarCookie(res, r.sessao);
    return r.resposta;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @RouteConfig(LIMITE_LOGIN)
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthResposta> {
    try {
      const r = await this.auth.refresh(req.cookies[REFRESH_COOKIE], contexto(req));
      this.gravarCookie(res, r.sessao);
      return r.resposta;
    } catch (e) {
      this.limparCookie(res);
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply): Promise<void> {
    await this.auth.logout(req.cookies[REFRESH_COOKIE], contexto(req));
    this.limparCookie(res);
  }

  /** Sinal de "estou com o sistema aberto" (a tela chama a cada minuto); o guard registra a presença. */
  @AuthenticatedOnly()
  @AllowPendingPassword()
  @Post('presenca')
  @HttpCode(204)
  presenca(): void {}

  @AuthenticatedOnly()
  @AllowPendingPassword()
  @Get('me')
  me(@CurrentUser() usuario: UsuarioAutenticado): UsuarioLogado {
    return UsuarioLoader.paraResposta(usuario);
  }

  /** Preferências pessoais (hoje: paleta dos gráficos). Só altera o próprio usuário. */
  @AuthenticatedOnly()
  @Patch('me/preferencias')
  preferencias(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body(new ZodPipe(preferenciasSchema)) prefs: Preferencias,
  ): Promise<UsuarioLogado> {
    return this.auth.salvarPreferencias(usuario, prefs);
  }

  @AuthenticatedOnly()
  @AllowPendingPassword()
  @Post('trocar-senha')
  @HttpCode(200)
  @RouteConfig(LIMITE_SENHA)
  async trocarSenha(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body(new ZodPipe(trocarSenhaSchema)) dados: TrocarSenhaInput,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthResposta> {
    const r = await this.auth.trocarSenha(usuario, dados, contexto(req));
    this.gravarCookie(res, r.sessao);
    return r.resposta;
  }

  @Public()
  @Post('esqueci-senha')
  @HttpCode(204)
  @RouteConfig(LIMITE_SENHA)
  async esqueciSenha(
    @Body(new ZodPipe(esqueciSenhaSchema)) dados: EsqueciSenhaInput,
    @Req() req: FastifyRequest,
  ) {
    await this.auth.esqueciSenha(dados.email, contexto(req));
  }

  @Public()
  @Post('redefinir-senha')
  @HttpCode(204)
  @RouteConfig(LIMITE_SENHA)
  async redefinirSenha(
    @Body(new ZodPipe(redefinirSenhaSchema)) dados: RedefinirSenhaInput,
    @Req() req: FastifyRequest,
  ) {
    await this.auth.redefinirSenha(dados, contexto(req));
  }

  private gravarCookie(res: FastifyReply, sessao: SessaoEmitida) {
    void res.setCookie(REFRESH_COOKIE, sessao.refreshToken, {
      httpOnly: true,
      secure: this.env.COOKIE_SECURE,
      sameSite: 'strict',
      path: COOKIE_PATH,
      expires: sessao.expiraEm,
    });
  }

  private limparCookie(res: FastifyReply) {
    void res.clearCookie(REFRESH_COOKIE, {
      path: COOKIE_PATH,
      httpOnly: true,
      secure: this.env.COOKIE_SECURE,
      sameSite: 'strict',
    });
  }
}
