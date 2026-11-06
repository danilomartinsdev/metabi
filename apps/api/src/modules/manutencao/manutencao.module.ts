import { Global, Module } from '@nestjs/common';
import { ManutencaoController } from './manutencao.controller.js';
import { ManutencaoService } from './manutencao.service.js';

@Global()
@Module({ controllers: [ManutencaoController], providers: [ManutencaoService], exports: [ManutencaoService] })
export class ManutencaoModule {}
