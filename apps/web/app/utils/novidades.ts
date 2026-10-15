import type { EscopoTipo, Permission } from '@meta-bi/shared';

export interface Novidade {
  /** Identificador estável e crescente ("AAAA-MM-DD-n"): o que já foi visto é guardado por ele. */
  id: string;
  data: string;
  titulo: string;
  texto: string;
  /** Link "Abrir" (opcional). */
  para?: string;
  /** Só aparece para quem tem a permissão (e, se pedido, escopo "todos"). Sem isso, aparece para todos. */
  permissao?: Permission;
  exigeEscopoTodos?: boolean;
}

/** Novidades do sistema, a mais recente primeiro. Acrescente no topo a cada entrega. */
export const NOVIDADES: Novidade[] = [
  {
    id: '2026-10-15-2',
    data: '2026-10-15',
    titulo: 'PDF da Análise de faturamento',
    texto:
      'Botão "Exportar PDF" na Análise de faturamento: o período da tela com indicadores, faturamento por divisão, ranking por representante e as curvas ABC de clientes e produtos (resumo por classe e os 30 maiores).',
    para: '/faturamento/analise',
    permissao: 'faturamento-analise.view',
    exigeEscopoTodos: true,
  },
  {
    id: '2026-10-15-1',
    data: '2026-10-15',
    titulo: 'Tamanho da fonte e cores do sistema',
    texto:
      'Barra no canto inferior direito: A− e A+ diminuem ou aumentam a letra de todas as telas (tabelas, rankings e curvas ABC incluídos), e a paleta escolhe o tema — Azul, Noite, Esmeralda, Oceano, Violeta, Grafite ou Vinho, claros e escuros. O ? abre estas novidades. A escolha fica salva neste navegador.',
  },
  {
    id: '2026-10-13-1',
    data: '2026-10-13',
    titulo: 'Análise de faturamento',
    texto:
      'Nova tela em Análise › Análise de faturamento, a partir das notas fiscais do Focco: faturamento por divisão de venda (clique numa divisão para ver o ranking dos representantes nela), ranking por representante e curvas ABC por cliente e por produto — esta pelo valor ou pela quantidade vendida, com as variantes do mesmo produto somadas. O acesso é pela permissão "Ver análise de faturamento", em Papéis.',
    para: '/faturamento/analise',
    permissao: 'faturamento-analise.view',
    exigeEscopoTodos: true,
  },
  {
    id: '2026-10-13-2',
    data: '2026-10-13',
    titulo: 'Usuários online na Auditoria',
    texto:
      'Aba "Online" em Administração › Auditoria: quantos e quais usuários estão usando o sistema agora, com o último sinal, navegador e IP.',
    para: '/admin/auditoria',
    permissao: 'audit.view',
  },
];

/** Novidades que o usuário pode ver (por permissão e escopo). */
export function novidadesVisiveis(
  lista: Novidade[],
  u: { permissoes: ReadonlySet<Permission>; escopoTipo?: EscopoTipo },
): Novidade[] {
  return lista.filter(
    (n) =>
      (!n.permissao || u.permissoes.has(n.permissao)) && (!n.exigeEscopoTodos || u.escopoTipo === 'todos'),
  );
}

/** Ainda não vistas: id maior que o último visto (sem nada visto, todas). */
export function novidadesNaoVistas(lista: Novidade[], ultimaVista: string | null): Novidade[] {
  return ultimaVista ? lista.filter((n) => n.id > ultimaVista) : lista;
}
