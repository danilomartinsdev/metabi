// Rótulos de período (meses "AAAA-MM") para a UI, sempre explícitos: "janeiro a setembro de 2026".
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const ano = (m: string) => m.slice(0, 4);
const nome = (m: string) => MESES[Number(m.slice(5, 7)) - 1]!;
const curto = (m: string) => nome(m).slice(0, 3);

export function deslocarMes(m: string, n: number): string {
  const t = Number(ano(m)) * 12 + Number(m.slice(5, 7)) - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export function mesesNoPeriodo(de: string, ate: string): number {
  return (Number(ano(ate)) - Number(ano(de))) * 12 + Number(ate.slice(5, 7)) - Number(de.slice(5, 7)) + 1;
}

/** "setembro de 2026" · "janeiro a setembro de 2026" · "outubro de 2025 a março de 2026". */
export function periodoPorExtenso(de: string, ate: string): string {
  if (de === ate) return `${nome(de)} de ${ano(de)}`;
  if (ano(de) === ano(ate)) return `${nome(de)} a ${nome(ate)} de ${ano(ate)}`;
  return `${nome(de)} de ${ano(de)} a ${nome(ate)} de ${ano(ate)}`;
}

/** "set/2026" · "jan–set/2026" · "out/2025–mar/2026". */
export function periodoCurto(de: string, ate: string): string {
  if (de === ate) return `${curto(de)}/${ano(de)}`;
  if (ano(de) === ano(ate)) return `${curto(de)}–${curto(ate)}/${ano(ate)}`;
  return `${curto(de)}/${ano(de)}–${curto(ate)}/${ano(ate)}`;
}

/** Mesmo período do ano anterior. */
export function anoAnterior(p: { de: string; ate: string }) {
  return { de: deslocarMes(p.de, -12), ate: deslocarMes(p.ate, -12) };
}

/** Período imediatamente anterior com o mesmo número de meses (regra do "vs. período anterior"). */
export function periodoAnterior(p: { de: string; ate: string }) {
  const n = mesesNoPeriodo(p.de, p.ate);
  return { de: deslocarMes(p.de, -n), ate: deslocarMes(p.ate, -n) };
}

/**
 * Comparações mostradas nos cards de KPI (decisão de 2026-10-05):
 * período de vários meses → só o mesmo período do ano anterior;
 * um mês só → mês anterior e mesmo mês do ano anterior.
 */
export function variacoesKpi(
  kpi: { mesAnterior: { pct: number | null }; anoAnterior: { pct: number | null } },
  p: { de: string; ate: string },
): { rotulo: string; pct: number | null }[] {
  const aa = anoAnterior(p);
  const ano = { rotulo: `vs. ${periodoCurto(aa.de, aa.ate)}`, pct: kpi.anoAnterior.pct };
  if (mesesNoPeriodo(p.de, p.ate) > 1) return [ano];
  const pa = periodoAnterior(p);
  return [{ rotulo: `vs. ${periodoCurto(pa.de, pa.ate)}`, pct: kpi.mesAnterior.pct }, ano];
}

/** Eixo de meses dos gráficos: "Jan" quando o período é de um ano só; "Jan/26" quando cruza anos. */
export function rotulosMeses(meses: string[]): string[] {
  const umAno = new Set(meses.map(ano)).size <= 1;
  return meses.map((m) => {
    const r = curto(m).charAt(0).toUpperCase() + curto(m).slice(1);
    return umAno ? r : `${r}/${m.slice(2, 4)}`;
  });
}

/** Legenda real × ano anterior: "2026" e "2025" num ano só; "Período" e "Ano anterior" cruzando anos. */
export function nomesSeriesPeriodo(meses: string[]): { atual: string; anterior: string } {
  const anos = [...new Set(meses.map(ano))];
  return anos.length === 1
    ? { atual: anos[0]!, anterior: String(Number(anos[0]) - 1) }
    : { atual: 'Período', anterior: 'Ano anterior' };
}

/** "set/2026" de um mês "AAAA-MM". */
export const mesCurto = (m: string) => `${curto(m)}/${ano(m)}`;
