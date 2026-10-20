/*
 * Tema claro/escuro/sistema delegando ao color-mode do Nuxt UI (não ao do @vueuse).
 * API { mode, isDark, toggle } preservada — app.vue, BaseChart e ThemeToggle não mudam.
 * O color-mode do @nuxtjs/color-mode persiste a preferência em localStorage `metabi-tema`.
 */
export function useTheme() {
  const colorMode = useColorMode();
  const isDark = computed(() => colorMode.value === 'dark');

  function toggle() {
    colorMode.preference = isDark.value ? 'light' : 'dark';
  }

  return { mode: computed(() => colorMode.preference), isDark, toggle };
}
