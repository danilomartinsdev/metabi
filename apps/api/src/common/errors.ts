import { HttpException, HttpStatus } from '@nestjs/common';
import type { CodigoErro, ErroApi } from '@metabi/shared';

/** Exceção de negócio com código estável (o front traduz o código em mensagem). */
export class ApiException extends HttpException {
  constructor(status: HttpStatus, code: CodigoErro, message: string, details?: ErroApi['details']) {
    super({ code, message, details }, status);
  }
}

export const Erros = {
  credenciaisInvalidas: () =>
    new ApiException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.'),
  contaBloqueada: () =>
    new ApiException(HttpStatus.LOCKED, 'ACCOUNT_LOCKED', 'Acesso bloqueado temporariamente.'),
  naoAutenticado: () =>
    new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Sessão inválida ou expirada.'),
  semPermissao: () =>
    new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Você não tem permissão para esta ação.'),
  trocaSenhaObrigatoria: () =>
    new ApiException(HttpStatus.FORBIDDEN, 'PASSWORD_CHANGE_REQUIRED', 'Troque sua senha para continuar.'),
  naoEncontrado: () => new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.'),
};
