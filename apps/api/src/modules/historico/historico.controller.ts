import { Body, Controller, Get, Put, Query, Req } from '@nestjs/common';
import {
  type HistoricoFaturamentoMes,
  type HistoricoMes,
  type HistoricoSalvar,
  historicoSalvarSchema,
} from '@meta-bi/shared';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { CurrentUser, RequirePermission } from '../../common/auth/decorators.js';
import { exigirEscopoTodos } from '../../common/auth/privilegios.js';
import type { UsuarioAutenticado } from '../../common/auth/types.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';

const anoSchema = z.object({ ano: z.coerce.number().int().min(2000).max(2100) });

/**
 * Faturamento manual da empresa por mês (comparativos com anos sem pedidos importados).
 * É um total da empresa: mesma regra das metas — permissão metas.edit e escopo "todos".
 */
@Controller('historico')
export class HistoricoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly dashboard: DashboardService,
  ) {}

  @RequirePermission('metas.edit')
  @Get()
  async listar(
    @Query(new ZodPipe(anoSchema)) q: z.infer<typeof anoSchema>,
    @CurrentUser() u: UsuarioAutenticado,
  ): Promise<HistoricoMes[]> {
    exigirEscopoTodos(u);
    const [linhas, meses] = await Promise.all([
      this.prisma.faturamentoHistorico.findMany({ where: { ano: q.ano } }),
      this.dashboard.mesesDisponiveis(u),
    ]);
    const valores = new Map(linhas.map((l) => [l.mes, l.valor.toFixed(2)]));
    const comPedidos = new Set(meses.filter((m) => m.startsWith(`${q.ano}-`)).map((m) => Number(m.slice(5))));
    return Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      valor: valores.get(i + 1) ?? null,
      temPedidos: comPedidos.has(i + 1),
    }));
  }

  /** Salva o ano: valor null apaga o mês. */
  @RequirePermission('metas.edit')
  @Put()
  async salvar(
    @Body(new ZodPipe(historicoSalvarSchema)) dados: HistoricoSalvar,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    exigirEscopoTodos(u);
    await this.prisma.$transaction(async (tx) => {
      for (const m of dados.meses) {
        const chave = { ano_mes: { ano: dados.ano, mes: m.mes } };
        if (m.valor === null) {
          await tx.faturamentoHistorico.deleteMany({ where: { ano: dados.ano, mes: m.mes } });
        } else {
          const valor = new Prisma.Decimal(m.valor);
          await tx.faturamentoHistorico.upsert({
            where: chave,
            update: { valor },
            create: { ano: dados.ano, mes: m.mes, valor },
          });
        }
      }
    });
    await this.audit.registrar({
      acao: 'historico.alterado',
      usuarioId: u.id,
      entidade: 'FaturamentoHistorico',
      detalhes: { ano: dados.ano, meses: dados.meses },
      ctx: { ip: req.ip, userAgent: req.headers['user-agent'] },
    });
    return this.listar({ ano: dados.ano }, u);
  }

  /** Faturamento manual (aba Faturamento): só vale em meses sem faturamento importado do Focco. */
  @RequirePermission('faturamento.import')
  @Get('faturamento')
  async listarFaturamento(
    @Query(new ZodPipe(anoSchema)) q: z.infer<typeof anoSchema>,
    @CurrentUser() u: UsuarioAutenticado,
  ): Promise<HistoricoFaturamentoMes[]> {
    exigirEscopoTodos(u);
    const [linhas, importados] = await Promise.all([
      this.prisma.faturamentoManual.findMany({ where: { ano: q.ano } }),
      this.prisma.faturamentoDia.groupBy({ by: ['mes'], where: { ano: q.ano } }),
    ]);
    const valores = new Map(linhas.map((l) => [l.mes, l.valor.toFixed(2)]));
    const comImportado = new Set(importados.map((m) => m.mes));
    return Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      valor: valores.get(i + 1) ?? null,
      temImportado: comImportado.has(i + 1),
    }));
  }

  /** Salva o ano: valor null apaga o mês. */
  @RequirePermission('faturamento.import')
  @Put('faturamento')
  async salvarFaturamento(
    @Body(new ZodPipe(historicoSalvarSchema)) dados: HistoricoSalvar,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    exigirEscopoTodos(u);
    await this.prisma.$transaction(async (tx) => {
      for (const m of dados.meses) {
        if (m.valor === null) {
          await tx.faturamentoManual.deleteMany({ where: { ano: dados.ano, mes: m.mes } });
        } else {
          const valor = new Prisma.Decimal(m.valor);
          await tx.faturamentoManual.upsert({
            where: { ano_mes: { ano: dados.ano, mes: m.mes } },
            update: { valor },
            create: { ano: dados.ano, mes: m.mes, valor },
          });
        }
      }
    });
    await this.audit.registrar({
      acao: 'historico-faturamento.alterado',
      usuarioId: u.id,
      entidade: 'FaturamentoManual',
      detalhes: { ano: dados.ano, meses: dados.meses },
      ctx: { ip: req.ip, userAgent: req.headers['user-agent'] },
    });
    return this.listarFaturamento({ ano: dados.ano }, u);
  }
}
