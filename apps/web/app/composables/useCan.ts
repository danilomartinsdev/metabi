import type { Permission } from '@metabi/shared';
import { useAuthStore } from '~/stores/auth';

/** Controla o que aparece na UI. Conveniência apenas: a segurança está no backend. */
export function useCan() {
  const auth = useAuthStore();
  return (permissao: Permission) => auth.permissoes.has(permissao);
}
