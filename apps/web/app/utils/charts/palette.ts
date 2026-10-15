// Único lugar com cores de gráfico além de tokens.css (docs/design/design-system.md).
import type { PaletaGrafico } from '@meta-bi/shared';

export const PALETA_CATEGORICA = [
  '#1D5FA8',
  '#0D9488',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#0EA5E9',
  '#84CC16',
];

/** Cores do tema atual lidas dos tokens CSS (fallback para o tema claro, ex.: em testes). */
export interface TemaGrafico {
  texto: string;
  textoSuave: string;
  borda: string;
  fundo: string;
  /** Cor principal: ano atual/real, barras, mapa. */
  primaria: string;
  /** Cor da meta e dos destaques. */
  destaque: string;
  /** Cor de comparação: ano anterior / mesmo período do ano anterior. */
  comparacao: string;
  categorica: string[];
}

export const TEMA_CLARO: TemaGrafico = {
  texto: '#0F172A',
  textoSuave: '#64748B',
  borda: '#E2E8F0',
  fundo: '#FFFFFF',
  primaria: '#1D5FA8',
  destaque: '#0D9488',
  comparacao: '#64748B',
  categorica: PALETA_CATEGORICA,
};

type Par = { claro: string; escuro: string };
export interface DefinicaoPaleta {
  nome: string;
  /** null = usa os tokens do tema (paleta padrão). */
  principal: Par | null;
  comparacao: Par | null;
  meta: Par | null;
  fatias: string[];
}

/**
 * Paletas prontas que cada usuário pode escolher (menu do usuário › Cores dos gráficos).
 * Cada cor tem versão para o tema claro e para o escuro, com contraste conferido nos dois fundos.
 */
export const PALETAS: Record<PaletaGrafico, DefinicaoPaleta> = {
  padrao: { nome: 'Padrão (azul)', principal: null, comparacao: null, meta: null, fatias: PALETA_CATEGORICA },
  esmeralda: {
    nome: 'Esmeralda',
    principal: { claro: '#047857', escuro: '#34D399' },
    comparacao: { claro: '#94A3B8', escuro: '#64748B' },
    meta: { claro: '#D97706', escuro: '#FBBF24' },
    fatias: ['#047857', '#0EA5E9', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6', '#84CC16'],
  },
  grafite: {
    nome: 'Grafite',
    principal: { claro: '#334155', escuro: '#CBD5E1' },
    comparacao: { claro: '#A8A29E', escuro: '#57534E' },
    meta: { claro: '#EA580C', escuro: '#FB923C' },
    fatias: ['#334155', '#64748B', '#0EA5E9', '#F59E0B', '#10B981', '#A855F7', '#EF4444'],
  },
  vinho: {
    nome: 'Vinho',
    principal: { claro: '#9F1239', escuro: '#FB7185' },
    comparacao: { claro: '#A8A29E', escuro: '#57534E' },
    meta: { claro: '#0F766E', escuro: '#2DD4BF' },
    fatias: ['#9F1239', '#F59E0B', '#0F766E', '#6366F1', '#EA580C', '#0EA5E9', '#84CC16'],
  },
  oceano: {
    nome: 'Oceano',
    principal: { claro: '#0369A1', escuro: '#38BDF8' },
    comparacao: { claro: '#94A3B8', escuro: '#475569' },
    meta: { claro: '#C026D3', escuro: '#E879F9' },
    fatias: ['#0369A1', '#06B6D4', '#6366F1', '#F59E0B', '#10B981', '#F43F5E', '#A3E635'],
  },
};

/** Aplica a paleta escolhida sobre o tema base (tokens). Padrão/null não muda nada. */
export function aplicarPaleta(
  base: TemaGrafico,
  paleta: PaletaGrafico | null | undefined,
  escuro: boolean,
): TemaGrafico {
  const p = PALETAS[paleta ?? 'padrao'] ?? PALETAS.padrao;
  const cor = (par: Par | null, atual: string) => (par ? (escuro ? par.escuro : par.claro) : atual);
  return {
    ...base,
    primaria: cor(p.principal, base.primaria),
    comparacao: cor(p.comparacao, base.comparacao),
    destaque: cor(p.meta, base.destaque),
    categorica: p.fatias,
  };
}

/** Cores das fatias (donuts) da paleta do usuário, na ordem em que o ECharts as usa. */
export function coresFatias(paleta: PaletaGrafico | null | undefined): string[] {
  return (PALETAS[paleta ?? 'padrao'] ?? PALETAS.padrao).fatias;
}

export function lerTema(paleta?: PaletaGrafico | null): TemaGrafico {
  if (typeof window === 'undefined') return aplicarPaleta(TEMA_CLARO, paleta, false);
  const raiz = document.documentElement;
  const css = getComputedStyle(raiz);
  const v = (nome: string, fb: string) => css.getPropertyValue(nome).trim() || fb;
  const base: TemaGrafico = {
    texto: v('--foreground', TEMA_CLARO.texto),
    textoSuave: v('--muted-foreground', TEMA_CLARO.textoSuave),
    borda: v('--border', TEMA_CLARO.borda),
    fundo: v('--card', TEMA_CLARO.fundo),
    primaria: v('--primary', TEMA_CLARO.primaria),
    destaque: v('--highlight', TEMA_CLARO.destaque),
    comparacao: v('--muted-foreground', TEMA_CLARO.comparacao),
    categorica: PALETA_CATEGORICA,
  };
  return aplicarPaleta(base, paleta, raiz.classList.contains('dark'));
}

/**
 * Cores da paleta nas variáveis CSS do <html> (--grafico-principal / --grafico-comparacao), usadas pelas
 * tabelas comparativas. Padrão remove a sobrescrita e volta aos tokens.
 */
export function aplicarPaletaNoCss(paleta: PaletaGrafico | null | undefined, escuro: boolean) {
  if (typeof document === 'undefined') return;
  const s = document.documentElement.style;
  const p = PALETAS[paleta ?? 'padrao'] ?? PALETAS.padrao;
  for (const [nome, par] of [
    ['--grafico-principal', p.principal],
    ['--grafico-comparacao', p.comparacao],
  ] as const) {
    if (par) s.setProperty(nome, escuro ? par.escuro : par.claro);
    else s.removeProperty(nome);
  }
}
