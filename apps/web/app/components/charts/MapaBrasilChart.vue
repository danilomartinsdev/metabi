<script lang="ts">
import { MapChart } from 'echarts/charts';
import { registerMap, use } from 'echarts/core';
import { MAPAS, type NivelMapa } from '~/utils/charts/mapa-brasil';

// No ECharts modular, registerMap só funciona depois que o tipo "map" foi instalado; sem isto, se a malha
// chegar antes de o BaseChart carregar, o registro vira no-op e o mapa quebra ("reading 'regions'").
use([MapChart]);

// Escopo de módulo: cada malha (IBGE) é baixada e registrada uma única vez, para todas as telas.
const cargas = new Map<NivelMapa, Promise<void>>();
function carregarMalha(nivel: NivelMapa) {
  let c = cargas.get(nivel);
  if (!c) {
    c = $fetch<Parameters<typeof registerMap>[1]>(MAPAS[nivel].arquivo).then((geo) =>
      registerMap(MAPAS[nivel].nome, geo),
    );
    cargas.set(nivel, c);
  }
  return c;
}
</script>

<script setup lang="ts">
import type { LinhaRanking } from '@metabi/shared';
import { buildMapaBrasilOptions } from '~/utils/charts/mapa-brasil';

const props = defineProps<{
  nivel: NivelMapa;
  linhas?: LinhaRanking[];
  carregando?: boolean;
  altura?: string;
}>();

const pronto = ref(false);
const falhou = ref(false);
watch(
  () => props.nivel,
  (nivel) => {
    pronto.value = false;
    carregarMalha(nivel)
      .then(() => (pronto.value = true))
      .catch(() => {
        cargas.delete(nivel);
        falhou.value = true;
      });
  },
  { immediate: true },
);

const { filtros, definir } = useFiltros();
const campo = computed(() => (props.nivel === 'regiao' ? 'regiao' : 'uf'));
const selecionados = computed(() => filtros.value[campo.value] as string[]);

/** Clique liga/desliga o filtro daquela região/UF (soma aos já selecionados). */
function alternar(p: { name?: string }) {
  const c = p.name;
  if (!c || !MAPAS[props.nivel].chaves.includes(c)) return;
  const atual = selecionados.value;
  definir({ [campo.value]: atual.includes(c) ? atual.filter((x) => x !== c) : [...atual, c] });
}

const foraDoMapa = computed(() =>
  props.linhas?.find((l) => l.chave === (props.nivel === 'regiao' ? 'EXTERIOR' : 'EX')),
);
const resumo = computed(() =>
  (props.linhas ?? [])
    .filter((l) => l !== foraDoMapa.value)
    .slice(0, 10)
    .map((l) => `${l.rotulo} ${formatPct(l.participacao)}`)
    .join(', '),
);
const nomeNivel = computed(() => (props.nivel === 'regiao' ? 'região' : 'estado'));
const dica = computed(() =>
  selecionados.value.length
    ? 'Clique de novo para tirar do filtro.'
    : props.nivel === 'regiao'
      ? 'Clique numa região para filtrar.'
      : 'Clique num estado para filtrar.',
);
</script>

<template>
  <div
    v-if="carregando || (!pronto && !falhou)"
    class="mx-auto mt-6 h-64 w-56 animate-pulse rounded-3xl bg-muted"
  />
  <p v-else-if="falhou" class="py-20 text-center text-sm text-muted-foreground">
    Não foi possível carregar o mapa.
  </p>
  <template v-else>
    <ChartsBaseChart
      :altura="altura ?? '300px'"
      class="cursor-pointer"
      :rotulo="`Mapa de vendas por ${nomeNivel}${resumo ? `: ${resumo}` : ''}. Clique para filtrar.`"
      :opcoes="(t) => buildMapaBrasilOptions(nivel, linhas ?? [], selecionados, t)"
      @clique="alternar"
    />
    <p class="mt-1 flex flex-wrap justify-center gap-x-4 text-center text-xs text-muted-foreground">
      <span>{{ dica }}</span>
      <span v-if="foraDoMapa"
        >Exterior: {{ formatBRL(foraDoMapa.total) }} ({{ formatPct(foraDoMapa.participacao) }})</span
      >
    </p>
  </template>
</template>
