// Montagem das planilhas Excel (puro, sem banco). Dinheiro vem como string decimal da camada de
// métricas e vira célula numérica só aqui, na apresentação, com formato R$.
import type {
  ClientesResumo,
  ExportFormatoPlanilha,
  Filtros,
  LinhaRanking,
  PedidoLinha,
  Ranking,
  VisaoGeral,
} from '@metabi/shared';
import { REGIAO_ENUM_ROTULO } from '@metabi/shared';
import * as XLSX from 'xlsx';

const BRL = '"R$" #,##0.00';
const PCT = '0.0%';

type Celula = string | number | null;
interface Coluna<T> {
  titulo: string;
  valor: (l: T) => Celula;
  formato?: string;
  largura?: number;
}

function aba<T>(linhas: T[], colunas: Coluna<T>[], rodape?: Celula[]): XLSX.WorkSheet {
  const aoa: Celula[][] = [colunas.map((c) => c.titulo), ...linhas.map((l) => colunas.map((c) => c.valor(l)))];
  if (rodape) aoa.push(rodape);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  colunas.forEach((c, j) => {
    if (!c.formato) return;
    for (let i = 1; i < aoa.length; i++) {
      const cel = ws[XLSX.utils.encode_cell({ r: i, c: j })] as XLSX.CellObject | undefined;
      if (cel && cel.t === 'n') cel.z = c.formato;
    }
  });
  ws['!cols'] = colunas.map((c) => ({ wch: c.largura ?? Math.max(10, c.titulo.length + 2) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ r: 0, c: 0 }, { r: linhas.length, c: colunas.length - 1 }) };
  return ws;
}

const num = (v: string | null) => (v === null ? null : Number(v));

export interface InfoExportacao {
  titulo: string;
  periodo: { de: string; ate: string };
  filtros: Filtros;
  geradoPor: string;
  geradoEm: Date;
  linhas: number;
  truncado?: boolean;
}

/** Aba "Filtros": de onde vieram os dados — o arquivo continua compreensível fora do sistema. */
function abaFiltros(info: InfoExportacao, rotulosGestor: Map<string, string>): XLSX.WorkSheet {
  const f = info.filtros;
  const lista = (v: string[]) => (v.length ? v.join(', ') : 'Todos');
  const aoa: Celula[][] = [
    ['Relatório', info.titulo],
    ['Período', `${info.periodo.de} a ${info.periodo.ate}`],
    ['Região', lista(f.regiao.map((r) => REGIAO_ENUM_ROTULO[r]))],
    ['UF', lista(f.uf)],
    ['Representante', lista(f.gestor.map((g) => rotulosGestor.get(g) ?? g))],
    ['Segmento', lista(f.segmento.map((s) => ({ PUBLICO: 'Público', PRIVADO: 'Privado', SEM: 'Sem segmento' })[s]))],
    ['Status', lista(f.status)],
    ['Busca', f.q ?? '—'],
    ['Linhas', info.linhas],
    ['Gerado por', info.geradoPor],
    ['Gerado em', info.geradoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
  ];
  if (info.truncado) aoa.push(['Atenção', 'Limite de linhas atingido: refine os filtros para exportar tudo.']);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 16 }, { wch: 60 }];
  return ws;
}

/** CSV no padrão brasileiro (ponto e vírgula, vírgula decimal, BOM para o Excel reconhecer o UTF-8). */
export function csvDe(ws: XLSX.WorkSheet): string {
  const ref = ws['!ref'];
  if (!ref) return '';
  const r = XLSX.utils.decode_range(ref);
  const linhas: string[] = [];
  for (let i = r.s.r; i <= r.e.r; i++) {
    const cels: string[] = [];
    for (let j = r.s.c; j <= r.e.c; j++) {
      const cel = ws[XLSX.utils.encode_cell({ r: i, c: j })] as XLSX.CellObject | undefined;
      let t = cel === undefined || cel.v === undefined || cel.v === null ? '' : String(cel.v);
      if (cel?.t === 'n') t = t.replace('.', ',');
      // Neutraliza fórmulas (=, +, -, @) vindas de texto livre; números ficam como estão.
      else if (/^[=+\-@]/.test(t)) t = "'" + t;
      cels.push(/[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t);
    }
    linhas.push(cels.join(';'));
  }
  return linhas.join('\r\n');
}

function livro(
  dados: XLSX.WorkSheet,
  info: InfoExportacao,
  rotulosGestor = new Map<string, string>(),
  formato: ExportFormatoPlanilha = 'xlsx',
) {
  if (formato === 'csv') return Buffer.from('\uFEFF' + csvDe(dados), 'utf8');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dados, 'Dados');
  XLSX.utils.book_append_sheet(wb, abaFiltros(info, rotulosGestor), 'Filtros');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer;
}

