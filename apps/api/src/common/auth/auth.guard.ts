import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@meta-bi/shared';
import type { FastifyRequest } from 'fastify';
import { Erros } from '../errors.js';
import { PresencaService } from '../../modules/auth/presenca.service.js';
import { TokenService } from '../../modules/auth/token.service.js';
import { UsuarioLoader } from '../../modules/auth/usuario-loader.service.js';
import { ALLOW_PENDING_PASSWORD, AUTHENTICATED_ONLY, IS_PUBLIC, PERMISSION } from './decorators.js';
import type { UsuarioAutenticado } from './types.js';

/**
 * Guard global. Seguro por padrão:
 *  - rota sem @Public exige access token válido de sessão não revogada e usuário ativo;
 *  - rota precisa declarar @RequirePermission ou @AuthenticatedOnly (senão 403);
 *  - troca de senha pendente bloqueia tudo exceto rotas @AllowPendingPassword.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly loader: UsuarioLoader,
    private readonly presenca: PresencaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, alvos)) return true;

    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: UsuarioAutenticado }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Erros.naoAutenticado();

    const payload = await this.tokens.verificarAccess(header.slice(7)).catch(() => null);
    if (!payload) throw Erros.naoAutenticado();

    const usuario = await this.loader.carregar(payload.sub, payload.sid);
    if (!usuario) throw Erros.naoAutenticado();
    req.user = usuario;
    this.presenca.registrar(usuario.id, { ip: req.ip, userAgent: req.headers['user-agent'] });

    if (usuario.trocarSenha && !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD, alvos)) {
      throw Erros.trocaSenhaObrigatoria();
    }

    const permissoes = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSION, alvos);
    if (permissoes?.length) {
      if (!permissoes.some((p) => usuario.permissoes.includes(p))) throw Erros.semPermissao();
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_ONLY, alvos)) return true;

    this.logger.error(
      `Rota sem @RequirePermission/@AuthenticatedOnly: ${req.method} ${req.routeOptions.url}`,
    );
    throw Erros.semPermissao();
  }
}
