import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import {
  confirmarFaturamentoSchema,
  type FaturamentoComparativoQuery,
  type FaturamentoQuery,
  faturamentoAnoQuerySchema,
  faturamentoComparativoQuerySchema,
  faturamentoQuerySchema,
} from '@metabi/shared';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { CurrentUser, RequirePermission } from '../../common/auth/decorators.js';
import { exigirEscopoTodos } from '../../common/auth/privilegios.js';
import type { UsuarioAutenticado } from '../../common/auth/types.js';
import { ApiException } from '../../common/errors.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import { FaturamentoService } from './faturamento.service.js';

const ctx = (req: FastifyRequest) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

/**
 * Faturamento é um número da empresa inteira (sem representante): além da permissão, toda rota
 * exige escopo "todos" — quem vê só parte da carteira não vê o faturamento total.
 */
@Controller('faturamento')
export class FaturamentoController {
  constructor(private readonly service: FaturamentoService) {}

  @RequirePermission('faturamento.view')
  @Get('resumo')
  resumo(
    @Query(new ZodPipe(faturamentoQuerySchema)) q: FaturamentoQuery,
    @CurrentUser() u: UsuarioAutenticado,
  ) {
    exigirEscopoTodos(u);
    return this.service.resumo(q);
  }

  @RequirePermission('faturamento.view')
  @Get('anos')
  anos(@CurrentUser() u: UsuarioAutenticado) {
    exigirEscopoTodos(u);
    return this.service.anos();
  }

  @RequirePermission('faturamento.view')
  @Get('mensal')
  mensal(
    @Query(new ZodPipe(faturamentoAnoQuerySchema)) q: z.infer<typeof faturamentoAnoQuerySchema>,
    @CurrentUser() u: UsuarioAutenticado,
  ) {
    exigirEscopoTodos(u);
    return this.service.mensal(q.ano);
  }

  @RequirePermission('faturamento.view')
  @Get('comparativo')
  comparativo(
    @Query(new ZodPipe(faturamentoComparativoQuerySchema)) q: FaturamentoComparativoQuery,
    @CurrentUser() u: UsuarioAutenticado,
  ) {
    exigirEscopoTodos(u);
    return this.service.comparativo(q.anoA, q.anoB, q.meses);
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
    @Body(new ZodPipe(confirmarFaturamentoSchema)) dados: z.infer<typeof confirmarFaturamentoSchema>,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    exigirEscopoTodos(u);
    return this.service.confirmar(dados.hash, dados.meses, u, ctx(req));
  }

  @RequirePermission('faturamento.import')
  @Get('import/lotes')
  lotes(@CurrentUser() u: UsuarioAutenticado) {
    exigirEscopoTodos(u);
    return this.service.lotes();
  }
}