export function planilhaPedidos(
  linhas: PedidoLinha[],
  info: InfoExportacao,
  rotulosGestor?: Map<string, string>,
  formato?: ExportFormatoPlanilha,
) {
  const ws = aba(linhas, [
    { titulo: 'Nº pedido', valor: (l) => l.numPedido, largura: 12 },
    { titulo: 'Emissão', valor: (l) => l.dtEmissao, largura: 12 },
    { titulo: 'Entrega', valor: (l) => l.dtEntrega, largura: 12 },
    { titulo: 'Status', valor: (l) => l.status.codigo, largura: 8 },
    { titulo: 'Cliente', valor: (l) => l.cliente, largura: 40 },
    { titulo: 'UF', valor: (l) => l.uf, largura: 5 },
    { titulo: 'Região', valor: (l) => l.regiao, largura: 14 },
    { titulo: 'Representante', valor: (l) => l.gestor, largura: 24 },
    { titulo: 'Segmento', valor: (l) => l.segmento, largura: 14 },
    { titulo: 'Ordem CPR', valor: (l) => l.ordemCpr, largura: 16 },
    { titulo: 'Valor', valor: (l) => num(l.valor), formato: BRL, largura: 16 },
  ]);
  return livro(ws, info, rotulosGestor, formato);
}

export function planilhaRanking(
  r: Ranking,
  rotuloColuna: string,
  info: InfoExportacao,
  rotulosGestor?: Map<string, string>,
  formato?: ExportFormatoPlanilha,
) {
  const ws = aba(
    r.linhas.map((l, i) => ({ ...l, pos: i + 1 })),
    [
      { titulo: '#', valor: (l) => l.pos, largura: 5 },
      { titulo: rotuloColuna, valor: (l) => l.rotulo, largura: 32 },
      { titulo: 'Total', valor: (l) => num(l.total), formato: BRL, largura: 18 },
      { titulo: 'Pedidos', valor: (l) => l.qtd, largura: 10 },
      { titulo: 'Ticket médio', valor: (l) => num(l.ticket), formato: BRL, largura: 16 },
      { titulo: '% Part.', valor: (l) => l.participacao, formato: PCT, largura: 10 },
    ],
    [null, 'Total', num(r.total.total), r.total.qtd, num(r.total.ticket), r.linhas.length ? 1 : null],
  );
  // Rodapé com os mesmos formatos das colunas.
  const ultima = r.linhas.length + 1;
  for (const [c, z] of [[2, BRL], [4, BRL], [5, PCT]] as const) {
    const cel = ws[XLSX.utils.encode_cell({ r: ultima, c })] as XLSX.CellObject | undefined;
    if (cel && cel.t === 'n') cel.z = z;
  }
  return livro(ws, info, rotulosGestor, formato);
}

