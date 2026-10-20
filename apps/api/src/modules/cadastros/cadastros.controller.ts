import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import {
  type ClienteUpdate,
  clienteUpdateSchema,
  clientesQuerySchema,
  type RepresentanteUpdate,
  representanteUpdateSchema,
  type StatusPdvUpdate,
  statusPdvUpdateSchema,
} from '@metabi/shared';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { AuthenticatedOnly, CurrentUser, RequirePermission } from '../../common/auth/decorators.js';
import type { UsuarioAutenticado } from '../../common/auth/types.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import { CadastrosService } from './cadastros.service.js';

const ctx = (req: FastifyRequest) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

@Controller()
export class CadastrosController {
  constructor(private readonly service: CadastrosService) {}

  /** Lista usada nos filtros (gestores) — qualquer usuário logado; códigos/nomes não são dado de venda. */
  @AuthenticatedOnly()
  @Get('representantes')
  representantes(@CurrentUser() u: UsuarioAutenticado) {
    return this.service.representantes(u);
  }

  @RequirePermission('cadastros.edit')
  @Patch('representantes/:id')
  atualizarRepresentante(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(representanteUpdateSchema)) dados: RepresentanteUpdate,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    return this.service.atualizarRepresentante(id, dados, u, ctx(req));
  }

  @AuthenticatedOnly()
  @Get('status-pdv')
  status() {
    return this.service.status();
  }

  @RequirePermission('cadastros.edit')
  @Patch('status-pdv/:id')
  atualizarStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(statusPdvUpdateSchema)) dados: StatusPdvUpdate,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    return this.service.atualizarStatus(id, dados, u, ctx(req));
  }

  @RequirePermission('cadastros.edit')
  @Get('clientes')
  clientes(@Query(new ZodPipe(clientesQuerySchema)) q: z.infer<typeof clientesQuerySchema>) {
    return this.service.clientes(q);
  }

  @RequirePermission('cadastros.edit')
  @Patch('clientes/:id')
  atualizarCliente(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(clienteUpdateSchema)) dados: ClienteUpdate,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    return this.service.atualizarCliente(id, dados, u, ctx(req));
  }
}
