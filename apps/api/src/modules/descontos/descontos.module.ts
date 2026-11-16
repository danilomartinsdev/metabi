import { Module } from '@nestjs/common';
import { DescontosController, PrecosController } from './descontos.controller.js';
import { DescontosService } from './descontos.service.js';
import { PrecosService } from './precos.service.js';

@Module({
  controllers: [DescontosController, PrecosController],
  providers: [DescontosService, PrecosService],
  exports: [DescontosService],
})
export class DescontosModule {}
