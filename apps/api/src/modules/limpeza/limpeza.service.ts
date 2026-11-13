import { HttpStatus, Injectable } from '@nestjs/common';
import type { LimpezaAno, LimpezaArea, LimpezaExecutar, LimpezaResultado } from '@metabi/shared';
import { ApiException } from '../../common/errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PedidosEscritaRepository } from '../pedidos/scoped-pedidos.repository.js';

const vazio = (): Record<LimpezaArea, number> => ({
  // eslint-disable-next-line no-restricted-syntax -- chave da área "pedidos" no resumo, não a relação do Prisma
  pedidos: 0,
  faturamento: 0,
  'faturamento-manual': 0,
  'notas-fiscais': 0,
  metas: 0,
});

/**
 * Apaga os dados de um ano, área por área (só Admin; a rota já exige).
 * Nunca toca em usuários, papéis, cadastros (representantes, clientes, status) nem na auditoria.
 */
@Injectable()
export class LimpezaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pedidos: PedidosEscritaRepository,
  ) {}

  /** Anos que têm algum dado, com a contagem por área. */
  async resumo(): Promise<LimpezaAno[]> {
    const [pedidos, dias, historico, manual, notas, metas] = await Promise.all([
      this.pedidos.contarPorCompetencia(),
      this.prisma.faturamentoDia.groupBy({ by: ['ano'], _count: { _all: true } }),
      this.prisma.faturamentoHistorico.groupBy({ by: ['ano'], _count: { _all: true } }),
      this.prisma.faturamentoManual.groupBy({ by: ['ano'], _count: { _all: true } }),
      this.prisma.notaFiscalItem.groupBy({ by: ['ano'], _count: { _all: true } }),
      this.prisma.meta.groupBy({ by: ['ano'], _count: { _all: true } }),
    ]);
    const mapa = new Map<number, Record<LimpezaArea, number>>();
    const soma = (ano: number, area: LimpezaArea, n: number) => {
      const c = mapa.get(ano) ?? vazio();
      c[area] += n;
      mapa.set(ano, c);
    };
    for (const p of pedidos) soma(p.competencia.getUTCFullYear(), 'pedidos', p._count._all);
    for (const d of dias) soma(d.ano, 'faturamento', d._count._all);
    for (const h of historico) soma(h.ano, 'faturamento-manual', h._count._all);
    for (const m of manual) soma(m.ano, 'faturamento-manual', m._count._all);
    for (const n of notas) soma(n.ano, 'notas-fiscais', n._count._all);
    for (const m of metas) soma(m.ano, 'metas', m._count._all);
    return [...mapa.entries()].map(([ano, contagens]) => ({ ano, contagens })).sort((a, b) => b.ano - a.ano);
  }

  /** Tudo ou nada: uma única transação. */
  async executar(d: LimpezaExecutar): Promise<LimpezaResultado> {
    if (d.confirmacao !== d.ano) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', 'A confirmação não confere com o ano escolhido.');
    }
    const areas = new Set(d.areas);
    const r: LimpezaResultado = { ...vazio(), ano: d.ano };
    await this.prisma.$transaction(
      async (tx) => {
        if (areas.has('pedidos')) {
          r.pedidos = (await this.pedidos.apagarPorAno(tx, d.ano)).count;
        }
        if (areas.has('faturamento')) {
          r.faturamento = (await tx.faturamentoDia.deleteMany({ where: { ano: d.ano } })).count;
          await tx.faturamentoLote.deleteMany({ where: { ano: d.ano } });
        }
        if (areas.has('faturamento-manual')) {
          r['faturamento-manual'] =
            (await tx.faturamentoHistorico.deleteMany({ where: { ano: d.ano } })).count +
            (await tx.faturamentoManual.deleteMany({ where: { ano: d.ano } })).count;
        }
        if (areas.has('notas-fiscais')) {
          r['notas-fiscais'] = (await tx.notaFiscalItem.deleteMany({ where: { ano: d.ano } })).count;
          // Importações que ficaram sem nenhum item não têm mais o que mostrar.
          await tx.notaFiscalLote.deleteMany({ where: { registros: { none: {} } } });
        }
        if (areas.has('metas')) {
          r.metas = (await tx.meta.deleteMany({ where: { ano: d.ano } })).count;
        }
      },
      { timeout: 60_000 },
    );
    return r;
  }
}
