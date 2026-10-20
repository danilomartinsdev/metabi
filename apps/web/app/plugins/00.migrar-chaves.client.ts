import { migrarChavesAntigas } from '~/utils/migrar-chaves';

/**
 * Troca do nome para MetaBI (2026-10-20): as preferências salvas no navegador (tema, letra, cores,
 * novidades vistas, menu, colunas) passam de "meta-bi*" para "metabi*". Roda antes dos outros
 * plugins; sem armazenamento disponível, não faz nada.
 */
export default defineNuxtPlugin(() => {
  let migradas: string[];
  try {
    migradas = migrarChavesAntigas(localStorage);
  } catch {
    return;
  }
  // O tema claro/escuro é lido antes dos plugins (script do color-mode): reaplica o valor migrado.
  if (migradas.includes('metabi-tema')) {
    const pref = localStorage.getItem('metabi-tema');
    if (pref) useColorMode().preference = pref;
  }
});
