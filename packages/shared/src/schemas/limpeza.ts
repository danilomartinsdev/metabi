import { z } from 'zod';

/** Áreas (menus) cujos dados de um ano o Admin pode apagar. */
export const LIMPEZA_AREAS = ['pedidos', 'faturamento', 'faturamento-manual', 'notas-fiscais', 'metas'] as const;
export type LimpezaArea = (typeof LIMPEZA_AREAS)[number];

export const LIMPEZA_AREAS_INFO: Record<LimpezaArea, { rotulo: string; descricao: string }> = {
  pedidos: { rotulo: 'Pedidos', descricao: 'Pedidos emitidos no ano (Pedidos, Visão geral, rankings e mapas).' },
  faturamento: {
    rotulo: 'Faturamento importado',
    descricao: 'Dias de faturamento do Focco e as importações do ano (menu Faturamento).',
  },
  'faturamento-manual': {
    rotulo: 'Faturamento digitado (Histórico)',
    descricao: 'Valores mensais digitados à mão em Administração › Histórico, de pedidos e de faturamento.',
  },
  'notas-fiscais': {
    rotulo: 'Notas fiscais',
    descricao: 'Itens de NF emitidos no ano (Análise de faturamento e curva ABC).',
  },
  metas: { rotulo: 'Metas', descricao: 'Metas mensais do ano, da empresa e dos representantes.' },
};

export const limpezaExecutarSchema = z.object({
  ano: z.number().int().min(2000).max(2100),
  areas: z.array(z.enum(LIMPEZA_AREAS)).min(1, 'Escolha ao menos uma área.').max(LIMPEZA_AREAS.length),
  /** Quem confirma digita o ano de novo: evita apagar o ano errado por descuido. */
  confirmacao: z.number().int(),
});
export type LimpezaExecutar = z.infer<typeof limpezaExecutarSchema>;

export interface LimpezaAno {
  ano: number;
  /** Quantidade de registros por área; 0 = nada para apagar. */
  contagens: Record<LimpezaArea, number>;
}

export type LimpezaResultado = Record<LimpezaArea, number> & { ano: number };
