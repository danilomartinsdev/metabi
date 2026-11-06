import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Quantas importações de pedidos recentes mantêm o "desfazer" (itens com o snapshot do que foi alterado). */
export const LOTES_MANTIDOS = 3;
const DIA_MS = 86_400_000;

export interface ResultadoLimpeza {
  lotesImportacao: number;
  itensDeLotesRevertidos: number;
  arquivosTemporarios: number;
  tokensImpressao: number;
  tokensSenha: number;
  sessoes: number;
}

/**
 * Apaga o que só ocupa espaço no banco (Neon tem limite de armazenamento):
 * - importações de pedidos antigas: só as últimas {@link LOTES_MANTIDOS} ficam (com os itens do "desfazer");
 *   os itens de lotes já revertidos não servem mais;
 * - arquivos de prévia vencidos, tokens de impressão/senha vencidos e sessões vencidas.
 * Não mexe em pedidos, faturamento, notas fiscais, metas nem na auditoria.
 */
@Injectable()
export class ManutencaoService {
  private readonly logger = new Logger(ManutencaoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async limpar(agora = new Date()): Promise<ResultadoLimpeza> {
    // Pedidos que apontavam para um lote apagado ficam com ultimoLoteId nulo (onDelete: SetNull); o itens
    // do lote vão junto (cascade). Lotes mais novos continuam podendo ser desfeitos.
    const antigos = await this.prisma.importLote.findMany({
      orderBy: { createdAt: 'desc' },
      skip: LOTES_MANTIDOS,
      select: { id: true },
    });
    let lotesImportacao = 0;
    for (let i = 0; i < antigos.length; i += 500) {
      const ids = antigos.slice(i, i + 500).map((l) => l.id);
      lotesImportacao += (await this.prisma.importLote.deleteMany({ where: { id: { in: ids } } })).count;
    }

    const itensDeLotesRevertidos = (
      await this.prisma.importLoteItem.deleteMany({ where: { lote: { status: 'REVERTIDO' } } })
    ).count;
    const arquivosTemporarios = (
      await this.prisma.arquivoTemporario.deleteMany({ where: { expiraEm: { lt: agora } } })
    ).count;
    const tokensImpressao = (
      await this.prisma.tokenImpressao.deleteMany({ where: { expiraEm: { lt: agora } } })
    ).count;
    const tokensSenha = (
      await this.prisma.tokenRedefinicaoSenha.deleteMany({ where: { expiraEm: { lt: agora } } })
    ).count;
    // Sessão vencida há mais de 1 dia (a família inteira já perdeu a validade; nada mais a reutiliza).
    const sessoes = (
      await this.prisma.sessao.deleteMany({ where: { expiraEm: { lt: new Date(agora.getTime() - DIA_MS) } } })
    ).count;

    const r = { lotesImportacao, itensDeLotesRevertidos, arquivosTemporarios, tokensImpressao, tokensSenha, sessoes };
    this.logger.log(`Limpeza: ${JSON.stringify(r)}`);
    return r;
  }

  /** Limpeza "de carona" (ex.: depois de uma importação): nunca derruba quem chamou. */
  async limparSemFalhar(): Promise<void> {
    try {
      await this.limpar();
    } catch (e) {
      this.logger.warn(`Falha na limpeza: ${(e as Error).message}`);
    }
  }
}
