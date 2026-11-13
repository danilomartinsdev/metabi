import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { type LimpezaExecutar, limpezaExecutarSchema } from '@metabi/shared';
import type { FastifyRequest } from 'fastify';
import { CurrentUser, RequirePermission } from '../../common/auth/decorators.js';
import { exigirAdmin, exigirEscopoTodos } from '../../common/auth/privilegios.js';
import type { UsuarioAutenticado } from '../../common/auth/types.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import { AuditService } from '../audit/audit.service.js';
import { LimpezaService } from './limpeza.service.js';

const MOTIVO = 'Só um Admin pode apagar dados por ano.';

/** Limpeza da base por ano e por área. Exige a permissão administrativa e o papel Admin. */
@Controller('limpeza')
export class LimpezaController {
  constructor(
    private readonly service: LimpezaService,
    private readonly audit: AuditService,
  ) {}

  @RequirePermission('users.manage')
  @Get()
  resumo(@CurrentUser() u: UsuarioAutenticado) {
    exigirAdmin(u, MOTIVO);
    exigirEscopoTodos(u);
    return this.service.resumo();
  }

  @RequirePermission('users.manage')
  @Post()
  async executar(
    @Body(new ZodPipe(limpezaExecutarSchema)) dados: LimpezaExecutar,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    exigirAdmin(u, MOTIVO);
    exigirEscopoTodos(u);
    const resultado = await this.service.executar(dados);
    await this.audit.registrar({
      acao: 'limpeza.executada',
      usuarioId: u.id,
      entidade: 'Limpeza',
      entidadeId: String(dados.ano),
      detalhes: { ano: dados.ano, areas: dados.areas, apagados: resultado },
      ctx: { ip: req.ip, userAgent: req.headers['user-agent'] },
    });
    return resultado;
  }
}
