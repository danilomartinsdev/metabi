import { Body, Controller, Get, Put, Query, Req } from '@nestjs/common';
import {
  type DescontosQuery,
  descontosQuerySchema,
  type PrecosSalvar,
  precosSalvarSchema,
} from '@metabi/shared';
import type { FastifyRequest } from 'fastify';
import { CurrentUser, RequirePermission } from '../../common/auth/decorators.js';
import { exigirEscopoTodos } from '../../common/auth/privilegios.js';
import type { UsuarioAutenticado } from '../../common/auth/types.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import { DescontosService } from './descontos.service.js';

/**
 * Previsão de descontos (preço de tabela × vendido, por ano). Como a Análise de faturamento, é um número
 * da empresa inteira: além da permissão, toda rota exige escopo "todos".
 */
@Controller('descontos')
export class DescontosController {
  constructor(private readonly service: DescontosService) {}

  @RequirePermission('descontos.view')
  @Get()
  doAno(@Query(new ZodPipe(descontosQuerySchema)) q: DescontosQuery, @CurrentUser() u: UsuarioAutenticado) {
    exigirEscopoTodos(u);
    return this.service.doAno(q.ano);
  }

  @RequirePermission('precos.edit')
  @Put('precos')
  salvar(
    @Body(new ZodPipe(precosSalvarSchema)) dados: PrecosSalvar,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    exigirEscopoTodos(u);
    return this.service.salvarPrecos(dados, u, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }
}
