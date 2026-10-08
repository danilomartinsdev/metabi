const NAVEGADORES: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];
const SISTEMAS: [RegExp, string][] = [
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

/** Resume o user-agent em "Navegador · Sistema" (ex.: "Edge · Windows"). Desconhecido → null. */
export function resumirDispositivo(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const achar = (lista: [RegExp, string][]) => lista.find(([re]) => re.test(ua))?.[1];
  const partes = [achar(NAVEGADORES), achar(SISTEMAS)].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}
