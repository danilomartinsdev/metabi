import type { AnaliseDescontos, AnoNovo, PrecosSalvar, ProdutoNovo, TabelaPrecos } from '@metabi/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { MaybeRefOrGetter } from 'vue';
import { useApi } from './useApi';

/** Análise de descontos do período (qs = "de=AAAA-MM&ate=AAAA-MM"; vazio = ano corrente das notas). */
export function useAnaliseDescontosQuery(qs: MaybeRefOrGetter<string>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['descontos', qs],
    queryFn: () => request<AnaliseDescontos>(`/descontos?${toValue(qs)}`),
    placeholderData: keepPreviousData,
  });
}

/** Tabela de preços de um ano (produtos das notas + incluídos à mão). */
export function usePrecosQuery(ano: MaybeRefOrGetter<number>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['precos', ano],
    queryFn: () => request<TabelaPrecos>(`/precos?ano=${toValue(ano)}`),
    placeholderData: keepPreviousData,
  });
}

/** Grava preços de um ano (só daquele ano). A análise de descontos é recalculada na próxima leitura. */
export function useSalvarPrecos() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: PrecosSalvar) => request<TabelaPrecos>('/precos', { method: 'PUT', body: p }),
    onSuccess: (t) => {
      qc.setQueryData(['precos', t.ano], t);
      void qc.invalidateQueries({ queryKey: ['descontos'] });
    },
  });
}

/** Inclui um ano na tabela de preços (opcionalmente copiando os preços de outro ano). */
export function useIncluirAno() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: AnoNovo) => request<TabelaPrecos>('/precos/anos', { method: 'POST', body: p }),
    onSuccess: (t) => {
      qc.setQueryData(['precos', t.ano], t);
      void qc.invalidateQueries({ queryKey: ['precos'] });
    },
  });
}

/** Retira um ano da tabela de preços (apaga os preços dele). */
export function useExcluirAno() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ano: number) => request<void>(`/precos/anos/${ano}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['precos'] });
      void qc.invalidateQueries({ queryKey: ['descontos'] });
    },
  });
}

export function useIncluirProduto() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ProdutoNovo) =>
      request<{ codigo: string; unidade: string }>('/precos/produtos', { method: 'POST', body: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['precos'] }),
  });
}

export function useExcluirProduto() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { codigo: string; unidade: string }) =>
      request<void>(`/precos/produtos?${new URLSearchParams(p)}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['precos'] });
      void qc.invalidateQueries({ queryKey: ['descontos'] });
    },
  });
}
