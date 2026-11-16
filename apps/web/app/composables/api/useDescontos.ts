import type { DescontosAno, PrecosSalvar } from '@metabi/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { MaybeRefOrGetter } from 'vue';
import { useApi } from './useApi';

/** Previsão de descontos do ano: tabela de preços × vendido (itens de NF). */
export function useDescontosQuery(ano: MaybeRefOrGetter<number>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['descontos', ano],
    queryFn: () => request<DescontosAno>(`/descontos?ano=${toValue(ano)}`),
    placeholderData: keepPreviousData,
  });
}

/** Grava preços de um ano (só daquele ano). */
export function useSalvarPrecos() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: {
      ano: number;
      precos: { produtoCodigo: string; unidade: string; preco: string | null }[];
    }) => request<DescontosAno>('/descontos/precos', { method: 'PUT', body: p satisfies PrecosSalvar }),
    onSuccess: (d) => qc.setQueryData(['descontos', d.ano], d),
  });
}
