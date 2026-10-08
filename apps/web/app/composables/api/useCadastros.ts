import type {
  HistoricoFaturamentoMes,
  HistoricoMes,
  PreviaImportacao,
  RepresentanteUpdate,
  Segmento,
  StatusPdvUpdate,
} from '@meta-bi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { MaybeRefOrGetter } from 'vue';
import { useApi } from './useApi';

export interface Representante {
  id: string;
  codigo: string;
  nomeExibicao: string;
  segmentoPadrao: Segmento | null;
  ativo: boolean;
}

export interface StatusPdv {
  id: string;
  codigo: string;
  descricao: string;
  contaNoTotal: boolean;
  cor: string;
}

export interface Lote {
  id: string;
  arquivoNome: string;
  arquivoTamanho: number;
  novos: number;
  atualizados: number;
  inalterados: number;
  ignorados: number;
  erros: number;
  status: 'APLICADO' | 'REVERTIDO';
  createdAt: string;
  revertidoEm: string | null;
  usuario: { nome: string };
  revertidoPor: { nome: string } | null;
}

export interface MetaCelula {
  mes: number;
  representanteId: string | null;
  valor: string;
}

export function useRepresentantesQuery() {
  const { request } = useApi();
  return useQuery({
    queryKey: ['representantes'],
    queryFn: () => request<Representante[]>('/representantes'),
  });
}

export function useAtualizarRepresentante() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: RepresentanteUpdate }) =>
      request<Representante>(`/representantes/${id}`, { method: 'PATCH', body: dados }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['representantes'] }),
  });
}

export function useStatusQuery() {
  const { request } = useApi();
  return useQuery({ queryKey: ['status-pdv'], queryFn: () => request<StatusPdv[]>('/status-pdv') });
}

export function useAtualizarStatus() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: StatusPdvUpdate }) =>
      request<StatusPdv>(`/status-pdv/${id}`, { method: 'PATCH', body: dados }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-pdv'] }),
  });
}

export function useLotesQuery() {
  const { request } = useApi();
  return useQuery({ queryKey: ['import-lotes'], queryFn: () => request<Lote[]>('/import/lotes') });
}

export function usePreviaImportacao() {
  const { request } = useApi();
  return useMutation({
    mutationFn: (arquivo: File) => {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      return request<PreviaImportacao>('/import/previa', { method: 'POST', body: fd });
    },
  });
}

export function useConfirmarImportacao() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { hash: string; arquivoNome: string }) =>
      request<{ novos: number; atualizados: number }>('/import/confirmar', { method: 'POST', body: p }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useReverterLote() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<void>(`/import/lotes/${id}/reverter`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useMetasQuery(ano: MaybeRefOrGetter<number>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['metas', ano],
    queryFn: () => request<MetaCelula[]>(`/metas?ano=${toValue(ano)}`),
  });
}

export function useSalvarMetas() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: {
      ano: number;
      metas: { mes: number; representanteId: string | null; valor: string | null }[];
    }) => request<MetaCelula[]>('/metas', { method: 'PUT', body: p }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['metas', v.ano] }),
  });
}

export function useHistoricoQuery(ano: MaybeRefOrGetter<number>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['historico', ano],
    queryFn: () => request<HistoricoMes[]>(`/historico?ano=${toValue(ano)}`),
  });
}

export function useSalvarHistorico() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { ano: number; meses: { mes: number; valor: string | null }[] }) =>
      request<HistoricoMes[]>('/historico', { method: 'PUT', body: p }),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['historico', v.ano] });
      // Os dashboards passam a usar os novos totais.
      void qc.invalidateQueries({ queryKey: ['visao-geral'] });
    },
  });
}

/** Faturamento manual por mês (aba Faturamento do Histórico). */
export function useHistoricoFaturamentoQuery(
  ano: MaybeRefOrGetter<number>,
  habilitado: MaybeRefOrGetter<boolean>,
) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['historico-faturamento', ano],
    queryFn: () => request<HistoricoFaturamentoMes[]>(`/historico/faturamento?ano=${toValue(ano)}`),
    enabled: () => toValue(habilitado),
  });
}

export function useSalvarHistoricoFaturamento() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { ano: number; meses: { mes: number; valor: string | null }[] }) =>
      request<HistoricoFaturamentoMes[]>('/historico/faturamento', { method: 'PUT', body: p }),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['historico-faturamento', v.ano] });
      // A tela de Faturamento passa a usar os novos valores.
      for (const k of [
        'faturamento-resumo',
        'faturamento-anos',
        'faturamento-mensal',
        'faturamento-comparativo',
      ])
        void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
