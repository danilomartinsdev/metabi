import { Module } from '@nestjs/common';
import { LimpezaController } from './limpeza.controller.js';
import { PedidosEscritaRepository } from '../pedidos/scoped-pedidos.repository.js';
import { LimpezaService } from './limpeza.service.js';

@Module({ controllers: [LimpezaController], providers: [LimpezaService, PedidosEscritaRepository] })
export class LimpezaModule {}
