<script setup lang="ts">
import { PALETAS_GRAFICO, type PaletaGrafico } from '@metabi/shared';
import { useSalvarPreferencias } from '~/composables/api/usePreferencias';
import { PALETAS, aplicarPaleta, lerTema } from '~/utils/charts/palette';

const aberto = defineModel<boolean>('aberto', { required: true });
const aviso = useAviso();
const atual = usePaletaGraficos();
const { isDark } = useTheme();
const salvar = useSalvarPreferencias();

/** Amostras de cada paleta no tema atual (principal, comparação, meta e as fatias). */
const opcoes = computed(() => {
  // Tokens do tema atual sem paleta (lidos de novo quando o tema muda); cada opção aplica a sua por cima.
  const escuro = isDark.value;
  const base = lerTema(null);
  return PALETAS_GRAFICO.map((chave) => ({
    chave,
    nome: PALETAS[chave].nome,
    t: aplicarPaleta(base, chave, escuro),
  }));
});

async function escolher(chave: PaletaGrafico) {
  if (salvar.isPending.value) return;
  try {
    await salvar.mutateAsync({ paletaGraficos: chave === 'padrao' ? null : chave });
    aviso.sucesso(`Cores dos gráficos: ${PALETAS[chave].nome}.`);
  } catch (e) {
    aviso.erro(e, 'Não foi possível salvar a paleta.');
  }
}
</script>

<template>
  <UModal
    v-model:open="aberto"
    title="Cores dos gráficos"
    description="Vale só para você, em qualquer computador. Os PDFs que você gerar saem com estas cores."
  >
    <template #body>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Paleta dos gráficos">
        <button
          v-for="o in opcoes"
          :key="o.chave"
          type="button"
          role="radio"
          :aria-checked="(atual ?? 'padrao') === o.chave"
          class="rounded-xl border p-3 text-left transition-colors hover:border-primary/60 focus-visible:outline-2"
          :class="(atual ?? 'padrao') === o.chave && 'border-primary ring-2 ring-primary/30'"
          :disabled="salvar.isPending.value"
          @click="escolher(o.chave)"
        >
          <span class="flex items-center justify-between">
            <span class="text-sm font-medium">{{ o.nome }}</span>
            <UIcon v-if="(atual ?? 'padrao') === o.chave" name="i-lucide-check" class="size-4 text-primary" />
          </span>
          <!-- Mini gráfico: ano anterior × atual e a linha da meta -->
          <span class="mt-3 flex h-12 items-end gap-1.5" aria-hidden="true">
            <span v-for="(h, i) in [60, 45, 75, 55]" :key="i" class="flex h-full flex-1 items-end gap-0.5">
              <span
                class="w-1/2 rounded-t-sm"
                :style="{ height: `${h - 15}%`, background: o.t.comparacao, opacity: 0.6 }"
              />
              <span class="w-1/2 rounded-t-sm" :style="{ height: `${h}%`, background: o.t.primaria }" />
            </span>
          </span>
          <span class="mt-1 block h-0.5 rounded" :style="{ background: o.t.destaque }" aria-hidden="true" />
          <span class="mt-2 flex gap-1" aria-hidden="true">
            <span
              v-for="c in o.t.categorica.slice(0, 6)"
              :key="c"
              class="size-3 rounded-full"
              :style="{ background: c }"
            />
          </span>
        </button>
      </div>
    </template>
  </UModal>
</template>
