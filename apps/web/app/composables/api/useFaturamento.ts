import type {
  FaturamentoComparativo,
  FaturamentoMensal,
  FaturamentoResumo,
  LoteFaturamento,
  PreviaFaturamento,
} from '@metabi/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { MaybeRefOrGetter } from 'vue';
import { useApi } from './useApi';

/** Resumo da página de Faturamento (domínio separado dos pedidos). */
export function useFaturamentoResumoQuery(qs: MaybeRefOrGetter<string>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['faturamento-resumo', qs],
    queryFn: () => request<FaturamentoResumo>(`/faturamento/resumo?${toValue(qs)}`),
    placeholderData: keepPreviousData,
  });
}

/** Anos com faturamento importado (mais recente primeiro). */
export function useFaturamentoAnosQuery() {
  const { request } = useApi();
  return useQuery({ queryKey: ['faturamento-anos'], queryFn: () => request<number[]>('/faturamento/anos') });
}

/** Tabela mês a mês de um ano. */
export function useFaturamentoMensalQuery(ano: MaybeRefOrGetter<number | undefined>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['faturamento-mensal', ano],
    queryFn: () => request<FaturamentoMensal>(`/faturamento/mensal?ano=${toValue(ano)}`),
    enabled: () => !!toValue(ano),
    placeholderData: keepPreviousData,
  });
}

/** Comparativo entre dois anos (A = base, B = comparado). */
export function useFaturamentoComparativoQuery(
  anoA: MaybeRefOrGetter<number | undefined>,
  anoB: MaybeRefOrGetter<number | undefined>,
  /** Meses escolhidos (vazio = todos os meses com dado). */
  meses: MaybeRefOrGetter<number[]> = [],
) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['faturamento-comparativo', anoA, anoB, meses],
    queryFn: () => {
      const ms = toValue(meses);
      const filtro = ms.length ? `&meses=${ms.join(',')}` : '';
      return request<FaturamentoComparativo>(
        `/faturamento/comparativo?anoA=${toValue(anoA)}&anoB=${toValue(anoB)}${filtro}`,
      );
    },
    enabled: () => !!toValue(anoA) && !!toValue(anoB) && toValue(anoA) !== toValue(anoB),
    placeholderData: keepPreviousData,
  });
}

export function usePreviaFaturamento() {
  const { request } = useApi();
  return useMutation({
    mutationFn: (arquivo: File) => {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      return request<PreviaFaturamento>('/faturamento/import/previa', { method: 'POST', body: fd });
    },
  });
}

export function useConfirmarFaturamento() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { hash: string; arquivoNome: string; meses: number[] }) =>
      request<{ loteId: string; ano: number; meses: number[]; dias: number; substituidos: number }>(
        '/faturamento/import/confirmar',
        { method: 'POST', body: p },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['faturamento-resumo'] });
      void qc.invalidateQueries({ queryKey: ['faturamento-lotes'] });
      void qc.invalidateQueries({ queryKey: ['faturamento-anos'] });
      void qc.invalidateQueries({ queryKey: ['faturamento-mensal'] });
      void qc.invalidateQueries({ queryKey: ['faturamento-comparativo'] });
    },
  });
}

export function useLotesFaturamentoQuery(habilitado: MaybeRefOrGetter<boolean>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['faturamento-lotes'],
    queryFn: () => request<LoteFaturamento[]>('/faturamento/import/lotes'),
    enabled: () => toValue(habilitado),
  });
}
