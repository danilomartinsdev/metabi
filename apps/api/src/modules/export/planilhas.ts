// Montagem das planilhas Excel (puro, sem banco). Dinheiro vem como string decimal da camada de
// métricas e vira célula numérica só aqui, na apresentação, com formato R$.
import type { ClientesResumo, Filtros, PedidoLinha, Ranking } from '@metabi/shared';
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

function livro(dados: XLSX.WorkSheet, info: InfoExportacao, rotulosGestor = new Map<string, string>()) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dados, 'Dados');
  XLSX.utils.book_append_sheet(wb, abaFiltros(info, rotulosGestor), 'Filtros');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer;
}

export function planilhaPedidos(linhas: PedidoLinha[], info: InfoExportacao, rotulosGestor?: Map<string, string>) {
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
  return livro(ws, info, rotulosGestor);
}

export function planilhaRanking(r: Ranking, rotuloColuna: string, info: InfoExportacao, rotulosGestor?: Map<string, string>) {
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
  return livro(ws, info, rotulosGestor);
}

export function planilhaClientes(r: ClientesResumo, info: InfoExportacao, rotulosGestor?: Map<string, string>) {
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
  return livro(ws, info, rotulosGestor);
}
