<script setup lang="ts">
import { useMesesQuery, useVisaoGeralQuery } from '~/composables/api/useDashboard';
import { periodoPorExtenso, variacoesKpi } from '~/utils/periodo';
import { barrasRankingOptions, donutOptions, evolucaoOptions, fatiasDonut } from '~/utils/charts/options';
import { coresFatias } from '~/utils/charts/palette';

definePageMeta({ titulo: 'Visão geral', permissao: 'dashboard.view' });
useHead({ title: 'Visão geral — MetaBI' });

const { qs, filtros } = useFiltros();
const meses = useMesesQuery();
const q = useVisaoGeralQuery(qs);
const v = computed(() => q.data.value);
const carregando = computed(() => q.isPending.value);
const donut = ref<'mapa' | 'regiao' | 'segmento'>('mapa');
const can = useCan();
// Legenda da rosca como lista (mesmas cores das fatias): não trunca nem pagina os nomes.
const paleta = usePaletaGraficos();
const fatias = computed(() =>
  v.value ? fatiasDonut(donut.value === 'segmento' ? v.value.porSegmento : v.value.porRegiao) : [],
);
const corFatia = (i: number) => {
  const c = coresFatias(paleta.value);
  return c[i % c.length]!;
};

const NOMES_MES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const rotuloPeriodo = computed(() =>
  v.value ? periodoPorExtenso(v.value.periodo.de, v.value.periodo.ate) : '',
);
/** Último mês com pedidos importados (no escopo do usuário). */
const dadosAte = computed(() => {
  const m = meses.data.value?.at(-1);
  return m ? `${NOMES_MES[Number(m.slice(5)) - 1]} de ${m.slice(0, 4)}` : '';
});
const MES_CURTO = (n: number) => NOMES_MES[n - 1]!.slice(0, 3);
const serie = (k: 'total' | 'qtd' | 'ticket') => v.value?.kpis[k].serie.map((s) => Number(s.valor)) ?? [];
const variacoes = (k: 'total' | 'qtd' | 'ticket') =>
  v.value ? variacoesKpi(v.value.kpis[k], v.value.periodo) : [];
