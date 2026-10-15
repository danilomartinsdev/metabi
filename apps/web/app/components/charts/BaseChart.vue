<script setup lang="ts">
import type { EChartsOption } from 'echarts';
import { BarChart, LineChart, MapChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import { lerTema, type TemaGrafico } from '~/utils/charts/palette';

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  MapChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
]);

const props = defineProps<{
  /** Função pura de utils/charts que recebe o tema atual. */
  opcoes: (tema: TemaGrafico) => EChartsOption;
  altura?: string;
  rotulo: string;
}>();
/** Clique num item do gráfico (repassa o evento do ECharts). */
const emit = defineEmits<{ clique: [params: { name?: string; data?: unknown }] }>();

const { isDark } = useTheme();
const paleta = usePaletaGraficos();
const { tema: temaCores } = useAparencia();
const tema = ref<TemaGrafico>(lerTema(paleta.value));
// Relê os tokens quando o tema (claro/escuro ou de cores) ou a paleta do usuário mudam (a classe .dark já foi aplicada no próximo tick).
watch([isDark, paleta, temaCores], () => nextTick(() => (tema.value = lerTema(paleta.value))));
const option = computed(() => props.opcoes(tema.value));
</script>

<template>
  <div role="img" :aria-label="rotulo" :style="{ height: altura ?? '280px' }">
    <VChart
      :option="option"
      autoresize
      class="size-full"
      @click="(p: { name?: string; data?: unknown }) => emit('clique', p)"
    />
  </div>
</template>
