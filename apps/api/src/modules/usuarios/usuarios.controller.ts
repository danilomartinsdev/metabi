import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import {
  type UsuarioAtualizar,
  usuarioAtualizarSchema,
  type UsuarioCriar,
  usuarioCriarSchema,
} from '@metabi/shared';
import type { FastifyRequest } from 'fastify';
import { CurrentUser, RequirePermission } from '../../common/auth/decorators.js';
import type { UsuarioAutenticado } from '../../common/auth/types.js';
import { ZodPipe } from '../../common/zod-validation.pipe.js';
import { UsuariosService } from './usuarios.service.js';

const ctx = (req: FastifyRequest) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });
const uuid = new ParseUUIDPipe();

/** Administração de usuários — tudo exige users.manage. */
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @RequirePermission('users.manage')
  @Get()
  listar() {
    return this.usuarios.listar();
  }

  @RequirePermission('users.manage')
  @Post()
  criar(
    @Body(new ZodPipe(usuarioCriarSchema)) d: UsuarioCriar,
    @CurrentUser() admin: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    return this.usuarios.criar(d, admin, ctx(req));
  }

  @RequirePermission('users.manage')
  @Patch(':id')
  atualizar(
    @Param('id', uuid) id: string,
    @Body(new ZodPipe(usuarioAtualizarSchema)) d: UsuarioAtualizar,
    @CurrentUser() admin: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    return this.usuarios.atualizar(id, d, admin, ctx(req));
  }

  @RequirePermission('users.manage')
  @Post(':id/redefinir-senha')
  @HttpCode(200)
  redefinirSenha(
    @Param('id', uuid) id: string,
    @CurrentUser() admin: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    return this.usuarios.redefinirSenha(id, admin, ctx(req));
  }

  @RequirePermission('users.manage')
  @Post(':id/desativar')
  @HttpCode(204)
  async desativar(
    @Param('id', uuid) id: string,
    @CurrentUser() admin: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    await this.usuarios.desativar(id, admin, ctx(req));
  }

  @RequirePermission('users.manage')
  @Post(':id/reativar')
  @HttpCode(204)
  async reativar(
    @Param('id', uuid) id: string,
    @CurrentUser() admin: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    await this.usuarios.reativar(id, admin, ctx(req));
  }

  @RequirePermission('users.manage')
  @Post(':id/derrubar-sessoes')
  @HttpCode(204)
  async derrubarSessoes(
    @Param('id', uuid) id: string,
    @CurrentUser() admin: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    await this.usuarios.derrubarSessoes(id, admin, ctx(req));
  }
}
