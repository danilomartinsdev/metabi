<script setup lang="ts">
import { type LinhaRanking, SEM_DIVISAO } from '@metabi/shared';
import { usePedidosQuery, useRankingQuery } from '~/composables/api/useDashboard';
import { barrasRankingOptions, donutOptions } from '~/utils/charts/options';
import { coresFatias, type TemaGrafico } from '~/utils/charts/palette';

// Participação por divisão de venda em tela cheia: rosca, ranking das divisões (com opção de ocultar),
// ranking de representantes e os pedidos das divisões visíveis (ou só da escolhida).
definePageMeta({ titulo: 'Divisões de venda', permissao: 'dashboard.view' });
useHead({ title: 'Divisões de venda — MetaBI' });

const route = useRoute();
const router = useRouter();
const can = useCan();
const { qs, filtros, query } = useFiltros();
const paleta = usePaletaGraficos();

// Estado da tela na URL (o link reproduz a mesma visão): divisões ocultas, divisão escolhida e paginação.
const comoLista = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).map(String);
const ocultas = computed(() => comoLista(route.query.ocultas));
const escolhida = computed(() => (typeof route.query.div === 'string' ? route.query.div : null));
type Ordem = 'dtEmissao' | 'valor' | 'cliente' | 'representante';
const page = computed(() => Number(route.query.page ?? 1) || 1);
const pageSize = computed(() => Number(route.query.pageSize ?? 25) || 25);
const sort = computed<Ordem>(() => (route.query.sort as Ordem) ?? 'valor');
const dir = computed(() => (route.query.dir === 'asc' ? 'asc' : 'desc'));

function navegar(p: Record<string, string | string[] | number | null>) {
  const q: Record<string, unknown> = { ...route.query };
  for (const [k, v] of Object.entries(p)) {
    if (v === null || (Array.isArray(v) && !v.length)) delete q[k];
    else q[k] = Array.isArray(v) ? v : String(v);
  }
  void router.replace({ query: q as Record<string, string | string[]> });
}

