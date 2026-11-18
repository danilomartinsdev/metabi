<script setup lang="ts">
import type { TemaGrafico } from '~/utils/charts/palette';
import { useMesesQuery, useRankingQuery, useVisaoGeralQuery } from '~/composables/api/useDashboard';
import { periodoCurto, periodoPorExtenso, variacoesKpi } from '~/utils/periodo';
import { barrasRankingOptions, donutOptions, evolucaoOptions, fatiasDonut } from '~/utils/charts/options';
import { coresFatias } from '~/utils/charts/palette';

definePageMeta({ titulo: 'Visão geral', permissao: 'dashboard.view' });
useHead({ title: 'Visão geral — MetaBI' });

const route = useRoute();
const { qs, filtros } = useFiltros();
const meses = useMesesQuery();
const q = useVisaoGeralQuery(qs);
const v = computed(() => q.data.value);
const carregando = computed(() => q.isPending.value);
const donut = ref<'mapa' | 'regiao'>('mapa');
const can = useCan();
// Legenda da rosca como lista (mesmas cores das fatias): não trunca nem pagina os nomes.
const paleta = usePaletaGraficos();
const fatias = computed(() => fatiasDonut(v.value?.porRegiao ?? []));
const corFatia = (i: number) => {
  const c = coresFatias(paleta.value);
  return c[i % c.length]!;
};

// Divisões de venda em destaque (como na Análise de faturamento): rosca + lista clicável; a divisão
// escolhida filtra o ranking de representantes ao lado.
const divisoes = computed(() => v.value?.porDivisao ?? []);
const divisaoSel = ref<string | null>(null);
watch(divisoes, (ds) => {
  if (divisaoSel.value && !ds.some((d) => d.chave === divisaoSel.value)) divisaoSel.value = null;
});
const linhaSel = computed(() => divisoes.value.find((d) => d.chave === divisaoSel.value) ?? null);
/** Cor da divisão na lista: a da sua fatia (6 maiores) ou a de "Outros". */
const corDivisao = (i: number) => corFatia(Math.min(i, 6));
function escolherDivisao(chave: string | undefined) {
  if (!chave) return;
  divisaoSel.value = divisaoSel.value === chave ? null : chave;
}
function cliqueFatiaDivisao(nome?: string) {
  escolherDivisao(divisoes.value.find((d) => d.rotulo === nome)?.chave); // "Outros" não escolhe
}
function opcoesDivisoes(t: TemaGrafico) {
  const o = donutOptions(divisoes.value, t, { semLegenda: true });
  const s = (Array.isArray(o.series) ? o.series[0] : o.series) as { data?: { name: string }[] };
  const nome = linhaSel.value?.rotulo;
  const data = nome
    ? s.data?.map((d) => (d.name === nome ? d : { ...d, itemStyle: { opacity: 0.35 } }))
    : s.data;
  return { ...o, series: [{ ...s, data, cursor: 'pointer' }] } as typeof o;
}
const qsRanking = computed(() => {
  const p = new URLSearchParams(qs.value);
  if (divisaoSel.value) p.append('divisao', divisaoSel.value); // nomes têm vírgula: parâmetro repetido
  return p.toString();
});
const qRanking = useRankingQuery('gestores', qsRanking);
const linhasRanking = computed(() => qRanking.data.value?.linhas.slice(0, 10) ?? []);
const linkDivisoes = computed(() => ({
  path: '/dashboard/divisoes',
  query: { ...route.query, ...(divisaoSel.value ? { div: divisaoSel.value } : {}) },
}));

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
const serie = (k: 'total' | 'qtd' | 'ticket') => v.value?.kpis[k].serie.map((s) => Number(s.valor)) ?? [];
const variacoes = (k: 'total' | 'qtd' | 'ticket') =>
  v.value ? variacoesKpi(v.value.kpis[k], v.value.periodo) : [];
