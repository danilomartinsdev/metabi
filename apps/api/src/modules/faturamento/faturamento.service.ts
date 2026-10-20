import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  COLUNAS_FATURAMENTO,
  type ComparacaoFaturamento,
  type ErroLinha,
  type FaturamentoComparativo,
  type FaturamentoMensal,
  type FaturamentoQuery,
  type FaturamentoResumo,
  type LinhaFaturamento,
  type LoteFaturamento,
  linhaFaturamentoSchema,
  type PreviaFaturamento,
  type TotaisFaturamento,
} from '@metabi/shared';
import type { ContextoRequisicao, UsuarioAutenticado } from '../../common/auth/types.js';
import { ApiException } from '../../common/errors.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ArquivosTemporariosService } from '../arquivos/arquivos-temporarios.service.js';
import { AuditService } from '../audit/audit.service.js';
import { deslocarMes, mesesEntre, variacao } from '../dashboard/metricas.js';
import { ArquivoInvalidoError, extrairLinhas, lerMatriz } from '../import/parser.js';

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const CAMPOS = ['bruto', 'antecipado', 'remessa', 'devolucao', 'dre'] as const;
type Campo = (typeof CAMPOS)[number];
type Somas = Record<Campo, Decimal>;

const zeros = (): Somas => ({
  bruto: new D(0),
  antecipado: new D(0),
  remessa: new D(0),
  devolucao: new D(0),
  dre: new D(0),
});
const somar = (a: Somas, l: Record<Campo, Decimal | string>) => {
  for (const c of CAMPOS) a[c] = a[c].plus(l[c]);
  return a;
};
const texto = (s: Somas): TotaisFaturamento =>
  Object.fromEntries(CAMPOS.map((c) => [c, s[c].toFixed(2)])) as unknown as TotaisFaturamento;
