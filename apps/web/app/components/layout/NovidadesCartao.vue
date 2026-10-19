<script setup lang="ts">
import type { Novidade } from '~/utils/novidades';

/**
 * Cartão discreto acima da barra flutuante: mostra só a novidade mais recente; as anteriores
 * ficam atrás de "Ver anteriores". Fechar (ou seguir um link) marca tudo como visto.
 */
const aberto = defineModel<boolean>('aberto', { required: true });
const props = defineProps<{ novidades: Novidade[]; naoVistas: Novidade[] }>();
const emit = defineEmits<{ vistas: [] }>();

const atual = computed(() => props.novidades[0]);
const anteriores = computed(() => props.novidades.slice(1));
const nova = computed(() => !!atual.value && props.naoVistas.some((n) => n.id === atual.value!.id));
const verAnteriores = ref(false);

watch(aberto, (v, antes) => {
  if (antes && !v) {
    emit('vistas');
    verAnteriores.value = false;
  }
});

function fechar() {
  aberto.value = false;
}
function aoTeclar(e: KeyboardEvent) {
  if (e.key === 'Escape' && aberto.value) fechar();
}
onMounted(() => window.addEventListener('keydown', aoTeclar));
onBeforeUnmount(() => window.removeEventListener('keydown', aoTeclar));
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-2 opacity-0"
    leave-active-class="transition duration-150 ease-in"
    leave-to-class="translate-y-2 opacity-0"
  >
    <section
      v-if="aberto"
      role="dialog"
      aria-labelledby="novidade-titulo"
      class="fixed right-4 bottom-[4.25rem] z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-card shadow-lg print:hidden"
    >
      <p v-if="!atual" class="p-4 text-sm text-muted-foreground">Nenhuma novidade por enquanto.</p>
      <div v-else class="p-4">
        <div class="flex items-start gap-3">
          <span class="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
            <UIcon name="i-lucide-sparkles" class="size-4" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-[11px] text-muted-foreground">
              <span v-if="nova" class="font-medium text-primary">Novidade</span>
              <span v-else>Última novidade</span>
              · {{ formatDate(atual.data) }}
            </p>
            <h2 id="novidade-titulo" class="mt-0.5 text-sm font-medium">{{ atual.titulo }}</h2>
          </div>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Fechar novidades"
            class="-mt-1 -mr-1"
            @click="fechar"
          />
        </div>
        <p class="mt-2 text-[13px] leading-relaxed text-muted-foreground">{{ atual.texto }}</p>

        <div class="mt-3 flex items-center justify-between gap-2">
          <button
            v-if="anteriores.length"
            type="button"
            class="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            :aria-expanded="verAnteriores"
            aria-controls="novidades-anteriores"
            @click="verAnteriores = !verAnteriores"
          >
            {{ verAnteriores ? 'Ocultar anteriores' : `Ver anteriores (${anteriores.length})` }}
            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 transition-transform"
              :class="verAnteriores && 'rotate-180'"
              aria-hidden="true"
            />
          </button>
          <span v-else />
          <div class="flex items-center gap-1">
            <UButton
              v-if="atual.para"
              :to="atual.para"
              size="xs"
              color="neutral"
              variant="ghost"
              trailing-icon="i-lucide-arrow-right"
              label="Abrir"
              @click="fechar"
            />
            <UButton size="xs" label="Entendi" @click="fechar" />
          </div>
        </div>
      </div>

      <ol
        v-if="verAnteriores"
        id="novidades-anteriores"
        class="max-h-64 space-y-3 overflow-y-auto border-t px-4 py-3"
      >
        <li v-for="n in anteriores" :key="n.id">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="text-[13px] font-medium">{{ n.titulo }}</h3>
            <span class="shrink-0 text-[11px] text-muted-foreground">{{ formatDate(n.data) }}</span>
          </div>
          <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">{{ n.texto }}</p>
          <NuxtLink
            v-if="n.para"
            :to="n.para"
            class="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            @click="fechar"
          >
            Abrir <UIcon name="i-lucide-arrow-right" class="size-3" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ol>
    </section>
  </Transition>
</template>
