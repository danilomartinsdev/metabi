import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission } from '@metabi/shared';
import type { FastifyRequest } from 'fastify';
import type { UsuarioAutenticado } from './types.js';

export const IS_PUBLIC = 'auth:public';
export const PERMISSION = 'auth:permission';
export const AUTHENTICATED_ONLY = 'auth:authenticated-only';
export const ALLOW_PENDING_PASSWORD = 'auth:allow-pending-password';

/** Rota sem autenticação (login, refresh, esqueci a senha...). Use com parcimônia. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Exige a permissão (com várias, basta uma). Toda rota não pública precisa disto OU de @AuthenticatedOnly.
 */
export const RequirePermission = (...permissoes: [Permission, ...Permission[]]) =>
  SetMetadata(PERMISSION, permissoes);

/** Rota que só exige estar logado (ex.: /auth/me). Explícito para não ser esquecido. */
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY, true);

/** Rota acessível mesmo com troca de senha pendente (me, logout, trocar-senha). */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
  const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: UsuarioAutenticado }>();
  if (!req.user) throw new Error('CurrentUser usado em rota sem autenticação');
  return req.user;
});
