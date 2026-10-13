import { Module } from '@nestjs/common';
import { NotasFiscaisController } from './notas-fiscais.controller.js';
import { NotasFiscaisService } from './notas-fiscais.service.js';

@Module({
  controllers: [NotasFiscaisController],
  providers: [NotasFiscaisService],
})
export class NotasFiscaisModule {}