const ABAS_DONUT = [
  { label: 'Mapa', value: 'mapa' },
  { label: 'Região', value: 'regiao' },
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
            Evolução mensal {{ v ? periodoCurto(v.periodo.de, v.periodo.ate) : '' }} — real × ano anterior{{
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
                {{ periodoCurto(v.evolucao.atingimento.mesInicial, v.evolucao.atingimento.mesFinal) }}:
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
              rotulo="Participação das vendas por região"
              :opcoes="(t) => donutOptions(v!.porRegiao, t, { semLegenda: true })"
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

      <section aria-label="Divisões de venda" class="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-5">
        <div class="rounded-xl border bg-card p-5 xl:col-span-2">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <h3 class="text-sm font-medium text-muted-foreground">Vendas por divisão de venda</h3>
              <p v-if="divisoes.length" class="text-xs text-muted-foreground">
                Clique numa divisão para ver os representantes dela
              </p>
            </div>
            <NuxtLink
              :to="linkDivisoes"
              class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              title="Abrir divisões de venda em tela cheia, com ranking e pedidos"
            >
              <UIcon name="i-lucide-maximize-2" class="size-3" /> Ampliar
            </NuxtLink>
          </div>
          <div v-if="carregando" class="mx-auto mt-6 size-56 animate-pulse rounded-full bg-muted" />
          <p v-else-if="!divisoes.length" class="py-24 text-center text-sm text-muted-foreground">
            Sem vendas no período.
          </p>
          <template v-else>
            <ChartsBaseChart
              class="mx-auto mt-4 w-full max-w-72"
              altura="260px"
              :rotulo="`Vendas por divisão de venda: ${divisoes
                .slice(0, 3)
                .map((d) => `${d.rotulo} ${formatPct(d.participacao)}`)
                .join(', ')}`"
              :opcoes="opcoesDivisoes"
              @clique="(p) => cliqueFatiaDivisao(p.name)"
            />
            <!-- A lista faz de legenda: cada divisão com a cor da sua fatia; clicar filtra o ranking. -->
            <ul class="mt-4 divide-y border-t text-sm">
              <li v-for="(d, i) in divisoes" :key="d.chave">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
                  :class="divisaoSel === d.chave ? 'bg-primary-soft text-primary' : ''"
                  :aria-pressed="divisaoSel === d.chave"
                  @click="escolherDivisao(d.chave)"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <span
                      class="size-2.5 shrink-0 rounded-full"
                      :style="{ backgroundColor: corDivisao(i) }"
                      aria-hidden="true"
                    />
                    <span class="truncate" :title="d.rotulo">{{ d.rotulo }}</span>
                  </span>
                  <span class="num shrink-0 text-right">
                    {{ formatBRL(d.total) }}
                    <span class="ml-1 inline-block w-14 text-xs text-muted-foreground">{{
                      formatPct(d.participacao)
                    }}</span>
                  </span>
                </button>
              </li>
            </ul>
          </template>
        </div>

        <div class="rounded-xl border bg-card xl:col-span-3" aria-labelledby="titulo-rank-divisao">
          <div class="flex flex-wrap items-start justify-between gap-2 px-5 pt-5 pb-3">
            <div class="min-w-0">
              <h3 id="titulo-rank-divisao" class="text-sm font-medium text-muted-foreground">
                Ranking por representante
              </h3>
              <p v-if="linhaSel" class="truncate text-xs text-muted-foreground" :title="linhaSel.rotulo">
                Na divisão <b class="text-foreground">{{ linhaSel.rotulo }}</b> · % sobre o total da divisão
              </p>
              <p v-else class="text-xs text-muted-foreground">
                Os 10 maiores do período, em todas as divisões
              </p>
            </div>
            <UButton
              v-if="divisaoSel"
              color="neutral"
              variant="outline"
              size="xs"
              icon="i-lucide-x"
              label="Todas as divisões"
              @click="divisaoSel = null"
            />
          </div>
          <div v-if="qRanking.isPending.value" class="space-y-2 px-5 pb-5">
            <div v-for="i in 8" :key="i" class="h-8 animate-pulse rounded bg-muted" />
          </div>
          <UiExtraEstadoBloco
            v-else-if="qRanking.error.value"
            :erro="qRanking.error.value"
            @tentar-de-novo="qRanking.refetch()"
          />
          <p v-else-if="!linhasRanking.length" class="py-16 text-center text-sm text-muted-foreground">
            Sem vendas.
          </p>
          <div
            v-else
            class="overflow-x-auto"
            :class="qRanking.isFetching.value && 'opacity-60 transition-opacity'"
          >
            <table class="w-full text-sm">
              <thead class="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th class="w-10 px-3 py-2 text-left font-medium">#</th>
                  <th class="px-3 py-2 text-left font-medium">Representante</th>
                  <th class="px-3 py-2 text-right font-medium">Pedidos</th>
                  <th class="px-3 py-2 text-right font-medium">Valor</th>
                  <th class="px-3 py-2 text-right font-medium">% Part.</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="(l, i) in linhasRanking" :key="l.chave" class="hover:bg-muted/30">
                  <td class="px-3 py-2.5">
                    <span
                      class="num inline-grid size-6 place-items-center rounded-md text-xs font-semibold"
                      :class="i < 3 ? 'bg-primary-soft text-primary' : 'text-muted-foreground'"
                      :aria-label="`${i + 1}º lugar`"
                      >{{ i + 1 }}</span
                    >
                  </td>
                  <td class="max-w-72 truncate px-3 py-2.5 font-medium" :title="l.rotulo">{{ l.rotulo }}</td>
                  <td class="num px-3 py-2.5 text-right">{{ formatInt(l.qtd) }}</td>
                  <td class="num whitespace-nowrap px-3 py-2.5 text-right">{{ formatBRL(l.total) }}</td>
                  <td class="px-3 py-2.5">
                    <div class="flex items-center justify-end gap-2">
                      <div class="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                        <div
                          class="h-full rounded-full bg-primary"
                          :style="{ width: `${Math.round((l.participacao ?? 0) * 100)}%` }"
                        />
                      </div>
                      <span class="num w-14 text-right">{{ formatPct(l.participacao) }}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="linhasRanking.length" class="border-t px-5 py-3 text-right">
            <NuxtLink :to="linkDivisoes" class="text-xs font-medium text-primary hover:underline">
              {{
                linhaSel ? 'Ver a divisão completa, com os pedidos' : 'Ver todas as divisões, com os pedidos'
              }}
            </NuxtLink>
          </div>
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
