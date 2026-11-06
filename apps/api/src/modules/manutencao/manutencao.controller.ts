import { timingSafeEqual } from 'node:crypto';
import { Controller, Get, Headers, HttpStatus, Inject } from '@nestjs/common';
import { Public } from '../../common/auth/decorators.js';
import { ApiException, Erros } from '../../common/errors.js';
import { ENV, type Env } from '../../config/env.js';
import { ManutencaoService } from './manutencao.service.js';

@Controller('manutencao')
export class ManutencaoController {
  constructor(
    private readonly service: ManutencaoService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Chamada pelo Vercel Cron (1x por dia). A Vercel manda "Authorization: Bearer <CRON_SECRET>"; sem
   * CRON_SECRET configurada a rota não existe (404) — a limpeza segue rodando após cada importação.
   */
  @Public()
  @Get('limpeza')
  async limpeza(@Headers('authorization') authorization?: string) {
    const segredo = this.env.CRON_SECRET;
    if (!segredo) throw Erros.naoEncontrado();
    const esperado = Buffer.from(`Bearer ${segredo}`);
    const recebido = Buffer.from(authorization ?? '');
    if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Não autorizado.');
    }
    return this.service.limpar();
  }
}