const ABAS_DONUT = [
  { label: 'Mapa', value: 'mapa' },
  { label: 'Região', value: 'regiao' },
  { label: 'Público × Privado', value: 'segmento' },
];
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-2xl font-semibold">Visão geral</h2>
        <p class="text-sm text-muted-foreground">
          {{ rotuloPeriodo || 'Carregando período…' }}
          <template v-if="dadosAte"> · dados importados até {{ dadosAte }}</template>
        </p>
      </div>
      <DashboardExportarMenu />
    </div>

    <DashboardFilterBar :periodo="v?.periodo" />

    <UAlert
      v-if="filtros.q"
      color="warning"
      variant="subtle"
      icon="i-lucide-search"
      :title="`Busca ativa: “${filtros.q}”`"
      description="Indicadores, gráficos e rankings consideram só os pedidos encontrados pela busca."
    />

    <UiExtraEstadoBloco v-if="q.error.value" :erro="q.error.value" @tentar-de-novo="q.refetch()" />
    <template v-else>
      <section aria-label="Indicadores" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpiCard
          rotulo="Total vendido"
          icone="i-lucide-dollar-sign"
          :carregando="carregando"
          :valor="formatBRL(v?.kpis.total.valor)"
          :variacoes="variacoes('total')"
          :serie="serie('total')"
        />
        <DashboardKpiCard
          rotulo="Pedidos"
          icone="i-lucide-shopping-cart"
          :carregando="carregando"
          :valor="formatInt(v?.kpis.qtd.valor)"
          :variacoes="variacoes('qtd')"
          :serie="serie('qtd')"
        />
        <DashboardKpiCard
          rotulo="Ticket médio"
          icone="i-lucide-receipt"
          :carregando="carregando"
          :valor="formatBRL(v?.kpis.ticket.valor)"
          :variacoes="variacoes('ticket')"
          :serie="serie('ticket')"
        />
        <DashboardKpiCard
          rotulo="% Público"
          icone="i-lucide-landmark"
          :carregando="carregando"
          :valor="formatPct(v?.kpis.pctPublico.valor)"
          :serie="v?.kpis.pctPublico.serie.map((s) => s.valor)"
          :variacoes="
            v ? [{ rotulo: `no ano anterior: ${formatPct(v.kpis.pctPublico.anoAnterior)}`, pct: null }] : []
          "
        />
      </section>

      <section v-if="v" aria-label="Abrangência" class="flex flex-wrap gap-2">
        <span
          v-for="c in [
            { n: v.contagens.estados, r: 'estados' },
            { n: v.contagens.regioes, r: 'regiões' },
            { n: v.contagens.gestores, r: 'representantes' },
            { n: v.contagens.clientes, r: 'clientes' },
          ]"
          :key="c.r"
          class="inline-flex gap-1 rounded-full border bg-card px-3 py-1 text-sm"
        >
          <span class="num font-semibold">{{ formatInt(c.n) }}</span>
          <span class="text-muted-foreground">{{ c.r }}</span>
        </span>
      </section>

      <section class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div class="rounded-xl border bg-card p-5 lg:col-span-2">
          <h3 class="text-sm font-medium text-muted-foreground">
            Evolução mensal {{ v?.evolucao.ano }} — real × ano anterior{{
              v?.evolucao.meses.some((m) => m.meta) ? ' × meta' : ''
            }}
          </h3>
          <div v-if="carregando" class="mt-4 h-72 animate-pulse rounded-lg bg-muted" />
          <ChartsBaseChart
            v-else-if="v"
            class="mt-2"
            altura="300px"
            rotulo="Gráfico de evolução mensal de vendas comparando com o ano anterior e a meta"
            :opcoes="(t) => evolucaoOptions(v!.evolucao, t)"
          />
          <p v-if="v" class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <template v-if="v.evolucao.atingimento">
              <span>
                Meta acumulada
                {{
                  v.evolucao.atingimento.mesInicial === v.evolucao.atingimento.mesFinal
                    ? MES_CURTO(v.evolucao.atingimento.mesFinal)
                    : `${MES_CURTO(v.evolucao.atingimento.mesInicial)}–${MES_CURTO(v.evolucao.atingimento.mesFinal)}`
                }}:
                <b class="num text-foreground">{{ formatBRL(v.evolucao.atingimento.meta) }}</b>
              </span>
              <span>
                Realizado: <b class="num text-foreground">{{ formatBRL(v.evolucao.atingimento.real) }}</b>
              </span>
              <span>
                Atingimento:
                <b
                  class="num"
                  :class="(v.evolucao.atingimento.pct ?? 0) >= 1 ? 'text-success' : 'text-warning'"
                  >{{ formatPct(v.evolucao.atingimento.pct) }}</b
                >
              </span>
            </template>
            <span v-else>
              Sem meta para o período.
              <NuxtLink
                v-if="can('metas.edit')"
                to="/admin/metas"
                class="font-medium text-primary hover:underline"
              >
                Definir metas
              </NuxtLink>
            </span>
          </p>
        </div>
        <div class="rounded-xl border bg-card p-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-medium text-muted-foreground">Participação</h3>
            <UTabs
              v-model="donut"
              :items="ABAS_DONUT"
              :content="false"
              size="xs"
              aria-label="Agrupar participação por"
            />
          </div>
          <div v-if="carregando" class="mx-auto mt-6 size-48 animate-pulse rounded-full bg-muted" />
          <p v-else-if="v && !v.porRegiao.length" class="py-20 text-center text-sm text-muted-foreground">
            Sem vendas no período.
          </p>
          <ChartsMapaBrasilChart
            v-else-if="v && donut === 'mapa'"
            nivel="regiao"
            :linhas="v.porRegiao"
            altura="290px"
          />
          <template v-else-if="v">
            <ChartsBaseChart
              class="mx-auto mt-4 w-full max-w-60"
              altura="200px"
              :rotulo="`Participação das vendas por ${donut === 'regiao' ? 'região' : 'segmento'}`"
              :opcoes="
                (t) =>
                  donutOptions(donut === 'regiao' ? v!.porRegiao : v!.porSegmento, t, { semLegenda: true })
              "
            />
            <ul class="mt-4 space-y-1.5 text-sm">
              <li v-for="(f, i) in fatias" :key="f.name" class="flex items-center justify-between gap-3">
                <span class="flex min-w-0 items-center gap-2">
                  <span
                    class="size-2.5 shrink-0 rounded-full"
                    :style="{ backgroundColor: corFatia(i) }"
                    aria-hidden="true"
                  />
                  <span class="truncate" :title="f.name">{{ f.name }}</span>
                </span>
                <span class="num shrink-0 text-right">
                  {{ formatBRL(f.value) }}
                  <span class="ml-1 inline-block w-12 text-xs text-muted-foreground">{{
                    formatPct(f.participacao)
                  }}</span>
                </span>
              </li>
            </ul>
          </template>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div class="rounded-xl border bg-card p-5 lg:col-span-2">
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 class="text-sm font-medium text-muted-foreground">Top 10 representantes</h3>
            <NuxtLink
              :to="{ path: '/dashboard/gestores', query: $route.query }"
              class="text-xs font-medium text-primary hover:underline"
            >
              Ver ranking completo
            </NuxtLink>
          </div>
          <div v-if="carregando" class="mt-4 h-72 animate-pulse rounded-lg bg-muted" />
          <p v-else-if="v && !v.topGestores.length" class="py-20 text-center text-sm text-muted-foreground">
            Sem vendas no período.
          </p>
          <ChartsBaseChart
            v-else-if="v"
            altura="320px"
            rotulo="Ranking dos 10 representantes com maior volume de vendas"
            :opcoes="(t) => barrasRankingOptions(v!.topGestores, t)"
          />
        </div>
        <div class="rounded-xl border bg-card p-5">
          <h3 class="text-sm font-medium text-muted-foreground">
            Comparativo com o ano anterior
            <span v-if="v" class="block text-xs font-normal">
              {{
                periodoPorExtenso(v.acumuladoSegmento.periodo.atual.de, v.acumuladoSegmento.periodo.atual.ate)
              }}
              ×
              {{
                periodoPorExtenso(
                  v.acumuladoSegmento.periodo.anterior.de,
                  v.acumuladoSegmento.periodo.anterior.ate,
                )
              }}
            </span>
          </h3>
          <ChartsComparativoAcumuladoChart :acumulado="v?.acumuladoSegmento" :carregando="carregando" />
        </div>
      </section>

      <DashboardDetalhamentoMensal
        :detalhamento="v?.detalhamentoMensal"
        :periodo="v?.periodo"
        :carregando="carregando"
      />
    </template>
  </div>
</template>