export function planilhaClientes(
  r: ClientesResumo,
  info: InfoExportacao,
  rotulosGestor?: Map<string, string>,
  formato?: ExportFormatoPlanilha,
) {
  const ws = aba(
    r.ranking.map((l, i) => ({ ...l, pos: i + 1 })),
    [
      { titulo: '#', valor: (l) => l.pos, largura: 5 },
      { titulo: 'Cliente', valor: (l) => l.rotulo, largura: 44 },
      { titulo: 'Total', valor: (l) => num(l.total), formato: BRL, largura: 18 },
      { titulo: 'Pedidos', valor: (l) => l.qtd, largura: 10 },
      { titulo: 'Ticket médio', valor: (l) => num(l.ticket), formato: BRL, largura: 16 },
      { titulo: '% Part.', valor: (l) => l.participacao, formato: PCT, largura: 10 },
      { titulo: 'Meses com compra', valor: (l) => l.meses, largura: 16 },
      { titulo: 'Cliente novo', valor: (l) => (l.novo ? 'Sim' : 'Não'), largura: 12 },
    ],
  );
  return livro(ws, info, rotulosGestor, formato);
}

// ───────────────────────── Visão geral (várias seções) ─────────────────────────

export interface Bloco {
  /** Nome da aba (Excel) / título do bloco (CSV). */
  nome: string;
  titulo: string[];
  linhas: Celula[][];
  /** Formato numérico por coluna (Excel). */
  formatos: (string | undefined)[];
  largura?: number[];
}

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (m: string) => MES[Number(m.slice(5)) - 1] + '/' + m.slice(0, 4);
const linhasRanking = (ls: LinhaRanking[]): Celula[][] =>
  ls.map((l, i) => [i + 1, l.rotulo, num(l.total), l.qtd, num(l.ticket), l.participacao]);
const COLS_RANKING = (primeira: string) => ['#', primeira, 'Total', 'Pedidos', 'Ticket médio', '% Part.'];
const FMT_RANKING = [undefined, undefined, BRL, undefined, BRL, PCT];

/** Seções da Visão geral que viram planilha/CSV (os gráficos viram a tabela dos dados que desenham). */
export function blocosVisaoGeral(
  v: VisaoGeral,
  rankings: Partial<Record<'gestores' | 'estados' | 'regioes', Ranking>>,
  ativa: (id: string) => boolean,
): Bloco[] {
  const b: Bloco[] = [];
  if (ativa('kpis')) {
    const k = v.kpis;
    const linha = (nome: string, x: typeof k.total): Celula[] => [
      nome,
      num(x.valor),
      num(x.mesAnterior.anterior),
      x.mesAnterior.pct,
      num(x.anoAnterior.anterior),
      x.anoAnterior.pct,
    ];
    b.push({
      nome: 'Indicadores',
      titulo: ['Indicador', 'Valor', 'Mês anterior', 'Var. mês', 'Ano anterior', 'Var. ano'],
      linhas: [
        linha('Total vendido', k.total),
        linha('Pedidos', k.qtd),
        linha('Ticket médio', k.ticket),
        ['% Público', k.pctPublico.valor, null, null, k.pctPublico.anoAnterior, null],
      ],
      formatos: [undefined, undefined, undefined, PCT, undefined, PCT],
      largura: [18, 18, 18, 10, 18, 10],
    });
  }
  if (ativa('evolucao')) {
    b.push({
      nome: 'Evolução mensal',
      titulo: ['Mês', 'Real ' + v.evolucao.ano, 'Ano anterior', 'Meta'],
      linhas: v.evolucao.meses.map((m) => [MES[m.mes - 1]!, num(m.real), num(m.anoAnterior), num(m.meta)]),
      formatos: [undefined, BRL, BRL, BRL],
      largura: [10, 18, 18, 18],
    });
  }
  if (ativa('participacao')) {
    b.push({
      nome: 'Participação',
      titulo: ['Grupo', 'Item', 'Total', 'Pedidos', '% Part.'],
      linhas: [
        ...v.porRegiao.map((l): Celula[] => ['Região', l.rotulo, num(l.total), l.qtd, l.participacao]),
        ...v.porSegmento.map((l): Celula[] => ['Segmento', l.rotulo, num(l.total), l.qtd, l.participacao]),
      ],
      formatos: [undefined, undefined, BRL, undefined, PCT],
      largura: [12, 28, 18, 10, 10],
    });
  }
  if (ativa('topGestores')) {
    b.push({
      nome: 'Top 10 representantes',
      titulo: COLS_RANKING('Representante'),
      linhas: linhasRanking(v.topGestores),
      formatos: FMT_RANKING,
      largura: [5, 32, 18, 10, 16, 10],
    });
  }
  if (ativa('comparativo')) {
    const a = v.acumuladoSegmento;
    b.push({
      nome: 'Comparativo ano anterior',
      titulo: [
        'Segmento',
        rotuloMes(a.periodo.atual.de) + ' a ' + rotuloMes(a.periodo.atual.ate),
        rotuloMes(a.periodo.anterior.de) + ' a ' + rotuloMes(a.periodo.anterior.ate),
        'Variação',
      ],
      linhas: [
        ...a.linhas.map((l): Celula[] => [l.segmento, num(l.atual), num(l.anterior), l.pct]),
        ['Total', num(a.total.atual), num(a.total.anterior), a.total.pct],
      ],
      formatos: [undefined, BRL, BRL, PCT],
      largura: [20, 20, 20, 10],
    });
  }
  if (ativa('detalhamento')) {
    const d = v.detalhamentoMensal;
    b.push({
      nome: 'Detalhamento mensal',
      titulo: ['Mês', 'Atual', 'Ano anterior', 'Variação'],
      linhas: [
        ...d.linhas.map((l): Celula[] => [rotuloMes(l.mes), num(l.atual), num(l.anterior), l.pct]),
        ['Total', num(d.total.atual), num(d.total.anterior), d.total.pct],
      ],
      formatos: [undefined, BRL, BRL, PCT],
      largura: [12, 18, 18, 10],
    });
  }
  const ranks = [
    ['rankGestores', 'gestores', 'Ranking de representantes', 'Representante'],
    ['rankEstados', 'estados', 'Ranking de estados', 'UF'],
    ['rankRegioes', 'regioes', 'Ranking de regiões', 'Região'],
  ] as const;
  for (const [id, dim, nome, col] of ranks) {
    const r = rankings[dim];
    if (!ativa(id) || !r) continue;
    b.push({
      nome,
      titulo: COLS_RANKING(col),
      linhas: [
        ...linhasRanking(r.linhas),
        [null, 'Total', num(r.total.total), r.total.qtd, num(r.total.ticket), r.linhas.length ? 1 : null],
      ],
      formatos: FMT_RANKING,
      largura: [5, 32, 18, 10, 16, 10],
    });
  }
  return b;
}

