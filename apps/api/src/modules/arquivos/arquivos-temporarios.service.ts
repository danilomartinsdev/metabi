import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '../../common/errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export type TipoArquivo = 'pedidos' | 'faturamento' | 'notas';
const VALIDADE_MS = 2 * 60 * 60 * 1000;

/**
 * Guarda o arquivo da prévia de uma importação até o "confirmar". Fica no banco (não em disco) para
 * funcionar em serverless, onde cada requisição pode cair numa instância diferente.
 * O arquivo pertence a quem enviou: só o mesmo usuário o recupera.
 */
@Injectable()
export class ArquivosTemporariosService {
  constructor(private readonly prisma: PrismaService) {}

  async guardar(tipo: TipoArquivo, hash: string, usuarioId: string, arquivoNome: string, conteudo: Buffer) {
    const agora = new Date();
    await this.prisma.arquivoTemporario.deleteMany({ where: { expiraEm: { lt: agora } } });
    const expiraEm = new Date(agora.getTime() + VALIDADE_MS);
    // Prisma 7 recebe Bytes como Uint8Array de ArrayBuffer (cópia do Buffer).
    const bytes = new Uint8Array(conteudo);
    await this.prisma.arquivoTemporario.upsert({
      where: { hash_usuarioId_tipo: { hash, usuarioId, tipo } },
      update: { arquivoNome, conteudo: bytes, expiraEm },
      create: { hash, usuarioId, tipo, arquivoNome, conteudo: bytes, expiraEm },
    });
  }

  /** Arquivo da prévia de `usuarioId`; 404 se não existe, é de outro usuário ou expirou. */
  async recuperar(
    tipo: TipoArquivo,
    hash: string,
    usuarioId: string,
  ): Promise<{ arquivoNome: string; conteudo: Buffer }> {
    const a = await this.prisma.arquivoTemporario.findUnique({
      where: { hash_usuarioId_tipo: { hash, usuarioId, tipo } },
    });
    if (!a || a.expiraEm < new Date()) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        'Prévia não encontrada ou expirada. Envie o arquivo de novo.',
      );
    }
    return { arquivoNome: a.arquivoNome, conteudo: Buffer.from(a.conteudo) };
  }

  async descartar(tipo: TipoArquivo, hash: string, usuarioId: string) {
    await this.prisma.arquivoTemporario.deleteMany({ where: { hash, usuarioId, tipo } });
  }
}
