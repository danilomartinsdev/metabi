import type { Preferencias, UsuarioLogado } from '@metabi/shared';
import { useMutation } from '@tanstack/vue-query';
import { useAuthStore } from '~/stores/auth';
import { useApi } from './useApi';

/** Salva as preferências do próprio usuário e atualiza o usuário em memória (os gráficos mudam na hora). */
export function useSalvarPreferencias() {
  const { request } = useApi();
  const auth = useAuthStore();
  return useMutation({
    mutationFn: (p: Preferencias) =>
      request<UsuarioLogado>('/auth/me/preferencias', { method: 'PATCH', body: p }),
    onSuccess: (u) => {
      auth.usuario = u;
    },
  });
}
