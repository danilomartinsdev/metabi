import type { ClientesResumo, DimensaoRanking, PedidoLinha, Ranking, VisaoGeral } from '@meta-bi/shared';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import type { MaybeRefOrGetter } from 'vue';
import { useApi } from './useApi';

export function useVisaoGeralQuery(qs: MaybeRefOrGetter<string>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['visao-geral', qs],
    queryFn: () => request<VisaoGeral>(`/dashboard/visao-geral?${toValue(qs)}`),
    placeholderData: keepPreviousData,
  });
}

export function useRankingQuery(dim: MaybeRefOrGetter<DimensaoRanking>, qs: MaybeRefOrGetter<string>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['ranking', dim, qs],
    queryFn: () => request<Ranking>(`/dashboard/ranking/${toValue(dim)}?${toValue(qs)}`),
    placeholderData: keepPreviousData,
  });
}

export function useClientesQuery(qs: MaybeRefOrGetter<string>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['clientes-resumo', qs],
    queryFn: () => request<ClientesResumo>(`/dashboard/clientes?${toValue(qs)}`),
    placeholderData: keepPreviousData,
  });
}

export function useMesesQuery() {
  const { request } = useApi();
  return useQuery({
    queryKey: ['meses'],
    queryFn: () => request<string[]>('/dashboard/meses'),
    staleTime: 300_000,
  });
}

export interface PaginaPedidos {
  data: PedidoLinha[];
  /** valorTotal: soma de todos os pedidos do filtro (não só da página), em "1234.56". */
  meta: { page: number; pageSize: number; total: number; valorTotal: string };
  periodo: { de: string; ate: string };
}

export function usePedidosQuery(qs: MaybeRefOrGetter<string>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['pedidos', qs],
    queryFn: () => request<PaginaPedidos>(`/pedidos?${toValue(qs)}`),
    placeholderData: keepPreviousData,
  });
}
