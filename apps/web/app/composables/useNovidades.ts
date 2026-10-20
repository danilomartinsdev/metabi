import { NOVIDADES, novidadesNaoVistas, novidadesVisiveis } from '~/utils/novidades';

/**
 * Novidades do usuário logado. A última vista fica no navegador (conveniência por pessoa): se o
 * armazenamento falhar ou for limpo, as novidades só aparecem de novo — nada quebra.
 */
export function useNovidades() {
  const auth = useAuthStore();
  const chave = computed(() => (auth.usuario ? `metabi-novidades:${auth.usuario.id}` : null));
  const ultimaVista = ref<string | null>(null);

  watch(
    chave,
    (k) => {
      try {
        ultimaVista.value = k ? localStorage.getItem(k) : null;
      } catch {
        ultimaVista.value = null;
      }
    },
    { immediate: true },
  );

  const visiveis = computed(() =>
    novidadesVisiveis(NOVIDADES, { permissoes: auth.permissoes, escopoTipo: auth.usuario?.escopoTipo }),
  );
  const naoVistas = computed(() => novidadesNaoVistas(visiveis.value, ultimaVista.value));

  function marcarVistas() {
    const maisRecente = visiveis.value[0]?.id;
    if (!maisRecente || !chave.value) return;
    ultimaVista.value = maisRecente;
    try {
      localStorage.setItem(chave.value, maisRecente);
    } catch {
      // Sem armazenamento (janela privada etc.): segue só na memória desta aba.
    }
  }

  return { visiveis, naoVistas, marcarVistas };
}
