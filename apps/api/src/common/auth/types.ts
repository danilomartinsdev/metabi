import type { EscopoTipo, PaletaGrafico, Permission, Regiao } from '@metabi/shared';

export interface Escopo {
  tipo: EscopoTipo;
  regioes: Regiao[];
  representanteIds: string[];
}

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  papel: { chave: string; nome: string };
  permissoes: Permission[];
  escopoTipo: EscopoTipo;
  /** Escopo de dados aplicado pelo ScopedPedidosRepository. Nunca exposto na resposta. */
  escopo: Escopo;
  trocarSenha: boolean;
  /** Paleta de cores dos gráficos escolhida pelo usuário (null = padrão). */
  paletaGraficos: PaletaGrafico | null;
  /** Família de sessão (login) a que o access token pertence. */
  sessaoFamilia: string;
}

export interface ContextoRequisicao {
  ip?: string;
  userAgent?: string;
}