function abaDoBloco(bl: Bloco): XLSX.WorkSheet {
  const aoa: Celula[][] = [bl.titulo, ...bl.linhas];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  bl.formatos.forEach((z, j) => {
    if (!z) return;
    for (let i = 1; i < aoa.length; i++) {
      const cel = ws[XLSX.utils.encode_cell({ r: i, c: j })] as XLSX.CellObject | undefined;
      if (cel && cel.t === 'n') cel.z = z;
    }
  });
  ws['!cols'] = bl.titulo.map((t, j) => ({ wch: bl.largura?.[j] ?? Math.max(10, t.length + 2) }));
  return ws;
}

export function planilhaVisaoGeral(
  blocos: Bloco[],
  info: InfoExportacao,
  rotulosGestor: Map<string, string>,
  formato: ExportFormatoPlanilha,
): Buffer {
  if (formato === 'csv') {
    // Um arquivo só: cada seção com seu título, separadas por uma linha em branco.
    const partes = blocos.map((bl) => bl.nome + '\r\n' + csvDe(abaDoBloco(bl)));
    const cab = 'Relatório;' + info.titulo + '\r\nPeríodo;' + info.periodo.de + ' a ' + info.periodo.ate;
    return Buffer.from('\uFEFF' + [cab, ...partes].join('\r\n\r\n'), 'utf8');
  }
  const wb = XLSX.utils.book_new();
  for (const bl of blocos) XLSX.utils.book_append_sheet(wb, abaDoBloco(bl), bl.nome.slice(0, 31));
  XLSX.utils.book_append_sheet(wb, abaFiltros(info, rotulosGestor), 'Filtros');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer;
}
