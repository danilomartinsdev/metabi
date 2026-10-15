<script setup lang="ts">
import { ESCALAS_FONTE, ESCALA_PADRAO, OPCOES_TEMA } from '~/utils/aparencia';

// Barra flutuante (canto inferior direito): Novidades | A− A+ | tema. Fonte e tema ficam neste navegador.
const { escala, tema, aumentar, diminuir, definirTema } = useAparencia();
const colorMode = useColorMode();
const { isDark } = useTheme();
const novidadesAbertas = useState('novidades-abertas', () => false);

const minimo = computed(() => escala.value <= ESCALAS_FONTE[0]);
const maximo = computed(() => escala.value >= ESCALAS_FONTE[ESCALAS_FONTE.length - 1]!);
const rotuloFonte = computed(() =>
  escala.value === ESCALA_PADRAO ? 'Tamanho da letra: padrão' : `Tamanho da letra: ${escala.value}%`,
);

const ativa = (o: (typeof OPCOES_TEMA)[number]) =>
  tema.value === o.tema && isDark.value === (o.modo === 'escuro');
function escolher(o: (typeof OPCOES_TEMA)[number]) {
  definirTema(o.tema);
  colorMode.preference = o.modo === 'escuro' ? 'dark' : 'light';
}

const botao =
  'grid h-full place-items-center px-2.5 text-muted-foreground transition-colors hover:text-primary disabled:opacity-35 disabled:hover:text-muted-foreground';
</script>

<template>
  <div
    class="fixed right-4 bottom-4 z-40 flex h-11 items-center rounded-full border bg-card/95 px-1.5 shadow-lg backdrop-blur print:hidden"
  >
    <button
      type="button"
      :class="botao"
      aria-label="Novidades do sistema"
      title="Novidades do sistema"
      @click="novidadesAbertas = true"
    >
      <UIcon name="i-lucide-circle-help" class="size-5" />
    </button>
    <span class="mx-1 h-5 w-px bg-border" aria-hidden="true" />

    <div role="group" aria-label="Tamanho da letra" :title="rotuloFonte" class="flex h-full items-center">
      <button
        type="button"
        :class="[botao, 'text-xs font-semibold']"
        aria-label="Diminuir letra"
        :disabled="minimo"
        @click="diminuir"
      >
        A−
      </button>
      <button
        type="button"
        :class="[botao, 'text-base font-semibold']"
        aria-label="Aumentar letra"
        :disabled="maximo"
        @click="aumentar"
      >
        A+
      </button>
      <span class="sr-only" aria-live="polite">{{ rotuloFonte }}</span>
    </div>
    <span class="mx-1 h-5 w-px bg-border" aria-hidden="true" />

    <UPopover :content="{ side: 'top', align: 'end', sideOffset: 10 }">
      <button type="button" :class="[botao, 'text-primary']" aria-label="Tema" title="Tema">
        <UIcon name="i-lucide-palette" class="size-5" />
      </button>

      <template #content>
        <div class="w-64 p-2">
          <p class="px-2 pt-1 pb-2 text-xs text-muted-foreground">Tema</p>
          <ul role="radiogroup" aria-label="Tema" class="space-y-0.5">
            <li v-for="o in OPCOES_TEMA" :key="o.nome">
              <button
                type="button"
                role="radio"
                :aria-checked="ativa(o)"
                class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                :class="ativa(o) && 'bg-primary-soft'"
                @click="escolher(o)"
              >
                <!-- Amostra com as cores da própria opção (data-tema e .dark neste elemento). -->
                <span
                  :data-tema="o.tema"
                  class="grid size-6 shrink-0 place-items-center rounded-full border"
                  :class="o.modo === 'escuro' ? 'dark bg-background' : 'bg-primary-soft'"
                  aria-hidden="true"
                >
                  <span class="size-3 rounded-full bg-primary" />
                </span>
                <span class="flex-1">{{ o.nome }}</span>
                <span class="text-xs text-muted-foreground">{{ o.modo }}</span>
                <UIcon name="i-lucide-check" class="size-4 text-primary" :class="!ativa(o) && 'invisible'" />
              </button>
            </li>
          </ul>
        </div>
      </template>
    </UPopover>
  </div>
</template>
