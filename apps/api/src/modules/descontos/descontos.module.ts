import { Module } from '@nestjs/common';
import { DescontosController } from './descontos.controller.js';
import { DescontosService } from './descontos.service.js';

@Module({
  controllers: [DescontosController],
  providers: [DescontosService],
})
export class DescontosModule {}
