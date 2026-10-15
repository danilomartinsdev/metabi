// Aparência por navegador: tamanho da fonte e tema de cores (botão flutuante no canto da tela).
// As cores de cada tema ficam em assets/css/tokens.css (seletor `[data-tema]`); aqui só os nomes.

export const TEMAS = {
  padrao: { nome: 'Azul (padrão)' },
  esmeralda: { nome: 'Esmeralda' },
  grafite: { nome: 'Grafite' },
  vinho: { nome: 'Vinho' },
  oceano: { nome: 'Oceano' },
  violeta: { nome: 'Violeta' },
} as const;
export type Tema = keyof typeof TEMAS;

/** Tamanhos da fonte em % do padrão do navegador; tudo em rem (texto e espaçamentos) acompanha. */
export const ESCALAS_FONTE = [90, 100, 110, 120, 130] as const;
export const ESCALA_PADRAO = 100;

export const CHAVE_FONTE = 'meta-bi-fonte';
export const CHAVE_TEMA = 'meta-bi-tema-cores';

export function lerTemaSalvo(v: string | null | undefined): Tema {
  return v && Object.hasOwn(TEMAS, v) ? (v as Tema) : 'padrao';
}

export function lerEscalaSalva(v: string | null | undefined): number {
  const n = Number(v);
  return (ESCALAS_FONTE as readonly number[]).includes(n) ? n : ESCALA_PADRAO;
}

/** Próximo tamanho (passo +1 ou -1), parando nas pontas. */
export function mudarEscala(atual: number, passo: 1 | -1): number {
  const i = (ESCALAS_FONTE as readonly number[]).indexOf(atual);
  const j = Math.min(ESCALAS_FONTE.length - 1, Math.max(0, (i < 0 ? 1 : i) + passo));
  return ESCALAS_FONTE[j]!;
}
