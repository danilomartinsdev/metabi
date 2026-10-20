import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { type ErroLinha, type LinhaFocco, linhaFoccoSchema, type PreviaImportacao } from '@metabi/shared';
import { ApiException, Erros } from '../../common/errors.js';
import { REGIAO_ENUM } from '../../common/regiao.js';
import type { ContextoRequisicao, UsuarioAutenticado } from '../../common/auth/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ArquivosTemporariosService } from '../arquivos/arquivos-temporarios.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PedidosEscritaRepository } from '../pedidos/scoped-pedidos.repository.js';
import { ArquivoInvalidoError, type Formato, lerRelatorio } from './parser.js';

interface Analise {
  previa: PreviaImportacao;
  validas: LinhaFocco[];
  novas: LinhaFocco[];
  alteradas: LinhaFocco[];
}

type PedidoExistente = Awaited<ReturnType<PedidosEscritaRepository['existentes']>>[number];

const dataISO = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pedidos: PedidosEscritaRepository,
    private readonly audit: AuditService,
    private readonly arquivos: ArquivosTemporariosService,
  ) {}

  /** Etapas 2 e 3: parse, validação e prévia. Guarda o arquivo original no banco até o confirmar. */
  async previa(buf: Buffer, arquivoNome: string, usuarioId: string): Promise<PreviaImportacao> {
    const hash = createHash('sha256').update(buf).digest('hex');
    const analise = await this.analisar(buf, hash, arquivoNome);
    // A prévia pertence a quem enviou: o confirmar só aceita o mesmo usuário (e usa o nome original guardado).
    await this.arquivos.guardar('pedidos', hash, usuarioId, arquivoNome, buf);
    return analise.previa;
  }

  private async analisar(buf: Buffer, hash: string, arquivoNome: string): Promise<Analise> {
    let formato: Formato;
    let brutas;
    try {
      ({ formato, linhas: brutas } = lerRelatorio(buf));
    } catch (e) {
      if (e instanceof ArquivoInvalidoError)
        throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', e.message);
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Não foi possível ler o arquivo.');
    }

    const erros: ErroLinha[] = [];
    const validas: LinhaFocco[] = [];
    const vistos = new Set<number>();
    let ignorados = 0;
    for (const b of brutas) {
      // Linhas de total/rodapé (sem ID numérico e sem cliente) são ignoradas, não são erro.
      if (!/^\d+$/.test(b.id) && !b.cliente) {
        ignorados++;
        continue;
      }
      const r = linhaFoccoSchema.safeParse(b);
      if (!r.success) {
        erros.push({ linha: b.numeroLinha, mensagens: r.error.issues.map((i) => i.message) });
      } else if (vistos.has(r.data.id)) {
        erros.push({ linha: b.numeroLinha, mensagens: [`ID ${r.data.id} repetido no arquivo`] });
      } else {
        vistos.add(r.data.id);
        validas.push(r.data);
      }
    }

    const [existentes, reps, status, clientes, lote] = await Promise.all([
      this.pedidos.existentes(
        this.prisma,
        validas.map((l) => l.id),
      ),
      this.prisma.representante.findMany({ select: { id: true, codigo: true } }),
      this.prisma.statusPdv.findMany({ select: { id: true, codigo: true } }),
      this.prisma.cliente.findMany({ select: { id: true, nomeNormalizado: true } }),
      this.prisma.importLote.findFirst({
        where: { arquivoHash: hash, status: 'APLICADO' },
        select: { id: true },
      }),
    ]);
    const repPorId = new Map(reps.map((r) => [r.id, r.codigo]));
    const stPorId = new Map(status.map((s) => [s.id, s.codigo]));
    const cliPorId = new Map(clientes.map((c) => [c.id, c.nomeNormalizado]));
    const porFoco = new Map(existentes.map((p) => [p.focoId, p]));

    const novas: LinhaFocco[] = [];
    const alteradas: LinhaFocco[] = [];
    for (const l of validas) {
      const atual = porFoco.get(l.id);
      if (!atual) novas.push(l);
      else if (this.mudou(atual, l, repPorId, stPorId, cliPorId)) alteradas.push(l);
    }

    const codigosRep = new Set(reps.map((r) => r.codigo));
    const codigosSt = new Set(status.map((s) => s.codigo));
    const nomesCli = new Set(clientes.map((c) => c.nomeNormalizado));
    const datas = validas.map((l) => l.dtEmissao).sort();
    const centavos = validas.reduce((s, l) => s + BigInt(l.valor.replace('.', '')), 0n);

    return {
      validas,
      novas,
      alteradas,
      previa: {
        hash,
        arquivoNome,
        formato,
        totalLinhas: brutas.length,
        novos: novas.length,
        atualizados: alteradas.length,
        inalterados: validas.length - novas.length - alteradas.length,
        ignorados,
        erros,
        representantesNovos: [...new Set(validas.map((l) => l.representante))]
          .filter((c) => !codigosRep.has(c))
          .sort(),
        clientesNovos: new Set(validas.map((l) => l.clienteNormalizado).filter((n) => !nomesCli.has(n))).size,
        statusNovos: [...new Set(validas.map((l) => l.status))].filter((c) => !codigosSt.has(c)).sort(),
        periodo: datas.length ? { de: datas[0]!, ate: datas.at(-1)! } : null,
        valorTotal: new Prisma.Decimal(centavos.toString()).div(100).toFixed(2),
        jaImportado: !!lote,
      },
    };
  }

  private mudou(
    p: PedidoExistente,
    l: LinhaFocco,
    rep: Map<string, string>,
    st: Map<string, string>,
    cli: Map<string, string>,
  ): boolean {
    return (
      p.numPedido !== l.numPedido ||
      (p.ordemCpr ?? null) !== l.ordemCpr ||
      dataISO(p.dtEmissao) !== l.dtEmissao ||
      dataISO(p.dtEntrega) !== l.dtEntrega ||
      st.get(p.statusId) !== l.status ||
      cli.get(p.clienteId) !== l.clienteNormalizado ||
      p.uf !== l.uf ||
      rep.get(p.representanteId) !== l.representante ||
      !p.valor.equals(l.valor)
    );
  }

  /** Etapas 4 e 5: confirma e grava tudo numa transação, criando um lote reversível. */
  async confirmar(hash: string, usuario: UsuarioAutenticado, ctx: ContextoRequisicao) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw Erros.naoEncontrado();
    const { arquivoNome, conteudo: buf } = await this.arquivos.recuperar('pedidos', hash, usuario.id);
    const { previa, validas, novas, alteradas } = await this.analisar(buf, hash, arquivoNome);
    if (validas.length === 0)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Nenhuma linha válida.');

    const lote = await this.prisma.$transaction(
      async (tx) => {
        const repIds = await this.garantirRepresentantes(tx, validas);
        const stIds = await this.garantirStatus(tx, validas);
        const cliIds = await this.garantirClientes(tx, validas);

        const lote = await tx.importLote.create({
          data: {
            usuarioId: usuario.id,
            arquivoNome: arquivoNome.slice(0, 200),
            arquivoHash: hash,
            arquivoTamanho: buf.length,
            arquivoPath: `${hash}.bin`,
            novos: novas.length,
            atualizados: alteradas.length,
            inalterados: previa.inalterados,
            ignorados: previa.ignorados,
            erros: previa.erros.length,
          },
        });

        const dados = (l: LinhaFocco) => ({
          numPedido: l.numPedido,
          ordemCpr: l.ordemCpr,
          dtEmissao: new Date(`${l.dtEmissao}T00:00:00Z`),
          dtEntrega: l.dtEntrega ? new Date(`${l.dtEntrega}T00:00:00Z`) : null,
          competencia: new Date(`${l.competencia}T00:00:00Z`),
          statusId: stIds.get(l.status)!,
          clienteId: cliIds.get(l.clienteNormalizado)!,
          representanteId: repIds.get(l.representante)!,
          uf: l.uf,
          regiao: REGIAO_ENUM[l.regiao],
          valor: new Prisma.Decimal(l.valor),
          ultimoLoteId: lote.id,
        });

        for (const l of novas) await this.pedidos.criar(tx, { focoId: l.id, ...dados(l) });
        if (novas.length) {
          await tx.importLoteItem.createMany({
            data: novas.map((l) => ({ loteId: lote.id, focoId: l.id, acao: 'CRIADO' as const })),
          });
        }

        const anteriores = new Map(
          (
            await this.pedidos.existentes(
              tx,
              alteradas.map((l) => l.id),
            )
          ).map((p) => [p.focoId, p]),
        );
        for (const l of alteradas) {
          const antes = anteriores.get(l.id)!;
          await tx.importLoteItem.create({
            data: {
              loteId: lote.id,
              focoId: l.id,
              acao: 'ATUALIZADO',
              snapshotAnterior: this.snapshot(antes),
            },
          });
          await this.pedidos.atualizar(tx, l.id, dados(l));
        }
        return lote;
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    await this.audit.registrar({
      acao: 'import.executado',
      usuarioId: usuario.id,
      entidade: 'ImportLote',
      entidadeId: lote.id,
      detalhes: {
        arquivo: arquivoNome,
        novos: novas.length,
        atualizados: alteradas.length,
        erros: previa.erros.length,
      },
      ctx,
    });
    return {
      loteId: lote.id,
      novos: novas.length,
      atualizados: alteradas.length,
      inalterados: previa.inalterados,
    };
  }

  private snapshot(p: PedidoExistente): Prisma.InputJsonValue {
    return {
      numPedido: p.numPedido,
      ordemCpr: p.ordemCpr,
      dtEmissao: dataISO(p.dtEmissao),
      dtEntrega: dataISO(p.dtEntrega),
      competencia: dataISO(p.competencia),
      statusId: p.statusId,
      clienteId: p.clienteId,
      representanteId: p.representanteId,
      uf: p.uf,
      regiao: p.regiao,
      valor: p.valor.toFixed(2),
      ultimoLoteId: p.ultimoLoteId,
    };
  }

  private async garantirRepresentantes(tx: Prisma.TransactionClient, linhas: LinhaFocco[]) {
    for (const codigo of new Set(linhas.map((l) => l.representante))) {
      await tx.representante.upsert({
        where: { codigo },
        update: {},
        // Representante novo entra como Privado (decisão de 2026-10-05; licitações são exceção ajustada à mão).
        create: { codigo, nomeExibicao: codigo, segmentoPadrao: 'PRIVADO' },
      });
    }
    const todos = await tx.representante.findMany({ select: { id: true, codigo: true } });
    return new Map(todos.map((r) => [r.codigo, r.id]));
  }

  private async garantirStatus(tx: Prisma.TransactionClient, linhas: LinhaFocco[]) {
    for (const codigo of new Set(linhas.map((l) => l.status))) {
      // Significado e "conta no total" são decisões pendentes: criado contando, editável no cadastro.
      await tx.statusPdv.upsert({ where: { codigo }, update: {}, create: { codigo, descricao: codigo } });
    }
    const todos = await tx.statusPdv.findMany({ select: { id: true, codigo: true } });
    return new Map(todos.map((s) => [s.codigo, s.id]));
  }

  private async garantirClientes(tx: Prisma.TransactionClient, linhas: LinhaFocco[]) {
    const ultimoNome = new Map<string, string>();
    for (const l of linhas) ultimoNome.set(l.clienteNormalizado, l.cliente);
    for (const [nomeNormalizado, nomeOriginal] of ultimoNome) {
      await tx.cliente.upsert({
        where: { nomeNormalizado },
        update: { nomeOriginal },
        create: { nomeNormalizado, nomeOriginal },
      });
    }
    const todos = await tx.cliente.findMany({
      where: { nomeNormalizado: { in: [...ultimoNome.keys()] } },
      select: { id: true, nomeNormalizado: true },
    });
    return new Map(todos.map((c) => [c.nomeNormalizado, c.id]));
  }

  async listarLotes() {
    return this.prisma.importLote.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        arquivoNome: true,
        arquivoTamanho: true,
        novos: true,
        atualizados: true,
        inalterados: true,
        ignorados: true,
        erros: true,
        status: true,
        createdAt: true,
        revertidoEm: true,
        usuario: { select: { nome: true } },
        revertidoPor: { select: { nome: true } },
      },
    });
  }

  /** Desfaz um lote: apaga pedidos criados e restaura os atualizados, se nenhum lote posterior os alterou. */
  async reverter(loteId: string, usuario: UsuarioAutenticado, ctx: ContextoRequisicao) {
    await this.prisma.$transaction(
      async (tx) => {
        const lote = await tx.importLote.findUnique({ where: { id: loteId }, include: { itens: true } });
        if (!lote) throw Erros.naoEncontrado();
        if (lote.status === 'REVERTIDO')
          throw new ApiException(HttpStatus.CONFLICT, 'CONFLICT', 'Lote já revertido.');

        const ids = lote.itens.map((i) => i.focoId);
        if ((await this.pedidos.tocadosDepois(tx, ids, lote.id)) > 0) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'CONFLICT',
            'Pedidos deste lote foram alterados por uma importação posterior. Reverta primeiro a mais recente.',
          );
        }

        await this.pedidos.apagar(
          tx,
          lote.itens.filter((i) => i.acao === 'CRIADO').map((i) => i.focoId),
        );
        for (const i of lote.itens.filter((i) => i.acao === 'ATUALIZADO')) {
          const s = i.snapshotAnterior as Record<string, string | null>;
          await this.pedidos.atualizar(tx, i.focoId, {
            numPedido: s.numPedido!,
            ordemCpr: s.ordemCpr,
            dtEmissao: new Date(`${s.dtEmissao}T00:00:00Z`),
            dtEntrega: s.dtEntrega ? new Date(`${s.dtEntrega}T00:00:00Z`) : null,
            competencia: new Date(`${s.competencia}T00:00:00Z`),
            statusId: s.statusId!,
            clienteId: s.clienteId!,
            representanteId: s.representanteId!,
            uf: s.uf!,
            regiao: s.regiao as PedidoExistente['regiao'],
            valor: new Prisma.Decimal(s.valor!),
            ultimoLoteId: s.ultimoLoteId,
          });
        }
        await tx.importLote.update({
          where: { id: lote.id },
          data: { status: 'REVERTIDO', revertidoEm: new Date(), revertidoPorId: usuario.id },
        });
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    await this.audit.registrar({
      acao: 'import.revertido',
      usuarioId: usuario.id,
      entidade: 'ImportLote',
      entidadeId: loteId,
      ctx,
    });
  }
}
