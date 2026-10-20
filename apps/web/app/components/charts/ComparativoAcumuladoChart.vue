<script setup lang="ts">
import type { VisaoGeral } from '@metabi/shared';
import {
  buildComparativoAcumuladoOptions,
  nomesPeriodos,
  temComparativo,
} from '~/utils/charts/comparativo-acumulado';

const props = defineProps<{
  acumulado?: VisaoGeral['acumuladoSegmento'];
  carregando?: boolean;
}>();

const nomes = computed(() => (props.acumulado ? nomesPeriodos(props.acumulado) : null));
const tem = computed(() => !!props.acumulado && temComparativo(props.acumulado));
const pct = computed(() => props.acumulado?.total.pct ?? null);
const classePct = computed(() =>
  pct.value === null ? 'text-muted-foreground' : pct.value >= 0 ? 'text-success' : 'text-danger',
);
</script>

<template>
  <div v-if="carregando" class="mt-4 h-64 animate-pulse rounded-lg bg-muted" />
  <p v-else-if="!acumulado || !nomes || !tem" class="py-20 text-center text-sm text-muted-foreground">
    Sem vendas para comparar.
  </p>
  <template v-else>
    <ChartsBaseChart
      class="mt-2"
      altura="260px"
      :rotulo="`Total vendido: ${nomes.atual} ${formatBRL(acumulado.total.atual)} contra ${nomes.anterior} ${formatBRL(acumulado.total.anterior)}`"
      :opcoes="(t) => buildComparativoAcumuladoOptions(acumulado!, t)"
    />
    <p class="mt-2 flex items-baseline justify-between border-t pt-2 text-sm">
      <span class="text-muted-foreground">Variação</span>
      <span class="num font-semibold" :class="classePct">
        {{ pct === null ? 'sem base de comparação' : formatPct(pct) }}
      </span>
    </p>
  </template>
</template>
