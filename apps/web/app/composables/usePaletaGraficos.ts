import type { PaletaGrafico } from '@metabi/shared';
import { useAuthStore } from '~/stores/auth';

/**
 * Paleta de cores dos gráficos em uso: a do usuário logado ou, na página de impressão (PDF, sem sessão),
 * a de quem pediu o relatório (definida pela própria página via `useState('paleta-impressao')`).
 */
export function usePaletaGraficos() {
  const auth = useAuthStore();
  const impressao = useState<PaletaGrafico | null | undefined>('paleta-impressao', () => undefined);
  return computed<PaletaGrafico | null>(() =>
    impressao.value !== undefined ? impressao.value : (auth.usuario?.paletaGraficos ?? null),
  );
}
