import { Injectable } from '@nestjs/common';
import {
  type ClientesResumo,
  type DimensaoRanking,
  type Filtros,
  type Kpi,
  normalizarNome,
  type PedidoLinha,
  type PedidosQuery,
  REGIAO_ENUM_ROTULO,
  type Ranking,
  type RegiaoEnum,
  type VisaoGeral,
} from '@meta-bi/shared';
import type { UsuarioAutenticado } from '../../common/auth/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ScopedPedidosRepository } from '../pedidos/scoped-pedidos.repository.js';
import {
  acumuladoPorSegmento,
  agrupar,
  atingimentoAcumulado,
  deslocarMes,
  detalhamentoMensal,
  fracao,
  type LinhaVenda,
  mesesEntre,
  noPeriodo,
  serieMensal,
  somar,
  ticket,
  variacao,
  zero,
} from './metricas.js';

const D = Prisma.Decimal;
const mesDe = (d: Date) => d.toISOString().slice(0, 7);
const dataMes = (m: string) => new Date(`${m}-01T00:00:00Z`);

@Injectable()
export class DashboardService {
  constructor(
    private readonly pedidos: ScopedPedidosRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** Filtros (exceto período) → where do Prisma. Sempre combinado com o escopo pelo repositório. */
  private where(f: Filtros, comStatusDeVenda = true): Prisma.PedidoWhereInput {
    const e: Prisma.PedidoWhereInput[] = [];
    if (f.regiao.length) e.push({ regiao: { in: f.regiao } });
    if (f.uf.length) e.push({ uf: { in: f.uf } });
    if (f.gestor.length) e.push({ representanteId: { in: f.gestor } });
    if (f.status.length) e.push({ status: { codigo: { in: f.status } } });
    if (comStatusDeVenda) e.push({ status: { contaNoTotal: true } });
    if (f.segmento.length) {
      e.push({
        OR: f.segmento.map((s) =>
          s === 'SEM'
            ? { cliente: { segmentoOverride: null }, representante: { segmentoPadrao: null } }
            : {
                OR: [
                  { cliente: { segmentoOverride: s } },
                  { cliente: { segmentoOverride: null }, representante: { segmentoPadrao: s } },
                ],
              },
        ),
      });
    }
    if (f.q) {
      const q = f.q;
      e.push({
        OR: [
          { cliente: { nomeNormalizado: { contains: normalizarNome(q) } } },
          { numPedido: { contains: q } },
          { ordemCpr: { contains: q, mode: 'insensitive' } },
          { representante: { codigo: { contains: q, mode: 'insensitive' } } },
          { representante: { nomeExibicao: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    return { AND: e };
  }

  /** Período padrão: do início do ano até o último mês com dados (no escopo do usuário). */
  async periodo(u: UsuarioAutenticado, f: Filtros): Promise<{ de: string; ate: string }> {
    let ate = f.ate;
    if (!ate) {
      const ultima = await this.pedidos.ultimaCompetencia(u, this.where(f));
      ate = ultima ? mesDe(ultima) : mesDe(new Date());
    }
    const de = f.de ?? `${ate.slice(0, 4)}-01`;
    return { de: de > ate ? ate : de, ate };
  }

  private async linhas(u: UsuarioAutenticado, f: Filtros, de: string, ate: string): Promise<LinhaVenda[]> {
    const rows = await this.pedidos.findMany(u, {
      where: { AND: [this.where(f), { competencia: { gte: dataMes(de), lte: dataMes(ate) } }] },
      select: {
        valor: true,
        competencia: true,
        uf: true,
        regiao: true,
        representanteId: true,
        clienteId: true,
        representante: { select: { nomeExibicao: true, segmentoPadrao: true } },
        cliente: { select: { nomeOriginal: true, segmentoOverride: true } },
      },
    });
    return rows.map((r) => ({
      valor: r.valor,
      mes: mesDe(r.competencia),
      uf: r.uf,
      regiao: r.regiao,
      gestorId: r.representanteId,
      gestorNome: r.representante.nomeExibicao,
      clienteId: r.clienteId,
      clienteNome: r.cliente.nomeOriginal,
      segmento: r.cliente.segmentoOverride ?? r.representante.segmentoPadrao,
    }));
  }

  async visaoGeral(u: UsuarioAutenticado, f: Filtros): Promise<VisaoGeral> {
    const { de, ate } = await this.periodo(u, f);
    const n = mesesEntre(de, ate).length;
    const ano = Number(ate.slice(0, 4));
    const inicio = [
      deslocarMes(de, -n),
      deslocarMes(de, -12),
      deslocarMes(ate, -11),
      `${ano - 1}-01`,
    ].sort()[0]!;
    const todas = await this.linhas(u, f, inicio, `${ano}-12`);

    const atual = noPeriodo(todas, de, ate);
    const anterior = noPeriodo(todas, deslocarMes(de, -n), deslocarMes(ate, -n));
    const anoAnt = noPeriodo(todas, deslocarMes(de, -12), deslocarMes(ate, -12));
    const mesesSerie = mesesEntre(deslocarMes(ate, -11), ate);
    const ultimos12 = noPeriodo(todas, mesesSerie[0]!, ate);

    const kpi = (f2: (ls: LinhaVenda[]) => Prisma.Decimal): Kpi => {
      const v = f2(atual);
      const ma = f2(anterior);
      const aa = f2(anoAnt);
      return {
        valor: v.toFixed(2),
        mesAnterior: { anterior: ma.toFixed(2), pct: variacao(v, ma) },
        anoAnterior: { anterior: aa.toFixed(2), pct: variacao(v, aa) },
        serie: serieMensal(ultimos12, mesesSerie, f2).map((s) => ({ mes: s.mes, valor: s.valor.toFixed(2) })),
      };
    };
    const totalDe = (ls: LinhaVenda[]) => somar(ls).total;
    const qtdDe = (ls: LinhaVenda[]) => new D(ls.length);
    const ticketDe = (ls: LinhaVenda[]) => {
      const s = somar(ls);
      return ticket(s.total, s.qtd) ?? zero();
    };
    const pctPublico = (ls: LinhaVenda[]) =>
      fracao(totalDe(ls.filter((l) => l.segmento === 'PUBLICO')), totalDe(ls));

    // Total vendido por intervalo de meses, com o faturamento manual nos meses sem pedidos.
    const manual = await this.totaisManuais(u, f);
    const totalPeriodo = (a: string, b: string) =>
      mesesEntre(a, b).reduce((s, m) => s.plus(manual?.get(m) ?? totalDe(noPeriodo(todas, m, m))), zero());
    const kpiTotal = (): Kpi => {
      const v = totalPeriodo(de, ate);
      const ma = totalPeriodo(deslocarMes(de, -n), deslocarMes(ate, -n));
      const aa = totalPeriodo(deslocarMes(de, -12), deslocarMes(ate, -12));
      return {
        valor: v.toFixed(2),
        mesAnterior: { anterior: ma.toFixed(2), pct: variacao(v, ma) },
        anoAnterior: { anterior: aa.toFixed(2), pct: variacao(v, aa) },
        serie: mesesSerie.map((m) => ({ mes: m, valor: totalPeriodo(m, m).toFixed(2) })),
      };
    };

    // Evolução mensal: ignora o filtro de mês (usa o ano de "até").
    const metas = await this.metasMensais(u, f, ano);
    const realMes = new Map(
      Array.from({ length: 12 }, (_, i) => {
        const m = `${ano}-${String(i + 1).padStart(2, '0')}`;
        return [i + 1, totalPeriodo(m, m)] as const;
      }),
    );
    const evolucao = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return {
        mes: i + 1,
        real: realMes.get(i + 1)!.toFixed(2),
        anoAnterior: totalPeriodo(`${ano - 1}-${m}`, `${ano - 1}-${m}`).toFixed(2),
        meta: metas?.get(i + 1)?.toFixed(2) ?? null,
      };
    });

    return {
      periodo: { de, ate },
      kpis: {
        total: kpiTotal(),
        qtd: kpi(qtdDe),
        ticket: kpi(ticketDe),
        pctPublico: {
          valor: pctPublico(atual),
          anoAnterior: pctPublico(anoAnt),
          serie: mesesSerie.map((mes) => ({ mes, valor: pctPublico(noPeriodo(ultimos12, mes, mes)) })),
        },
      },
      contagens: {
        estados: new Set(atual.map((l) => l.uf)).size,
        regioes: new Set(atual.map((l) => l.regiao)).size,
        gestores: new Set(atual.map((l) => l.gestorId)).size,
        clientes: new Set(atual.map((l) => l.clienteId)).size,
      },
      evolucao: {
        ano,
        meses: evolucao,
        atingimento: atingimentoAcumulado(realMes, metas, Number(ate.slice(5, 7))),
      },
      porRegiao: agrupar(
        atual,
        (l) => l.regiao,
        (l) => REGIAO_ENUM_ROTULO[l.regiao as RegiaoEnum] ?? l.regiao,
      ),
      porSegmento: agrupar(
        atual,
        (l) => l.segmento ?? 'SEM',
        (l) => rotuloSegmento(l.segmento),
      ),
      topGestores: agrupar(
        atual,
        (l) => l.gestorId,
        (l) => l.gestorNome,
      ).slice(0, 10),
      detalhamentoMensal: detalhamentoMensal(totalPeriodo, de, ate),
      acumuladoSegmento: this.comTotalManual(
        acumuladoPorSegmento(todas, de, ate),
        totalPeriodo(de, ate),
        totalPeriodo(deslocarMes(de, -12), deslocarMes(ate, -12)),
      ),
    };
  }

  /**
   * Faturamento manual (FaturamentoHistorico) por mês "AAAA-MM", só nos meses sem nenhum pedido importado.
   * É um total da empresa: vale só para escopo "todos" e sem filtros (mesmo critério das metas); senão null.
   */
  private async totaisManuais(
    u: UsuarioAutenticado,
    f: Filtros,
  ): Promise<Map<string, Prisma.Decimal> | null> {
    if (u.escopo.tipo !== 'todos') return null;
    if (f.regiao.length || f.uf.length || f.gestor.length || f.segmento.length || f.status.length || f.q) {
      return null;
    }
    const [linhas, meses] = await Promise.all([
      this.prisma.faturamentoHistorico.findMany(),
      this.mesesDisponiveis(u),
    ]);
    if (!linhas.length) return null;
    const comPedidos = new Set(meses);
    const m = new Map<string, Prisma.Decimal>();
    for (const l of linhas) {
      const chave = `${l.ano}-${String(l.mes).padStart(2, '0')}`;
      if (!comPedidos.has(chave)) m.set(chave, l.valor);
    }
    return m;
  }

  /** Total do acumulado com o faturamento manual (os segmentos seguem só com pedidos). */
  private comTotalManual(
    a: VisaoGeral['acumuladoSegmento'],
    atual: Prisma.Decimal,
    anterior: Prisma.Decimal,
  ): VisaoGeral['acumuladoSegmento'] {
    return {
      ...a,
      total: { atual: atual.toFixed(2), anterior: anterior.toFixed(2), pct: variacao(atual, anterior) },
    };
  }

  /**
   * Meta comparável aos dados que o usuário vê: gestores filtrados (∩ escopo), representantes do escopo,
   * ou a meta total. Escopo por região não tem meta correspondente → null.
   */
  private async metasMensais(
    u: UsuarioAutenticado,
    f: Filtros,
    ano: number,
  ): Promise<Map<number, Prisma.Decimal> | null> {
    let reps: string[] | null = null;
    // Escopo por região não tem meta correspondente — e o filtro de gestor não pode abrir metas fora do escopo.
    if (u.escopo.tipo === 'regiao') return null;
    if (u.escopo.tipo === 'representantes') {
      reps = f.gestor.length
        ? f.gestor.filter((g) => u.escopo.representanteIds.includes(g))
        : u.escopo.representanteIds;
    } else if (f.gestor.length) {
      reps = f.gestor;
    } else if (f.regiao.length || f.uf.length || f.segmento.length) {
      return null;
    }
    const metas = await this.prisma.meta.findMany({
      where: { ano, representanteId: reps === null ? null : { in: reps } },
      select: { mes: true, valor: true },
    });
    if (!metas.length) return null;
    const m = new Map<number, Prisma.Decimal>();
    for (const x of metas) m.set(x.mes, (m.get(x.mes) ?? zero()).plus(x.valor));
    return m;
  }

  async ranking(u: UsuarioAutenticado, f: Filtros, dim: DimensaoRanking): Promise<Ranking> {
    const { de, ate } = await this.periodo(u, f);
    const ls = await this.linhas(u, f, de, ate);
    const linhas =
      dim === 'gestores'
        ? agrupar(
            ls,
            (l) => l.gestorId,
            (l) => l.gestorNome,
          )
        : dim === 'estados'
          ? agrupar(
              ls,
              (l) => l.uf,
              (l) => l.uf,
            )
          : agrupar(
              ls,
              (l) => l.regiao,
              (l) => REGIAO_ENUM_ROTULO[l.regiao as RegiaoEnum] ?? l.regiao,
            );
    const s = somar(ls);
    return {
      periodo: { de, ate },
      linhas,
      total: { total: s.total.toFixed(2), qtd: s.qtd, ticket: ticket(s.total, s.qtd)?.toFixed(2) ?? null },
    };
  }

  async clientes(u: UsuarioAutenticado, f: Filtros): Promise<ClientesResumo> {
    const { de, ate } = await this.periodo(u, f);
    const ls = await this.linhas(u, f, de, ate);
    const ranking = agrupar(
      ls,
      (l) => l.clienteId,
      (l) => l.clienteNome,
    );
    const ids = ranking.map((r) => r.chave);
    // Cliente novo: nenhum pedido (no escopo) antes do início do período.
    const antigos = new Set(
      (
        await this.pedidos.findMany(u, {
          where: { clienteId: { in: ids }, competencia: { lt: dataMes(de) } },
          select: { clienteId: true },
          distinct: ['clienteId'],
        })
      ).map((p) => p.clienteId),
    );
    const meses = new Map<string, Set<string>>();
    for (const l of ls) meses.set(l.clienteId, (meses.get(l.clienteId) ?? new Set()).add(l.mes));
    const enriquecido = ranking.map((r) => ({
      ...r,
      meses: meses.get(r.chave)?.size ?? 0,
      novo: !antigos.has(r.chave),
    }));
    return {
      periodo: { de, ate },
      ranking: enriquecido,
      novos: enriquecido.filter((r) => r.novo).length,
      recorrentes: enriquecido.filter((r) => r.meses > 1).length,
      total: enriquecido.length,
    };
  }

  async listarPedidos(u: UsuarioAutenticado, q: PedidosQuery) {
    const { data, total, valorTotal, periodo } = await this.consultarPedidos(u, q, {
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    return { data, meta: { page: q.page, pageSize: q.pageSize, total, valorTotal }, periodo };
  }

  /** Todos os pedidos do filtro (no escopo), para exportação; até `limite` linhas. */
  async pedidosParaExportar(
    u: UsuarioAutenticado,
    q: Filtros & Pick<PedidosQuery, 'sort' | 'dir'>,
    limite: number,
  ) {
    return this.consultarPedidos(u, q, { take: limite });
  }

  private async consultarPedidos(
    u: UsuarioAutenticado,
    q: Filtros & Pick<PedidosQuery, 'sort' | 'dir'>,
    pagina: { skip?: number; take: number },
  ) {
    const { de, ate } = await this.periodo(u, q);
    const where: Prisma.PedidoWhereInput = {
      AND: [this.where(q, false), { competencia: { gte: dataMes(de), lte: dataMes(ate) } }],
    };
    const ordem: Record<PedidosQuery['sort'], Prisma.PedidoOrderByWithRelationInput> = {
      dtEmissao: { dtEmissao: q.dir },
      valor: { valor: q.dir },
      numPedido: { numPedido: q.dir },
      uf: { uf: q.dir },
      cliente: { cliente: { nomeNormalizado: q.dir } },
      representante: { representante: { nomeExibicao: q.dir } },
    };
    const [rows, total, soma] = await Promise.all([
      this.pedidos.findMany(u, {
        where,
        orderBy: [ordem[q.sort], { focoId: 'desc' }],
        ...pagina,
        include: {
          status: { select: { codigo: true, descricao: true, cor: true } },
          cliente: { select: { nomeOriginal: true, segmentoOverride: true } },
          representante: { select: { nomeExibicao: true, segmentoPadrao: true } },
        },
      }),
      this.pedidos.count(u, where),
      this.pedidos.soma(u, where),
    ]);
    const data: PedidoLinha[] = rows.map((p) => ({
      id: p.id,
      focoId: p.focoId,
      numPedido: p.numPedido,
      ordemCpr: p.ordemCpr,
      dtEmissao: p.dtEmissao.toISOString().slice(0, 10),
      dtEntrega: p.dtEntrega?.toISOString().slice(0, 10) ?? null,
      status: p.status,
      cliente: p.cliente.nomeOriginal,
      uf: p.uf,
      regiao: REGIAO_ENUM_ROTULO[p.regiao as RegiaoEnum],
      gestor: p.representante.nomeExibicao,
      segmento: rotuloSegmento(p.cliente.segmentoOverride ?? p.representante.segmentoPadrao),
      valor: p.valor.toFixed(2),
    }));
    return { data, total, valorTotal: (soma ?? new Prisma.Decimal(0)).toFixed(2), periodo: { de, ate } };
  }

  /** Meses com dados (no escopo) — alimenta o seletor de período. */
  async mesesDisponiveis(u: UsuarioAutenticado): Promise<string[]> {
    const r = await this.pedidos.findMany(u, {
      select: { competencia: true },
      distinct: ['competencia'],
      orderBy: { competencia: 'asc' },
    });
    return r.map((x) => mesDe(x.competencia));
  }
}

function rotuloSegmento(s: string | null): string {
  return s === 'PUBLICO' ? 'Público' : s === 'PRIVADO' ? 'Privado' : 'Sem segmento';
}
