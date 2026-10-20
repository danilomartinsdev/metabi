import type { AnaliseNotas, PreviaNotas } from '@metabi/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { MaybeRefOrGetter } from 'vue';
import { useApi } from './useApi';

/** Análise de faturamento por notas fiscais (divisões, representantes e curvas ABC). */
export function useAnaliseNotasQuery(qs: MaybeRefOrGetter<string>) {
  const { request } = useApi();
  return useQuery({
    queryKey: ['notas-analise', qs],
    queryFn: () => request<AnaliseNotas>(`/faturamento/notas/analise?${toValue(qs)}`),
    placeholderData: keepPreviousData,
  });
}

export function usePreviaNotas() {
  const { request } = useApi();
  return useMutation({
    mutationFn: (arquivo: File) => {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      return request<PreviaNotas>('/faturamento/notas/import/previa', { method: 'POST', body: fd });
    },
  });
}

export function useConfirmarNotas() {
  const { request } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { hash: string; arquivoNome: string }) =>
      request<{ loteId: string; meses: string[]; itens: number; substituidos: number }>(
        '/faturamento/notas/import/confirmar',
        { method: 'POST', body: p },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notas-analise'] });
    },
  });
}
