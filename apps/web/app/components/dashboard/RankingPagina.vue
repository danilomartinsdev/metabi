<script setup lang="ts">
import type { DimensaoRanking } from '@metabi/shared';
import { useRankingQuery } from '~/composables/api/useDashboard';
import { barrasRankingOptions } from '~/utils/charts/options';

const props = defineProps<{ dim: DimensaoRanking }>();
const ABAS: { dim: DimensaoRanking; rotulo: string; coluna: string }[] = [
  { dim: 'gestores', rotulo: 'Representantes', coluna: 'Representante' },
  { dim: 'estados', rotulo: 'Estados', coluna: 'UF' },
  { dim: 'regioes', rotulo: 'Regiões', coluna: 'Região' },
];
const aba = computed(() => ABAS.find((a) => a.dim === props.dim)!);

const { qs, filtros } = useFiltros();
const route = useRoute();
const q = useRankingQuery(() => props.dim, qs);
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h2 class="text-2xl font-semibold">Ranking de {{ aba.rotulo.toLowerCase() }}</h2>
      <div class="flex flex-wrap items-center gap-2">
        <DashboardExportarMenu :xlsx="dim" />
        <nav aria-label="Tipo de ranking">
          <UFieldGroup size="sm">
            <UButton
              v-for="a in ABAS"
              :key="a.dim"
              :to="{ path: `/dashboard/${a.dim}`, query: route.query }"
              :color="a.dim === dim ? 'primary' : 'neutral'"
              :variant="a.dim === dim ? 'solid' : 'outline'"
              :label="a.rotulo"
              :aria-current="a.dim === dim ? 'page' : undefined"
            />
          </UFieldGroup>
        </nav>
      </div>
    </div>

    <DashboardFilterBar :periodo="q.data.value?.periodo" />

    <UAlert
      v-if="filtros.q"
      color="warning"
      variant="subtle"
      icon="i-lucide-search"
      :title="`Busca ativa: “${filtros.q}”`"
      description="O ranking considera só os pedidos encontrados pela busca."
    />

    <!-- Mapa centralizado (regiões e estados): clique filtra. -->
    <section v-if="dim !== 'gestores'" class="rounded-xl border bg-card p-5">
      <div class="mx-auto max-w-2xl">
        <ChartsMapaBrasilChart
          :nivel="dim === 'regioes' ? 'regiao' : 'uf'"
          :linhas="q.data.value?.linhas"
          :carregando="q.isPending.value"
          altura="440px"
        />
      </div>
    </section>

    <section class="rounded-xl border bg-card p-5">
      <div v-if="q.isPending.value" class="h-80 animate-pulse rounded-lg bg-muted" />
      <ChartsBaseChart
        v-else-if="q.data.value?.linhas.length"
        :altura="`${Math.min(10, q.data.value.linhas.length) * 34 + 30}px`"
        :rotulo="`Gráfico do ranking de ${aba.rotulo.toLowerCase()}`"
        :opcoes="(t) => barrasRankingOptions(q.data.value!.linhas, t)"
      />
    </section>

    <section class="rounded-xl border bg-card">
      <UiExtraEstadoBloco
        :carregando="q.isPending.value"
        :erro="q.error.value"
        :vazio="!q.data.value?.linhas.length"
        texto-vazio="Sem vendas para os filtros escolhidos."
        @tentar-de-novo="q.refetch()"
      >
        <DashboardRankingTable
          v-if="q.data.value"
          :linhas="q.data.value.linhas"
          :total="q.data.value.total"
          :rotulo-coluna="aba.coluna"
        />
      </UiExtraEstadoBloco>
    </section>
  </div>
</template>
