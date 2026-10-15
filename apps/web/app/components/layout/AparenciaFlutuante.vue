<script setup lang="ts">
import { ESCALAS_FONTE, ESCALA_PADRAO, TEMAS, type Tema } from '~/utils/aparencia';

// Botão flutuante (canto inferior direito): tamanho da fonte e tema de cores, salvos neste navegador.
const { escala, tema, aumentar, diminuir, restaurarFonte, definirTema } = useAparencia();
const temas = Object.entries(TEMAS).map(([chave, t]) => ({ chave: chave as Tema, nome: t.nome }));
const minimo = computed(() => escala.value <= ESCALAS_FONTE[0]);
const maximo = computed(() => escala.value >= ESCALAS_FONTE[ESCALAS_FONTE.length - 1]!);
</script>

<template>
  <UPopover :content="{ side: 'top', align: 'end', sideOffset: 8 }">
    <UButton
      icon="i-lucide-type"
      size="lg"
      class="fixed right-4 bottom-4 z-40 rounded-full shadow-lg print:hidden"
      aria-label="Aparência: tamanho da fonte e cores"
    />

    <template #content>
      <div class="w-72 space-y-4 p-4">
        <div>
          <p class="text-sm font-medium">Tamanho da fonte</p>
          <div class="mt-2 flex items-center gap-2">
            <UButton
              color="neutral"
              variant="outline"
              label="A−"
              class="font-semibold"
              aria-label="Diminuir fonte"
              :disabled="minimo"
              @click="diminuir"
            />
            <span class="num flex-1 text-center text-sm" aria-live="polite">{{ escala }}%</span>
            <UButton
              color="neutral"
              variant="outline"
              label="A+"
              class="text-base font-semibold"
              aria-label="Aumentar fonte"
              :disabled="maximo"
              @click="aumentar"
            />
          </div>
          <UButton
            v-if="escala !== ESCALA_PADRAO"
            color="neutral"
            variant="link"
            size="xs"
            label="Voltar ao tamanho padrão"
            class="mt-1 px-0"
            @click="restaurarFonte"
          />
        </div>

        <div>
          <p class="text-sm font-medium">Cores do sistema</p>
          <p class="text-xs text-muted-foreground">Valem no tema claro e no escuro.</p>
          <div class="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cores do sistema">
            <button
              v-for="t in temas"
              :key="t.chave"
              type="button"
              role="radio"
              :aria-checked="tema === t.chave"
              :data-tema="t.chave"
              class="flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-colors hover:bg-muted/40"
              :class="tema === t.chave && 'border-primary ring-2 ring-primary/30'"
              @click="definirTema(t.chave)"
            >
              <!-- Amostra com as cores do próprio tema (variáveis do data-tema neste botão). -->
              <span class="flex shrink-0 overflow-hidden rounded-md border" aria-hidden="true">
                <span class="size-4 bg-sidebar" />
                <span class="size-4 bg-primary" />
                <span class="size-4 bg-primary-soft" />
              </span>
              <span class="min-w-0 flex-1 truncate">{{ t.nome }}</span>
              <UIcon v-if="tema === t.chave" name="i-lucide-check" class="size-3.5 shrink-0 text-primary" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
