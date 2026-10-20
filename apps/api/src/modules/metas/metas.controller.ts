import { Body, Controller, Get, HttpStatus, Put, Query, Req } from '@nestjs/common';
import { exigirEscopoTodos } from '../../common/auth/privilegios.js';
import { ApiException } from '../../common/errors.js';
import { type MetasSalvar, metasSalvarSchema } from '@metabi/shared';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { CurrentUser, RequirePermission } from '../../common/auth/decorators.js';
import type { UsuarioAutenticado } from '../../common/auth/types.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

const anoSchema = z.object({ ano: z.coerce.number().int().min(2020).max(2100) });

@Controller('metas')
export class MetasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @RequirePermission('metas.edit')
  @Get()
  async listar(
    @Query(new ZodPipe(anoSchema)) q: z.infer<typeof anoSchema>,
    @CurrentUser() u: UsuarioAutenticado,
  ) {
    // Metas cobrem todos os representantes e a empresa: exigem escopo "todos".
    exigirEscopoTodos(u);
    const metas = await this.prisma.meta.findMany({ where: { ano: q.ano }, orderBy: [{ mes: 'asc' }] });
    return metas.map((m) => ({ mes: m.mes, representanteId: m.representanteId, valor: m.valor.toFixed(2) }));
  }

  /** Salva a grade do ano: valor null apaga a meta daquele mês/representante. */
  @RequirePermission('metas.edit')
  @Put()
  async salvar(
    @Body(new ZodPipe(metasSalvarSchema)) dados: MetasSalvar,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    exigirEscopoTodos(u);
    const ids = [...new Set(dados.metas.map((m) => m.representanteId).filter((x): x is string => !!x))];
    if (
      ids.length &&
      (await this.prisma.representante.count({ where: { id: { in: ids } } })) !== ids.length
    ) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION',
        'Representante inexistente na grade de metas.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      for (const m of dados.metas) {
        // representanteId null não funciona em chave única composta do Prisma: usa findFirst + id.
        const atual = await tx.meta.findFirst({
          where: { ano: dados.ano, mes: m.mes, representanteId: m.representanteId },
          select: { id: true },
        });
        if (m.valor === null) {
          if (atual) await tx.meta.delete({ where: { id: atual.id } });
        } else if (atual) {
          await tx.meta.update({ where: { id: atual.id }, data: { valor: new Prisma.Decimal(m.valor) } });
        } else {
          await tx.meta.create({
            data: {
              ano: dados.ano,
              mes: m.mes,
              representanteId: m.representanteId,
              valor: new Prisma.Decimal(m.valor),
            },
          });
        }
      }
    });
    await this.audit.registrar({
      acao: 'metas.alteradas',
      usuarioId: u.id,
      entidade: 'Meta',
      detalhes: { ano: dados.ano, metas: dados.metas },
      ctx: { ip: req.ip, userAgent: req.headers['user-agent'] },
    });
    return this.listar({ ano: dados.ano }, u);
  }
}
