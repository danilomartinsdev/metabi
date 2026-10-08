import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PresencaService } from './presenca.service.js';
import { SenhaService } from './senha.service.js';
import { SessaoService } from './sessao.service.js';
import { TokenService } from './token.service.js';
import { UsuarioLoader } from './usuario-loader.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, PresencaService, SenhaService, SessaoService, TokenService, UsuarioLoader],
  exports: [PresencaService, SenhaService, SessaoService, TokenService, UsuarioLoader],
})
export class AuthModule {}
