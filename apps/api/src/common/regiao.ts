import type { Regiao } from '@metabi/shared';
import type { Regiao as RegiaoEnum } from '../generated/prisma/client.js';

/** Rótulo de região (packages/shared) ↔ enum do banco. */
export const REGIAO_ENUM: Record<Regiao, RegiaoEnum> = {
  Norte: 'NORTE',
  Nordeste: 'NORDESTE',
  'Centro-Oeste': 'CENTRO_OESTE',
  Sudeste: 'SUDESTE',
  Sul: 'SUL',
  Exterior: 'EXTERIOR',
};

export const REGIAO_ROTULO = Object.fromEntries(
  Object.entries(REGIAO_ENUM).map(([k, v]) => [v, k]),
) as Record<RegiaoEnum, Regiao>;
