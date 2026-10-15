import type { Permission } from '@meta-bi/shared';
import { MINHAS_VENDAS } from '~/utils/navegacao';

export interface NavItem {
  label: string;
  to: string;
  /** Nome do ícone (i-lucide-*), renderizado com UIcon. */
  icon: string;
  permissao: Permission;
  /** Fase em que a tela fica pronta; antes disso aparece como "em breve". */
  fase?: number;
}

export interface NavGroup {
  titulo: string;
  itens: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    titulo: 'Análise',
    itens: [
      {
        label: 'Minhas vendas',
        to: '/minhas-vendas',
        icon: 'i-lucide-circle-user-round',
        ...MINHAS_VENDAS,
      },
      {
        label: 'Visão geral',
        to: '/dashboard',
        icon: 'i-lucide-layout-dashboard',
        permissao: 'dashboard.view',
      },
      {
        label: 'Representantes',
        to: '/dashboard/gestores',
        icon: 'i-lucide-trophy',
        permissao: 'dashboard.view',
      },
      {
        label: 'Estados',
        to: '/dashboard/estados',
        icon: 'i-lucide-map-pinned',
        permissao: 'dashboard.view',
      },
      {
        label: 'Regiões',
        to: '/dashboard/regioes',
        icon: 'i-lucide-map',
        permissao: 'dashboard.view',
      },
      {
        label: 'Clientes',
        to: '/dashboard/clientes',
        icon: 'i-lucide-building-complex',
        permissao: 'dashboard.view',
      },
      { label: 'Pedidos', to: '/pedidos', icon: 'i-lucide-clipboard-list', permissao: 'pedidos.view' },
      { label: 'Faturamento', to: '/faturamento', icon: 'i-lucide-banknote', permissao: 'faturamento.view' },
      {
        label: 'Análise de faturamento',
        to: '/faturamento/analise',
        icon: 'i-lucide-chart-pie',
        permissao: 'faturamento-analise.view',
      },
    ],
  },
  {
    titulo: 'Administração',
    itens: [
      { label: 'Importações', to: '/admin/importacoes', icon: 'i-lucide-file-up', permissao: 'import.run' },
      { label: 'Metas', to: '/admin/metas', icon: 'i-lucide-target', permissao: 'metas.edit' },
      {
        label: 'Histórico',
        to: '/admin/historico',
        icon: 'i-lucide-rotate-ccw-clock',
        permissao: 'metas.edit',
      },
      {
        label: 'Cadastro de representantes',
        to: '/admin/representantes',
        icon: 'i-lucide-square-user-round',
        permissao: 'cadastros.edit',
      },
      {
        label: 'Segmento por cliente',
        to: '/admin/clientes',
        icon: 'i-lucide-building-complex',
        permissao: 'cadastros.edit',
      },
      { label: 'Status PDV', to: '/admin/status-pdv', icon: 'i-lucide-tags', permissao: 'cadastros.edit' },
      { label: 'Usuários', to: '/admin/usuarios', icon: 'i-lucide-users', permissao: 'users.manage' },
      { label: 'Papéis', to: '/admin/papeis', icon: 'i-lucide-shield', permissao: 'users.manage' },
      { label: 'Auditoria', to: '/admin/auditoria', icon: 'i-lucide-scroll-text', permissao: 'audit.view' },
    ],
  },
];

export const NAV_ICONE_PADRAO = 'i-lucide-bar-chart-3';
