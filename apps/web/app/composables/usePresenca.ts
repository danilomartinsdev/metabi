import { useDocumentVisibility, useIntervalFn } from '@vueuse/core';
import { useApi } from './api/useApi';

/** Intervalo do sinal de presença (a API conta como online quem deu sinal nos últimos 5 minutos). */
const INTERVALO_MS = 60_000;

/**
 * Avisa a API que o usuário está com o sistema aberto (aba "Online" da auditoria).
 * Só manda sinal com a aba do navegador visível; falhas são ignoradas.
 */
export function usePresenca() {
  const { request } = useApi();
  const visibilidade = useDocumentVisibility();
  const sinal = () => {
    if (visibilidade.value === 'visible') request('/auth/presenca', { method: 'POST' }).catch(() => {});
  };
  useIntervalFn(sinal, INTERVALO_MS);
  watch(visibilidade, (v) => v === 'visible' && sinal());
  onMounted(sinal);
}
