export const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul', 'Exterior'] as const;
export type Regiao = (typeof REGIOES)[number];

/** UF → região. "EX" = exportação → "Exterior". Ver docs/produto/regras-de-negocio.md. */
export const UF_REGIAO = {
  AC: 'Norte',
  AM: 'Norte',
  AP: 'Norte',
  PA: 'Norte',
  RO: 'Norte',
  RR: 'Norte',
  TO: 'Norte',
  AL: 'Nordeste',
  BA: 'Nordeste',
  CE: 'Nordeste',
  MA: 'Nordeste',
  PB: 'Nordeste',
  PE: 'Nordeste',
  PI: 'Nordeste',
  RN: 'Nordeste',
  SE: 'Nordeste',
  DF: 'Centro-Oeste',
  GO: 'Centro-Oeste',
  MS: 'Centro-Oeste',
  MT: 'Centro-Oeste',
  ES: 'Sudeste',
  MG: 'Sudeste',
  RJ: 'Sudeste',
  SP: 'Sudeste',
  PR: 'Sul',
  RS: 'Sul',
  SC: 'Sul',
  EX: 'Exterior',
} as const satisfies Record<string, Regiao>;

export type UF = keyof typeof UF_REGIAO;
export const UFS = Object.keys(UF_REGIAO) as UF[];

/** Nome por extenso de cada UF (EX = Exterior). */
export const UF_NOME: Record<UF, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AM: 'Amazonas',
  AP: 'Amapá',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MG: 'Minas Gerais',
  MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso',
  PA: 'Pará',
  PB: 'Paraíba',
  PE: 'Pernambuco',
  PI: 'Piauí',
  PR: 'Paraná',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RO: 'Rondônia',
  RR: 'Roraima',
  RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina',
  SE: 'Sergipe',
  SP: 'São Paulo',
  TO: 'Tocantins',
  EX: 'Exterior',
};

export function regiaoDaUf(uf: string): Regiao | undefined {
  return (UF_REGIAO as Record<string, Regiao>)[uf.trim().toUpperCase()];
}
