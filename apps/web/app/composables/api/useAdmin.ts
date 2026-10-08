import type {
  AuditoriaLinha,
  PapelAdmin,
  PapelSalvar,
  Segmento,
  UsuarioAdmin,
  UsuarioAtualizar,
  UsuarioCriar,
  UsuariosOnline,
} from '@meta-bi/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { MaybeRefOrGetter } from 'vue';
import { useApi } from './useApi';

export function useUsuariosQuery(opcoes: { enabled?: MaybeRefOrGetter<boolean> } = {}) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: () => request<UsuarioAdmin[]>('/usuarios'),
    enabled: () => toValue(opcoes.enabled ?? true),
  });
}

export function useSalvarUsuario() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: {
      id?: string;
      dados: UsuarioCriar | UsuarioAtualizar;
    }): Promise<{ usuario: UsuarioAdmin; senhaProvisoria: string | null }> =>
      p.id
        ? request<UsuarioAdmin>(`/usuarios/${p.id}`, { method: 'PATCH', body: p.dados }).then((usuario) => ({
            usuario,
            senhaProvisoria: null,
          }))
        : request<{ usuario: UsuarioAdmin; senhaProvisoria: string }>('/usuarios', {
            method: 'POST',
            body: p.dados,
          }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useAcaoUsuario() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: {
      id: string;
      acao: 'desativar' | 'reativar' | 'derrubar-sessoes' | 'redefinir-senha';
    }) => request<{ senhaProvisoria?: string } | null>(`/usuarios/${p.id}/${p.acao}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function usePapeisQuery() {
  const { request } = useApi();
  return useQuery({ queryKey: ['papeis'], queryFn: () => request<PapelAdmin[]>('/papeis') });
}

export function useSalvarPapel() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { id?: string; dados: PapelSalvar }) =>
      request<PapelAdmin>(p.id ? `/papeis/${p.id}` : '/papeis', {
        method: p.id ? 'PATCH' : 'POST',
        body: p.dados,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['papeis'] }),
  });
}

export function useRemoverPapel() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<void>(`/papeis/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['papeis'] }),
  });
}

export function useAuditoriaQuery(qs: MaybeRefOrGetter<string>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['auditoria', qs],
    queryFn: () =>
      request<{ data: AuditoriaLinha[]; meta: { page: number; pageSize: number; total: number } }>(
        `/auditoria?${toValue(qs)}`,
      ),
    placeholderData: keepPreviousData,
  });
}

/** Usuários online (aba da auditoria); atualiza sozinho a cada 30 s enquanto a aba está aberta. */
export function useUsuariosOnlineQuery(habilitado: MaybeRefOrGetter<boolean>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['auditoria-online'],
    queryFn: () => request<UsuariosOnline>('/auditoria/online'),
    enabled: () => toValue(habilitado),
    refetchInterval: 30_000,
  });
}

export function useAcoesAuditoriaQuery() {
  const { request } = useApi();
  return useQuery({ queryKey: ['auditoria-acoes'], queryFn: () => request<string[]>('/auditoria/acoes') });
}

export interface ClienteAdmin {
  id: string;
  nomeOriginal: string;
  segmentoOverride: Segmento | null;
}

export function useClientesAdminQuery(qs: MaybeRefOrGetter<string>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['clientes-admin', qs],
    queryFn: () =>
      request<{ data: ClienteAdmin[]; meta: { total: number; page: number; pageSize: number } }>(
        `/clientes?${toValue(qs)}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAtualizarCliente() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { id: string; segmentoOverride: Segmento | null }) =>
      request(`/clientes/${p.id}`, { method: 'PATCH', body: { segmentoOverride: p.segmentoOverride } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientes-admin'] }),
  });
}
