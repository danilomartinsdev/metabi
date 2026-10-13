import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { type AnaliseNotasQuery, analiseNotasQuerySchema, confirmarNotasSchema } from '@meta-bi/shared';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { CurrentUser, RequirePermission } from '../../common/auth/decorators.js';
import { exigirEscopoTodos } from '../../common/auth/privilegios.js';
import type { UsuarioAutenticado } from '../../common/auth/types.js';
import { ApiException } from '../../common/errors.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import { NotasFiscaisService } from './notas-fiscais.service.js';

const ctx = (req: FastifyRequest) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

/**
 * Análise de faturamento por notas fiscais. Como o faturamento diário, é um número da empresa inteira:
 * além da permissão, toda rota exige escopo "todos".
 */
@Controller('faturamento/notas')
export class NotasFiscaisController {
  constructor(private readonly service: NotasFiscaisService) {}

  @RequirePermission('faturamento.view')
  @Get('analise')
  analise(
    @Query(new ZodPipe(analiseNotasQuerySchema)) q: AnaliseNotasQuery,
    @CurrentUser() u: UsuarioAutenticado,
  ) {
    exigirEscopoTodos(u);
    return this.service.analise(q);
  }

  @RequirePermission('faturamento.import')
  @Post('import/previa')
  @HttpCode(200)
  async previa(@Req() req: FastifyRequest, @CurrentUser() u: UsuarioAutenticado) {
    exigirEscopoTodos(u);
    const arquivo = await req.file().catch(() => undefined);
    if (!arquivo) throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Envie um arquivo.');
    const buf = await arquivo.toBuffer().catch(() => {
      throw new ApiException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'VALIDATION',
        'Arquivo maior que o limite permitido.',
      );
    });
    return this.service.previa(buf, arquivo.filename.slice(0, 200), u.id);
  }

  @RequirePermission('faturamento.import')
  @Post('import/confirmar')
  @HttpCode(200)
  confirmar(
    @Body(new ZodPipe(confirmarNotasSchema)) dados: z.infer<typeof confirmarNotasSchema>,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    exigirEscopoTodos(u);
    return this.service.confirmar(dados.hash, u, ctx(req));
  }

  @RequirePermission('faturamento.import')
  @Get('import/lotes')
  lotes(@CurrentUser() u: UsuarioAutenticado) {
    exigirEscopoTodos(u);
    return this.service.lotes();
  }
}
