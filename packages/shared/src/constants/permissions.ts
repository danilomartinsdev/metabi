/** Permissões granulares do sistema. Fonte única para api, web e seed. */
export const PERMISSIONS = [
  'dashboard.view',
  'minhas-vendas.view',
  'pedidos.view',
  'import.run',
  'import.rollback',
  'export.xlsx',
  'export.pdf',
  'metas.edit',
  'cadastros.edit',
  'users.manage',
  'audit.view',
  'faturamento.view',
  'faturamento-analise.view',
  'faturamento.import',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard.view': 'Ver dashboards',
  'minhas-vendas.view': 'Ver Minhas vendas',
  'pedidos.view': 'Ver pedidos',
  'import.run': 'Importar relatório',
  'import.rollback': 'Desfazer importação',
  'export.xlsx': 'Exportar Excel',
  'export.pdf': 'Exportar PDF',
  'metas.edit': 'Editar metas',
  'cadastros.edit': 'Editar cadastros',
  'users.manage': 'Gerenciar usuários e papéis',
  'audit.view': 'Ver auditoria',
  'faturamento.view': 'Ver faturamento',
  'faturamento-analise.view': 'Ver análise de faturamento',
  'faturamento.import': 'Importar faturamento',
};

/**
 * O que o Admin tem (sempre, sem poder desmarcar): todas, menos "Ver Minhas vendas", que é a tela do
 * representante — ligada só por checkbox em Papéis.
 */
export const PERMISSOES_ADMIN: readonly Permission[] = PERMISSIONS.filter((p) => p !== 'minhas-vendas.view');

export const ROLE_KEYS = ['admin', 'gestor-comercial', 'representante', 'visualizador'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** Papéis padrão (seed). Editáveis na interface — ver docs/arquitetura/seguranca-rbac.md. */
export const DEFAULT_ROLES: Record<RoleKey, { nome: string; permissoes: readonly Permission[] }> = {
  admin: { nome: 'Admin', permissoes: PERMISSOES_ADMIN },
  'gestor-comercial': {
    nome: 'Gestor comercial',
    permissoes: [
      'dashboard.view',
      'pedidos.view',
      'import.run',
      'import.rollback',
      'export.xlsx',
      'export.pdf',
      'metas.edit',
      'faturamento.view',
      'faturamento-analise.view',
      'faturamento.import',
    ],
  },
  representante: {
    nome: 'Representante',
    permissoes: ['dashboard.view', 'minhas-vendas.view', 'pedidos.view', 'export.xlsx', 'export.pdf'],
  },
  visualizador: { nome: 'Visualizador', permissoes: ['dashboard.view', 'pedidos.view'] },
};

export const ESCOPO_TIPOS = ['todos', 'regiao', 'representantes'] as const;
export type EscopoTipo = (typeof ESCOPO_TIPOS)[number];