/** Query string com as divisões repetidas (?divisao=a&divisao=b): os nomes têm vírgula. */
function comDivisoes(base: string, divisoes: string[], extra: Record<string, string> = {}) {
  const p = new URLSearchParams(base);
  for (const d of divisoes) p.append('divisao', d);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

// Todas as divisões do período (lista de mostrar/ocultar) e só as visíveis (rosca e %).
const qTodas = useRankingQuery('divisoes', qs);
const todas = computed(() => qTodas.data.value?.linhas ?? []);
const visiveis = computed(() =>
  todas.value.filter((l) => !ocultas.value.includes(l.chave)).map((l) => l.chave),
);
const nenhumaVisivel = computed(() => todas.value.length > 0 && visiveis.value.length === 0);
const filtroVisiveis = computed(() => (ocultas.value.length ? visiveis.value : []));
const qVis = useRankingQuery(
  'divisoes',
  computed(() => comDivisoes(qs.value, filtroVisiveis.value)),
  () => !nenhumaVisivel.value,
);
const linhasVis = computed(() => (nenhumaVisivel.value ? [] : (qVis.data.value?.linhas ?? [])));
const porChave = computed(() => new Map(linhasVis.value.map((l, i) => [l.chave, { l, i }])));

// Divisões que valem para representantes e pedidos: a escolhida, ou as visíveis.
const filtroDetalhe = computed(() =>
  escolhida.value && !ocultas.value.includes(escolhida.value) ? [escolhida.value] : filtroVisiveis.value,
);
const qsDetalhe = computed(() => comDivisoes(qs.value, filtroDetalhe.value));
const qGestores = useRankingQuery('gestores', qsDetalhe, () => !nenhumaVisivel.value);
const podeVerPedidos = computed(() => can('pedidos.view'));
const qPedidos = usePedidosQuery(
  computed(() =>
    comDivisoes(qs.value, filtroDetalhe.value, {
      page: String(page.value),
      pageSize: String(pageSize.value),
      sort: sort.value,
      dir: dir.value,
    }),
  ),
  () => podeVerPedidos.value && !nenhumaVisivel.value,
);

// Filtros, divisões ocultas ou escolhida mudaram → volta para a página 1 dos pedidos.
watch(
  () => JSON.stringify([qs.value, filtroDetalhe.value]),
  () => page.value !== 1 && navegar({ page: null }),
);

/** Cor da divisão visível: a da sua fatia (as 6 maiores) ou a de "Outros". */
function cor(chave: string) {
  const x = porChave.value.get(chave);
  if (!x) return null;
  const c = coresFatias(paleta.value);
  return c[Math.min(x.i, 6) % c.length]!;
}

function alternarOculta(chave: string) {
  const ja = ocultas.value.includes(chave);
  navegar({
    ocultas: ja ? ocultas.value.filter((c) => c !== chave) : [...ocultas.value, chave],
    div: !ja && escolhida.value === chave ? null : (escolhida.value ?? null),
  });
}
function escolher(chave: string) {
  if (ocultas.value.includes(chave)) return;
  navegar({ div: escolhida.value === chave ? null : chave });
}
function cliqueFatia(nome?: string) {
  const l = linhasVis.value.find((x) => x.rotulo === nome); // "Outros" não escolhe
  if (l) escolher(l.chave);
}
/** Rosca com a divisão escolhida em destaque e as demais esmaecidas (como na Análise de faturamento). */
function opcoesRosca(t: TemaGrafico) {
  const o = donutOptions(linhasVis.value, t, { semLegenda: true });
  const nome = escolhida.value ? porChave.value.get(escolhida.value)?.l.rotulo : null;
  const serie = (Array.isArray(o.series) ? o.series[0] : o.series) as
    { data?: { name: string }[] } | undefined;
  if (nome && serie?.data) {
    serie.data = serie.data.map((d) => (d.name === nome ? d : { ...d, itemStyle: { opacity: 0.35 } }));
  }
  return { ...o, series: [{ ...serie, cursor: 'pointer' }] } as typeof o;
}
const rotuloDe = (chave: string) => todas.value.find((l) => l.chave === chave)?.rotulo ?? chave;
const descricaoDetalhe = computed(() =>
  escolhida.value && filtroDetalhe.value.length === 1
    ? `na divisão ${rotuloDe(escolhida.value)}`
    : ocultas.value.length
      ? `nas ${visiveis.value.length} divisões visíveis`
      : 'em todas as divisões',
);

function ordenar(col: Ordem) {
  navegar({ sort: col, dir: sort.value === col && dir.value === 'desc' ? 'asc' : 'desc', page: null });
}
const COLUNAS: { k: string; r: string; ordem?: Ordem; num?: boolean }[] = [
  { k: 'numPedido', r: 'Nº pedido' },
  { k: 'dtEmissao', r: 'Emissão', ordem: 'dtEmissao' },
  { k: 'cliente', r: 'Cliente', ordem: 'cliente' },
  { k: 'uf', r: 'UF' },
  { k: 'gestor', r: 'Representante', ordem: 'representante' },
  { k: 'divisao', r: 'Divisão' },
  { k: 'valor', r: 'Valor', ordem: 'valor', num: true },
];
const pct = (l: LinhaRanking | undefined) => (l ? formatPct(l.participacao) : '—');
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <NuxtLink
          :to="{ path: '/dashboard', query }"
          class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <UIcon name="i-lucide-arrow-left" class="size-3" /> Visão geral
        </NuxtLink>
        <h2 class="text-2xl font-semibold">Divisões de venda</h2>
      </div>
    </div>

    <DashboardFilterBar :periodo="qTodas.data.value?.periodo" />

    <UAlert
      v-if="filtros.q"
      color="warning"
      variant="subtle"
      icon="i-lucide-search"
      :title="`Busca ativa: “${filtros.q}”`"
      description="A tela considera só os pedidos encontrados pela busca."
    />

    <section
      v-if="qTodas.error.value || qTodas.isPending.value || !todas.length"
      class="rounded-xl border bg-card"
    >
      <UiExtraEstadoBloco
        :carregando="qTodas.isPending.value"
        :erro="qTodas.error.value"
        :vazio="!todas.length"
        texto-vazio="Sem vendas para os filtros escolhidos."
        @tentar-de-novo="qTodas.refetch()"
      />
    </section>
    <template v-else>
      <section class="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        <div class="rounded-xl border bg-card p-5 lg:col-span-2">
          <h3 class="text-sm font-medium text-muted-foreground">Participação</h3>
          <p class="text-xs text-muted-foreground">
            {{ ocultas.length ? '% sobre as divisões visíveis' : '% sobre o total do período' }}
          </p>
          <p v-if="nenhumaVisivel" class="py-24 text-center text-sm text-muted-foreground">
            Todas as divisões estão ocultas.
          </p>
          <div
            v-else-if="qVis.isPending.value"
            class="mx-auto mt-8 size-72 animate-pulse rounded-full bg-muted"
          />
          <template v-else>
            <ChartsBaseChart
              class="mx-auto mt-4 w-full max-w-sm"
              altura="340px"
              :rotulo="`Participação das vendas por divisão de venda: ${linhasVis
                .map((l) => `${l.rotulo} ${formatPct(l.participacao)}`)
                .join(', ')}`"
              :opcoes="opcoesRosca"
              @clique="(p) => cliqueFatia(p.name)"
            />
            <p class="mt-2 text-center text-xs text-muted-foreground">
              Total visível
              <b class="num text-foreground">{{ formatBRL(qVis.data.value?.total.total) }}</b>
              · {{ formatInt(qVis.data.value?.total.qtd) }} pedidos
            </p>
          </template>
        </div>

        <!-- Ranking das divisões: faz de legenda da rosca. Olho oculta/mostra; nome escolhe a divisão. -->
        <div class="rounded-xl border bg-card p-5 lg:col-span-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="text-sm font-medium text-muted-foreground">Ranking das divisões</h3>
              <p class="text-xs text-muted-foreground">
                Clique no nome para ver só aquela divisão · use o olho para ocultar
              </p>
            </div>
            <div class="flex gap-2">
              <UButton
                v-if="escolhida"
                size="xs"
                color="neutral"
                variant="outline"
                icon="i-lucide-x"
                label="Todas as divisões"
                @click="navegar({ div: null })"
              />
              <UButton
                v-if="ocultas.length"
                size="xs"
                color="neutral"
                variant="outline"
                icon="i-lucide-eye"
                :label="`Mostrar ocultas (${ocultas.length})`"
                @click="navegar({ ocultas: [] })"
              />
            </div>
          </div>
          <div class="mt-3 overflow-x-auto">
            <table
              class="w-full text-sm [&_td]:px-2 [&_td:first-child]:pl-0 [&_td:last-child]:pr-0 [&_th]:px-2 [&_th:first-child]:pl-0 [&_th:last-child]:pr-0"
            >
              <thead class="text-xs text-muted-foreground">
                <tr class="border-b">
                  <th class="w-8 py-2 text-left font-medium">#</th>
                  <th class="py-2 text-left font-medium">Divisão</th>
                  <th class="py-2 text-right font-medium">Valor</th>
                  <th class="hidden py-2 text-right font-medium sm:table-cell">Pedidos</th>
                  <th class="hidden py-2 text-right font-medium md:table-cell">Ticket</th>
                  <th class="py-2 text-right font-medium">%</th>
                  <th class="w-10 py-2"><span class="sr-only">Mostrar ou ocultar</span></th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr
                  v-for="(d, i) in todas"
                  :key="d.chave"
                  :class="[
                    ocultas.includes(d.chave) && 'text-muted-foreground opacity-60',
                    escolhida === d.chave && 'bg-primary-soft',
                  ]"
                >
                  <td class="num py-2 text-xs text-muted-foreground">{{ i + 1 }}</td>
                  <td class="w-full max-w-0 py-2 pr-3">
                    <button
                      type="button"
                      class="flex w-full min-w-0 items-center gap-2 text-left hover:text-primary disabled:cursor-default disabled:hover:text-inherit"
                      :class="escolhida === d.chave && 'font-medium text-primary'"
                      :disabled="ocultas.includes(d.chave)"
                      :aria-pressed="escolhida === d.chave"
                      @click="escolher(d.chave)"
                    >
                      <span
                        class="size-2.5 shrink-0 rounded-full"
                        :class="!cor(d.chave) && 'border border-muted-foreground'"
                        :style="cor(d.chave) ? { backgroundColor: cor(d.chave)! } : undefined"
                        aria-hidden="true"
                      />
                      <span class="truncate" :title="d.rotulo">{{ d.rotulo }}</span>
                    </button>
                  </td>
                  <td class="num whitespace-nowrap py-2 text-right">{{ formatBRL(d.total) }}</td>
                  <td class="num hidden py-2 text-right sm:table-cell">{{ formatInt(d.qtd) }}</td>
                  <td class="num hidden whitespace-nowrap py-2 text-right md:table-cell">
                    {{ formatBRL(d.ticket) }}
                  </td>
                  <td class="num whitespace-nowrap py-2 text-right text-xs">
                    {{ ocultas.includes(d.chave) ? '—' : pct(porChave.get(d.chave)?.l) }}
                  </td>
                  <td class="py-2 text-right">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :icon="ocultas.includes(d.chave) ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      :aria-label="`${ocultas.includes(d.chave) ? 'Mostrar' : 'Ocultar'} ${d.rotulo}`"
                      :title="ocultas.includes(d.chave) ? 'Mostrar' : 'Ocultar'"
                      @click="alternarOculta(d.chave)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="todas.some((d) => d.chave === SEM_DIVISAO)" class="mt-3 text-xs text-muted-foreground">
            “Sem divisão”: pedidos importados antes de o relatório trazer a coluna DIVISAO VENDA. Reimporte o
            relatório para classificá-los.
          </p>
        </div>
      </section>

      <section v-if="!nenhumaVisivel" class="rounded-xl border bg-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div>
            <h3 class="text-sm font-medium text-muted-foreground">Top 10 representantes</h3>
            <p class="text-xs text-muted-foreground">Vendas {{ descricaoDetalhe }}</p>
          </div>
        </div>
        <div v-if="qGestores.isPending.value" class="mt-4 h-72 animate-pulse rounded-lg bg-muted" />
        <p
          v-else-if="!qGestores.data.value?.linhas.length"
          class="py-16 text-center text-sm text-muted-foreground"
        >
          Sem vendas.
        </p>
        <ChartsBaseChart
          v-else
          :altura="`${Math.min(10, qGestores.data.value.linhas.length) * 34 + 30}px`"
          :rotulo="`Ranking dos representantes ${descricaoDetalhe}`"
          :opcoes="(t) => barrasRankingOptions(qGestores.data.value!.linhas, t)"
        />
      </section>

      <section v-if="podeVerPedidos && !nenhumaVisivel" class="rounded-xl border bg-card">
        <div class="flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-5">
          <div>
            <h3 class="text-sm font-medium text-muted-foreground">Pedidos</h3>
            <p class="text-xs text-muted-foreground">{{ descricaoDetalhe }}</p>
          </div>
          <p v-if="qPedidos.data.value" class="text-sm">
            <b class="num">{{ formatInt(qPedidos.data.value.meta.total) }}</b> pedidos ·
            <b class="num">{{ formatBRL(qPedidos.data.value.meta.valorTotal) }}</b>
          </p>
        </div>
        <UiExtraEstadoBloco
          :carregando="qPedidos.isPending.value"
          :erro="qPedidos.error.value"
          :vazio="!qPedidos.data.value?.data.length"
          texto-vazio="Nenhum pedido."
          :linhas="8"
          @tentar-de-novo="qPedidos.refetch()"
        >
          <div class="overflow-x-auto" :class="qPedidos.isFetching.value && 'opacity-60 transition-opacity'">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th
                    v-for="c in COLUNAS"
                    :key="c.k"
                    class="whitespace-nowrap px-3 py-3 font-medium first:pl-5 last:pr-5"
                    :class="c.num ? 'text-right' : 'text-left'"
                    :aria-sort="
                      c.ordem && sort === c.ordem ? (dir === 'asc' ? 'ascending' : 'descending') : undefined
                    "
                  >
                    <button
                      v-if="c.ordem"
                      type="button"
                      class="inline-flex items-center gap-1 hover:text-foreground"
                      @click="ordenar(c.ordem)"
                    >
                      {{ c.r }}
                      <UIcon
                        v-if="sort === c.ordem"
                        :name="dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
                        class="size-3"
                      />
                    </button>
                    <template v-else>{{ c.r }}</template>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="p in qPedidos.data.value?.data" :key="p.id" class="hover:bg-muted/30">
                  <td class="num px-3 py-2.5 pl-5">{{ p.numPedido }}</td>
                  <td class="num whitespace-nowrap px-3 py-2.5">{{ formatDate(p.dtEmissao) }}</td>
                  <td class="px-3 py-2.5">
                    <span class="block max-w-72 truncate" :title="p.cliente">{{ p.cliente }}</span>
                  </td>
                  <td class="px-3 py-2.5">{{ p.uf }}</td>
                  <td class="whitespace-nowrap px-3 py-2.5">{{ p.gestor }}</td>
                  <td class="px-3 py-2.5">
                    <span class="block max-w-60 truncate" :title="p.divisao ?? 'Sem divisão'">
                      {{ p.divisao ?? 'Sem divisão' }}
                    </span>
                  </td>
                  <td class="num whitespace-nowrap px-3 py-2.5 pr-5 text-right">{{ formatBRL(p.valor) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <UiExtraPaginacaoBar
            :pagina="page"
            :por-pagina="pageSize"
            :total="qPedidos.data.value?.meta.total ?? 0"
            rotulo="pedidos"
            @update:pagina="(p) => navegar({ page: p })"
            @update:por-pagina="(n) => navegar({ pageSize: n, page: null })"
          />
        </UiExtraEstadoBloco>
      </section>
    </template>
  </div>
</template>
