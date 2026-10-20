import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ErroApi } from '@metabi/shared';
import type { FastifyReply } from 'fastify';

const CODIGO_POR_STATUS: Record<number, ErroApi['code']> = {
  400: 'VALIDATION',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  423: 'ACCOUNT_LOCKED',
  429: 'RATE_LIMITED',
};

/** Formato único de erro; nunca expõe stack, SQL ou mensagens internas. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Erro');

  catch(exception: unknown, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErroApi = {
      statusCode: status,
      error: 'Internal Server Error',
      code: 'INTERNAL',
      message: 'Erro inesperado. Tente novamente.',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      const r = (typeof res === 'object' && res ? res : {}) as Partial<ErroApi> & { message?: unknown };
      body = {
        statusCode: status,
        error: HttpStatus[status]?.replace(/_/g, ' ') ?? 'Error',
        code: r.code ?? CODIGO_POR_STATUS[status] ?? 'INTERNAL',
        message: typeof r.message === 'string' ? r.message : exception.message,
        ...(r.details ? { details: r.details } : {}),
      };
    } else if ((exception as { statusCode?: number })?.statusCode === 429) {
      status = 429;
      body = {
        statusCode: 429,
        error: 'Too Many Requests',
        code: 'RATE_LIMITED',
        message: 'Muitas requisições.',
      };
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    void reply.status(status).send(body);
  }
}
