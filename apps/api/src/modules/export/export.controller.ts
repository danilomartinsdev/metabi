import { Controller, Get, Header, Param, Query, Req, Res } from '@nestjs/common';
import {
  type AnaliseNotasQuery,
  analiseNotasQuerySchema,
  EXPORT_XLSX_TIPOS,
  type ExportXlsxQuery,
  type ExportXlsxTipo,
  exportXlsxQuerySchema,
  type FaturamentoPdfQuery,
  type Filtros,
  faturamentoPdfQuerySchema,
  filtrosSchema,
  printTokenSchema,
} from '@metabi/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { CurrentUser, Public, RequirePermission } from '../../common/auth/decorators.js';
import type { ContextoRequisicao, UsuarioAutenticado } from '../../common/auth/types.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import { type Arquivo, ExportService } from './export.service.js';

const tipoXlsx = z.enum(EXPORT_XLSX_TIPOS);
const contexto = (req: FastifyRequest): ContextoRequisicao => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

function enviar(reply: FastifyReply, a: Arquivo) {
  void reply
    .header('content-type', a.tipo)
    .header('content-disposition', `attachment; filename="${a.nome}"`)
    .header('cache-control', 'no-store')
    .send(a.conteudo);
}

@Controller()
export class ExportController {
  constructor(private readonly service: ExportService) {}

  @RequirePermission('export.xlsx')
  @Get('export/xlsx/:tipo')
  async xlsx(
    @CurrentUser() u: UsuarioAutenticado,
    @Param('tipo', new ZodPipe(tipoXlsx)) tipo: ExportXlsxTipo,
    @Query(new ZodPipe(exportXlsxQuerySchema)) q: ExportXlsxQuery,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    enviar(reply, await this.service.xlsx(u, tipo, q, contexto(req)));
  }

  @RequirePermission('export.pdf')
  @Get('export/pdf')
  async pdf(
    @CurrentUser() u: UsuarioAutenticado,
    @Query(new ZodPipe(filtrosSchema)) f: Filtros,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    enviar(reply, await this.service.pdf(u, f, contexto(req)));
  }

  /** PDF da página de Faturamento (permissão de PDF + faturamento.view + escopo "todos", checados no serviço). */
  @RequirePermission('export.pdf')
  @Get('export/pdf/faturamento')
  async pdfFaturamento(
    @CurrentUser() u: UsuarioAutenticado,
    @Query(new ZodPipe(faturamentoPdfQuerySchema)) q: FaturamentoPdfQuery,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    enviar(reply, await this.service.pdfFaturamento(u, q, contexto(req)));
  }

  /** PDF da Análise de faturamento (permissão de PDF + faturamento-analise.view + escopo "todos", no serviço). */
  @RequirePermission('export.pdf')
  @Get('export/pdf/analise-faturamento')
  async pdfAnaliseFaturamento(
    @CurrentUser() u: UsuarioAutenticado,
    @Query(new ZodPipe(analiseNotasQuerySchema)) q: AnaliseNotasQuery,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    enviar(reply, await this.service.pdfAnaliseFaturamento(u, q, contexto(req)));
  }

  /** Lido pela página /print/relatorio aberta pelo Chromium da API. O token é a credencial (uso único). */
  @Public()
  @Get('print/relatorio')
  @Header('cache-control', 'no-store')
  relatorio(@Query(new ZodPipe(printTokenSchema)) q: { token: string }) {
    return this.service.relatorio(q.token);
  }

  /** Lido pela página /print/faturamento (mesmo esquema de token de uso único). */
  @Public()
  @Get('print/faturamento')
  @Header('cache-control', 'no-store')
  faturamento(@Query(new ZodPipe(printTokenSchema)) q: { token: string }) {
    return this.service.faturamentoImpressao(q.token);
  }

  /** Lido pela página /print/analise-faturamento (mesmo esquema de token de uso único). */
  @Public()
  @Get('print/analise-faturamento')
  @Header('cache-control', 'no-store')
  analiseFaturamento(@Query(new ZodPipe(printTokenSchema)) q: { token: string }) {
    return this.service.analiseFaturamentoImpressao(q.token);
  }
}