const isoDia = (d: Date) => d.toISOString().slice(0, 10);
const mesDe = (d: Date) => d.toISOString().slice(0, 7);
const dataMes = (m: string) => new Date(`${m}-01T00:00:00Z`);
/** Último dia do mês "AAAA-MM" (UTC). */
const fimMes = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0));
const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`;

interface Analise {
  previa: PreviaFaturamento;
  validas: LinhaFaturamento[];
  /** Meses (1–12) presentes no arquivo — só eles podem ser escolhidos (e substituídos) ao confirmar. */
  meses: number[];
}

/**
 * Faturamento diário da empresa (relatório do Focco). Domínio separado dos pedidos: não usa o escopo de
 * representantes — o controller exige escopo "todos" (é um número da empresa inteira).
 */
@Injectable()
export class FaturamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly arquivos: ArquivosTemporariosService,
  ) {}

  /** Lê, valida e resume o arquivo. Guarda o original no banco até o confirmar. */
  async previa(buf: Buffer, arquivoNome: string, usuarioId: string): Promise<PreviaFaturamento> {
    const hash = createHash('sha256').update(buf).digest('hex');
    const { previa } = await this.analisar(buf, hash, arquivoNome);
    // A prévia pertence a quem enviou: o confirmar só aceita o mesmo usuário.
    await this.arquivos.guardar('faturamento', hash, usuarioId, arquivoNome, buf);
    return previa;
  }

  private async analisar(buf: Buffer, hash: string, arquivoNome: string): Promise<Analise> {
    let brutas;
    try {
      brutas = extrairLinhas(lerMatriz(buf).matriz, COLUNAS_FATURAMENTO);
    } catch (e) {
      const msg = e instanceof ArquivoInvalidoError ? e.message : 'Não foi possível ler o arquivo.';
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', msg);
    }

    const erros: ErroLinha[] = [];
    const validas: LinhaFaturamento[] = [];
    const datas = new Set<string>();
    for (const b of brutas) {
      // Linhas de total/rodapé (sem empresa e sem data) são ignoradas, não são erro.
      if (!b.empresa && !b.data) continue;
      const r = linhaFaturamentoSchema.safeParse(b);
      if (!r.success) {
        erros.push({ linha: b.numeroLinha, mensagens: r.error.issues.map((i) => i.message) });
        continue;
      }
      if (datas.has(r.data.data)) {
        erros.push({ linha: b.numeroLinha, mensagens: [`Dia ${r.data.data} repetido no arquivo`] });
        continue;
      }
      datas.add(r.data.data);
      validas.push(r.data);
    }

    const anos = [...new Set(validas.map((l) => l.ano))];
    if (anos.length > 1) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION',
        `O arquivo tem dias de mais de um ano (${anos.sort().join(', ')}). Envie um arquivo por ano.`,
      );
    }
    const ano = anos[0] ?? null;

    const porMes = new Map<number, { dias: number; dre: Decimal }>();
    const totais = zeros();
    for (const l of validas) {
      somar(totais, l);
      const m = porMes.get(l.mes) ?? { dias: 0, dre: new D(0) };
      m.dias++;
      m.dre = m.dre.plus(l.dre);
      porMes.set(l.mes, m);
    }
    // Reimportar substitui só os meses escolhidos entre os do arquivo (decisão de 2026-10-06):
    // importar outubro não apaga jan–set. A prévia mostra o que já está gravado em cada mês.
    const meses = [...porMes.keys()].sort((a, b) => a - b);
    const existentes =
      ano === null
        ? []
        : await this.prisma.faturamentoDia.groupBy({
            by: ['mes'],
            where: { ano, mes: { in: meses } },
            _count: { _all: true },
            _sum: { dre: true },
          });
    const existente = new Map(existentes.map((e) => [e.mes, e]));

    return {
      validas,
      meses,
      previa: {
        hash,
        arquivoNome,
        ano,
        dias: validas.length,
        meses: meses.map((mes) => {
          const v = porMes.get(mes)!;
          const e = existente.get(mes);
          return {
            mes,
            dias: v.dias,
            dre: v.dre.toFixed(2),
            diasExistentes: e?._count._all ?? 0,
            dreExistente: (e?._sum.dre ?? new D(0)).toFixed(2),
          };
        }),
        totais: texto(totais),
        diasSubstituidos: existentes.reduce((n, e) => n + e._count._all, 0),
        erros,
      },
    };
  }

  /**
   * Grava os meses escolhidos do arquivo da prévia (padrão: todos os do arquivo): apaga o que já estava
   * gravado nesses meses e grava os dias do arquivo. Os demais meses ficam intactos.
   */
  async confirmar(
    hash: string,
    mesesEscolhidos: number[] | undefined,
    usuario: UsuarioAutenticado,
    ctx: ContextoRequisicao,
  ) {
    const { arquivoNome, conteudo: buf } = await this.arquivos.recuperar('faturamento', hash, usuario.id);
    const analise = await this.analisar(buf, hash, arquivoNome);
    const { previa } = analise;
    if (!analise.validas.length || previa.ano === null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Nenhuma linha válida.');
    }
    if (previa.erros.length) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION',
        `O arquivo tem ${previa.erros.length} linha(s) com erro. Corrija e envie de novo.`,
      );
    }
    const ano = previa.ano;
    const meses = [...new Set(mesesEscolhidos ?? analise.meses)].sort((a, b) => a - b);
    const fora = meses.filter((m) => !analise.meses.includes(m));
    if (fora.length) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION',
        `Mês(es) ${fora.join(', ')} não estão no arquivo.`,
      );
    }
    const validas = analise.validas.filter((l) => meses.includes(l.mes));
    const totalDre = validas.reduce((t, l) => t.plus(l.dre), new D(0));

    const lote = await this.prisma.$transaction(async (tx) => {
      const novo = await tx.faturamentoLote.create({
        data: {
          ano,
          arquivoNome: arquivoNome,
          arquivoHash: hash,
          dias: validas.length,
          totalDre,
          usuarioId: usuario.id,
        },
      });
      const apagados = await tx.faturamentoDia.deleteMany({ where: { ano, mes: { in: meses } } });
      await tx.faturamentoDia.createMany({
        data: validas.map((l) => ({
          empresa: l.empresa,
          data: new Date(`${l.data}T00:00:00Z`),
          ano: l.ano,
          mes: l.mes,
          semana: l.semana,
          bruto: new D(l.bruto),
          antecipado: new D(l.antecipado),
          remessa: new D(l.remessa),
          devolucao: new D(l.devolucao),
          dre: new D(l.dre),
          loteId: novo.id,
        })),
      });
      return { ...novo, substituidos: apagados.count };
    });

    await this.audit.registrar({
      acao: 'faturamento.importado',
      usuarioId: usuario.id,
      entidade: 'FaturamentoLote',
      entidadeId: lote.id,
      detalhes: {
        ano,
        meses,
        dias: validas.length,
        substituidos: lote.substituidos,
        totalDre: totalDre.toFixed(2),
      },
      ctx,
    });
    await this.arquivos.descartar('faturamento', hash, usuario.id);
    return { loteId: lote.id, ano, meses, dias: validas.length, substituidos: lote.substituidos };
  }

  async lotes(): Promise<LoteFaturamento[]> {
    const ls = await this.prisma.faturamentoLote.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { usuario: { select: { nome: true } } },
    });
    return ls.map((l) => ({
      id: l.id,
      ano: l.ano,
      arquivoNome: l.arquivoNome,
      dias: l.dias,
      totalDre: l.totalDre.toFixed(2),
      usuario: l.usuario?.nome ?? null,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  /** Página de Faturamento: cards, evolução mensal, tabela mês a mês e séries diária/semanal. */
  async resumo(q: FaturamentoQuery): Promise<FaturamentoResumo> {
    const [ultimo, ultimoManual] = await Promise.all([
      this.prisma.faturamentoDia.findFirst({ orderBy: { data: 'desc' }, select: { data: true } }),
      this.prisma.faturamentoManual.findFirst({ orderBy: [{ ano: 'desc' }, { mes: 'desc' }] }),
    ]);
    const ultimoMes = [
      ultimo && mesDe(ultimo.data),
      ultimoManual && chaveMes(ultimoManual.ano, ultimoManual.mes),
    ]
      .filter((m): m is string => !!m)
      .sort()
      .at(-1);
    const ate = q.ate ?? ultimoMes ?? new Date().toISOString().slice(0, 7);
    const de0 = q.de ?? `${ate.slice(0, 4)}-01`;
    const de = de0 > ate ? ate : de0;
    const ano = Number(ate.slice(0, 4));

    // Uma consulta cobre o período, o mesmo período do ano anterior e os dois anos da evolução mensal.
    const inicio = [deslocarMes(de, -12), `${ano - 1}-01`].sort()[0]!;
    const dias = await this.prisma.faturamentoDia.findMany({
      where: { data: { gte: dataMes(inicio), lte: fimMes(ate) } },
      orderBy: { data: 'asc' },
    });
    const noPeriodo = (a: string, b: string) => dias.filter((d) => mesDe(d.data) >= a && mesDe(d.data) <= b);
    const manuais = await this.manuaisSemImportado(
      { ano: { gte: Number(inicio.slice(0, 4)), lte: ano } },
      new Set(dias.map((d) => mesDe(d.data))),
    );
    /** Soma dos dias importados + faturamento manual (como DRE) dos meses sem dias importados. */
    const somaDe = (a: string, b: string) => {
      const s = noPeriodo(a, b).reduce((t, l) => somar(t, l), zeros());
      for (const [k, v] of manuais) if (k >= a && k <= b) s.dre = s.dre.plus(v);
      return s;
    };

    const atual = somaDe(de, ate);
    const anterior = somaDe(deslocarMes(de, -12), deslocarMes(ate, -12));
    const kpis = Object.fromEntries(
      CAMPOS.map((c) => [
        c,
        {
          valor: atual[c].toFixed(2),
          anterior: anterior[c].toFixed(2),
          pct: variacao(atual[c], anterior[c]),
        },
      ]),
    ) as FaturamentoResumo['kpis'];

    const mesesAno = mesesEntre(`${ano}-01`, ate);
    const meses = mesesAno.map((m) => {
      const s = somaDe(m, m);
      const ant = somaDe(deslocarMes(m, -12), deslocarMes(m, -12));
      return { mes: Number(m.slice(5, 7)), ...texto(s), dreAnoAnterior: ant.dre.toFixed(2) };
    });

    const doPeriodo = noPeriodo(de, ate);
    const semanas = new Map<string, { ano: number; semana: number; inicio: string; dre: Decimal }>();
    for (const d of doPeriodo) {
      const k = `${d.ano}-${String(d.semana).padStart(2, '0')}`;
      const s = semanas.get(k) ?? { ano: d.ano, semana: d.semana, inicio: isoDia(d.data), dre: new D(0) };
      s.dre = s.dre.plus(d.dre);
      semanas.set(k, s);
    }

    return {
      periodo: { de, ate },
      temDados: !!ultimoMes,
      kpis,
      mensal: { ano, meses, total: texto(somaDe(`${ano}-01`, ate)) },
      diario: doPeriodo.map((d) => ({
        data: isoDia(d.data),
        ano: d.ano,
        semana: d.semana,
        dre: d.dre.toFixed(2),
      })),
      semanal: [...semanas.values()].map((s) => ({ ...s, dre: s.dre.toFixed(2) })),
    };
  }

  /** Anos com faturamento importado ou manual (mais recente primeiro). */
  async anos(): Promise<number[]> {
    const [rs, ms] = await Promise.all([
      this.prisma.faturamentoDia.groupBy({ by: ['ano'] }),
      this.prisma.faturamentoManual.groupBy({ by: ['ano'] }),
    ]);
    return [...new Set([...rs, ...ms].map((r) => r.ano))].sort((a, b) => b - a);
  }

  /**
   * Faturamento manual (Administração › Histórico) por mês "AAAA-MM", só dos meses que não estão em
   * `comImportado` — havendo dias importados, valem os dias.
   */
  private async manuaisSemImportado(
    where: Prisma.FaturamentoManualWhereInput,
    comImportado: Set<string>,
  ): Promise<Map<string, Decimal>> {
    const ls = await this.prisma.faturamentoManual.findMany({ where });
    return new Map(
      ls.map((l) => [chaveMes(l.ano, l.mes), l.valor] as const).filter(([k]) => !comImportado.has(k)),
    );
  }

  /** Somas por mês de cada ano pedido (só meses com faturamento; manual entra como DRE, com 0 dias). */
  private async somasPorMes(anos: number[]): Promise<Map<number, Map<number, Somas & { dias: number }>>> {
    const rs = await this.prisma.faturamentoDia.groupBy({
      by: ['ano', 'mes'],
      where: { ano: { in: anos } },
      _sum: { bruto: true, antecipado: true, remessa: true, devolucao: true, dre: true },
      _count: { _all: true },
    });
    const porAno = new Map(anos.map((a) => [a, new Map<number, Somas & { dias: number }>()]));
    for (const r of rs) {
      const somas = zeros();
      for (const c of CAMPOS) somas[c] = r._sum[c] ?? new D(0);
      porAno.get(r.ano)!.set(r.mes, { ...somas, dias: r._count._all });
    }
    const importados = new Set(rs.map((r) => chaveMes(r.ano, r.mes)));
    for (const [k, valor] of await this.manuaisSemImportado({ ano: { in: anos } }, importados)) {
      porAno.get(Number(k.slice(0, 4)))!.set(Number(k.slice(5, 7)), { ...zeros(), dre: valor, dias: 0 });
    }
    return porAno;
  }

  /** Tabela mês a mês de um ano qualquer (seletor de ano da página de Faturamento). */
  async mensal(ano: number): Promise<FaturamentoMensal> {
    const meses = (await this.somasPorMes([ano])).get(ano)!;
    const ordenados = [...meses].sort(([a], [b]) => a - b);
    const total = ordenados.reduce((t, [, m]) => somar(t, m), zeros());
    return {
      ano,
      meses: ordenados.map(([mes, m]) => ({ mes, dias: m.dias, ...texto(m) })),
      total: texto(total),
    };
  }

  /**
   * Comparativo entre dois anos: A é a base, B o comparado (diferença = B − A).
   * `meses` restringe a comparação (linhas e totais) aos meses escolhidos.
   */
  async comparativo(anoA: number, anoB: number, meses?: number[]): Promise<FaturamentoComparativo> {
    const porAno = await this.somasPorMes([anoA, anoB]);
    const mA = porAno.get(anoA)!;
    const mB = porAno.get(anoB)!;
    const comparar = (a: Somas, b: Somas): ComparacaoFaturamento => {
      const diferenca = zeros();
      for (const c of CAMPOS) diferenca[c] = b[c].minus(a[c]);
      return {
        a: texto(a),
        b: texto(b),
        diferenca: texto(diferenca),
        pct: Object.fromEntries(CAMPOS.map((c) => [c, variacao(b[c], a[c])])) as ComparacaoFaturamento['pct'],
      };
    };
    const somaMeses = (m: Map<number, Somas>, meses: number[]) =>
      meses.reduce((t, mes) => (m.has(mes) ? somar(t, m.get(mes)!) : t), zeros());

    const disponiveis = [...new Set([...mA.keys(), ...mB.keys()])].sort((a, b) => a - b);
    const todos = meses ? disponiveis.filter((m) => meses.includes(m)) : disponiveis;
    const emComum = todos.filter((mes) => mA.has(mes) && mB.has(mes));
    return {
      anoA,
      anoB,
      mesesDisponiveis: disponiveis,
      mesesA: [...mA.keys()].sort((a, b) => a - b),
      mesesB: [...mB.keys()].sort((a, b) => a - b),
      meses: todos.map((mes) => ({
        mes,
        temA: mA.has(mes),
        temB: mB.has(mes),
        ...comparar(mA.get(mes) ?? zeros(), mB.get(mes) ?? zeros()),
      })),
      total: comparar(somaMeses(mA, todos), somaMeses(mB, todos)),
      emComum: { meses: emComum, ...comparar(somaMeses(mA, emComum), somaMeses(mB, emComum)) },
    };
  }
}
