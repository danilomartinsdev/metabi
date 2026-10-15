import { ESCALA_PADRAO } from '~/utils/aparencia';

/** Aplica no <html> o tamanho da fonte (font-size em %) e o tema de cores (`data-tema`) deste navegador. */
export default defineNuxtPlugin(() => {
  const { escala, tema } = useAparencia();
  const html = document.documentElement;
  watch(
    [escala, tema],
    ([e, t]) => {
      html.style.fontSize = e === ESCALA_PADRAO ? '' : `${e}%`;
      if (t === 'padrao') delete html.dataset.tema;
      else html.dataset.tema = t;
    },
    { immediate: true },
  );
});
