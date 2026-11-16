import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import {
  type AnoNovo,
  anoNovoSchema,
  anoParamSchema,
  type AnaliseDescontosQuery,
  analiseDescontosQuerySchema,
  type PrecosSalvar,
  precosSalvarSchema,
  type ProdutoChave,
  produtoChaveSchema,
  type ProdutoNovo,
  produtoNovoSchema,
  type TabelaPrecosQuery,
  tabelaPrecosQuerySchema,
} from '@metabi/shared';
import type { FastifyRequest } from 'fastify';
import { CurrentUser, RequirePermission } from '../../common/auth/decorators.js';
import { exigirEscopoTodos } from '../../common/auth/privilegios.js';
import type { ContextoRequisicao, UsuarioAutenticado } from '../../common/auth/types.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import { DescontosService } from './descontos.service.js';
import { PrecosService } from './precos.service.js';

const contexto = (req: FastifyRequest): ContextoRequisicao => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

/**
 * Análise de descontos (preço de tabela × vendido, no período). Como a Análise de faturamento, é um número
 * da empresa inteira: além da permissão, exige escopo "todos".
 */
@Controller('descontos')
export class DescontosController {
  constructor(private readonly service: DescontosService) {}

  @RequirePermission('descontos.view')
  @Get()
  analise(
    @Query(new ZodPipe(analiseDescontosQuerySchema)) q: AnaliseDescontosQuery,
    @CurrentUser() u: UsuarioAutenticado,
  ) {
    exigirEscopoTodos(u);
    return this.service.analise(q);
  }
}

/** Tabela de preços (cadastro por ano + produtos incluídos à mão): só quem edita preços, com escopo "todos". */
@Controller('precos')
export class PrecosController {
  constructor(private readonly service: PrecosService) {}

  @RequirePermission('precos.edit')
  @Get()
  tabela(
    @Query(new ZodPipe(tabelaPrecosQuerySchema)) q: TabelaPrecosQuery,
    @CurrentUser() u: UsuarioAutenticado,
  ) {
    exigirEscopoTodos(u);
    return this.service.tabela(q.ano);
  }

  @RequirePermission('precos.edit')
  @Put()
  salvar(
    @Body(new ZodPipe(precosSalvarSchema)) dados: PrecosSalvar,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    exigirEscopoTodos(u);
    return this.service.salvar(dados, u, contexto(req));
  }

  @RequirePermission('precos.edit')
  @Post('anos')
  incluirAno(
    @Body(new ZodPipe(anoNovoSchema)) dados: AnoNovo,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    exigirEscopoTodos(u);
    return this.service.incluirAno(dados, u, contexto(req));
  }

  /** Retira o ano da lista e apaga todos os preços dele. */
  @RequirePermission('precos.edit')
  @Delete('anos/:ano')
  @HttpCode(204)
  async excluirAno(
    @Param('ano', new ZodPipe(anoParamSchema)) ano: number,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    exigirEscopoTodos(u);
    await this.service.excluirAno(ano, u, contexto(req));
  }

  @RequirePermission('precos.edit')
  @Post('produtos')
  incluir(
    @Body(new ZodPipe(produtoNovoSchema)) p: ProdutoNovo,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    exigirEscopoTodos(u);
    return this.service.incluirProduto(p, u, contexto(req));
  }

  /** ?codigo=&unidade= (a unidade pode ser vazia, por isso não vai no caminho). */
  @RequirePermission('precos.edit')
  @Delete('produtos')
  @HttpCode(204)
  async excluir(
    @Query(new ZodPipe(produtoChaveSchema)) c: ProdutoChave,
    @CurrentUser() u: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    exigirEscopoTodos(u);
    await this.service.excluirProduto(c, u, contexto(req));
  }
}
