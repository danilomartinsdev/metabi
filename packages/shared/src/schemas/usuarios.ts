import { z } from 'zod';
import { ESCOPO_TIPOS, PERMISSIONS } from '../constants/permissions.js';
import { emailSchema } from './auth.js';
import { REGIOES_ENUM } from './dashboard.js';

const escopo = {
  escopoTipo: z.enum(ESCOPO_TIPOS),
  escopoRegioes: z.array(z.enum(REGIOES_ENUM)).max(6).default([]),
  representanteIds: z.array(z.uuid()).max(500).default([]),
};

const coerenciaEscopo = (u: {
  escopoTipo?: string;
  escopoRegioes?: unknown[];
  representanteIds?: unknown[];
}) =>
  (u.escopoTipo !== 'regiao' || (u.escopoRegioes?.length ?? 0) > 0) &&
  (u.escopoTipo !== 'representantes' || (u.representanteIds?.length ?? 0) > 0);
const msgEscopo = {
  error: 'Escolha ao menos uma região ou um representante para o escopo.',
  path: ['escopoTipo'],
};

export const usuarioCriarSchema = z
  .object({
    nome: z.string().trim().min(2).max(120),
    email: emailSchema,
    roleId: z.uuid(),
    ...escopo,
  })
  .refine(coerenciaEscopo, msgEscopo);
export type UsuarioCriar = z.input<typeof usuarioCriarSchema>;

export const usuarioAtualizarSchema = z
  .object({
    nome: z.string().trim().min(2).max(120),
    roleId: z.uuid(),
    ...escopo,
  })
  .refine(coerenciaEscopo, msgEscopo);
export type UsuarioAtualizar = z.input<typeof usuarioAtualizarSchema>;

export interface UsuarioAdmin {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  trocarSenha: boolean;
  bloqueado: boolean;
  ultimoAcessoEm: string | null;
  papel: { id: string; chave: string; nome: string };
  escopoTipo: (typeof ESCOPO_TIPOS)[number];
  escopoRegioes: (typeof REGIOES_ENUM)[number][];
  representantes: { id: string; nomeExibicao: string }[];
}

export const papelSalvarSchema = z.object({
  nome: z.string().trim().min(2).max(60),
  permissoes: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length),
});
export type PapelSalvar = z.infer<typeof papelSalvarSchema>;

export interface PapelAdmin {
  id: string;
  chave: string;
  nome: string;
  sistema: boolean;
  permissoes: (typeof PERMISSIONS)[number][];
  usuarios: number;
}

export const auditoriaQuerySchema = z.object({
  acao: z.string().trim().max(60).optional(),
  usuarioId: z.uuid().optional(),
  de: z.iso.date().optional(),
  ate: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditoriaQuery = z.output<typeof auditoriaQuerySchema>;

/** Aba "Online" da auditoria: quem usou o sistema nos últimos `janelaMinutos`. */
export interface UsuariosOnline {
  janelaMinutos: number;
  usuarios: {
    id: string;
    nome: string;
    email: string;
    papel: string;
    ultimaAtividadeEm: string;
    /** Navegador e sistema, resumidos do user-agent (ex.: "Chrome · Windows"). */
    dispositivo: string | null;
    ip: string | null;
  }[];
}

export interface AuditoriaLinha {
  id: string;
  createdAt: string;
  acao: string;
  usuario: { id: string; nome: string; email: string } | null;
  entidade: string | null;
  entidadeId: string | null;
  detalhes: unknown;
  ip: string | null;
}
