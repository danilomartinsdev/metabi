<script setup lang="ts">
import { useRepresentantesQuery } from '~/composables/api/useCadastros';
import {
  useClientesQuery,
  usePedidosQuery,
  useRankingQuery,
  useVisaoGeralQuery,
} from '~/composables/api/useDashboard';
import { useAuthStore } from '~/stores/auth';
import { barrasRankingOptions, evolucaoOptions } from '~/utils/charts/options';
import { atingimentoDoMes } from '~/utils/minhas-vendas';
import { periodoPorExtenso, variacoesKpi } from '~/utils/periodo';

// Os dados já vêm filtrados pelo escopo no backend (só os representantes ligados ao usuário); aqui ele
// escolhe o período e, se tiver mais de um representante, quais mostrar (a API intersecta com o escopo).
// Aparece por permissão (Administração › Papéis), como em MINHAS_VENDAS (utils/navegacao).
definePageMeta({ titulo: 'Minhas vendas', permissao: 'minhas-vendas.view' });
useHead({ title: 'Minhas vendas — MetaBI' });

const auth = useAuthStore();
// Os links "Ver todos" levam a telas com permissão própria; quem só tem Minhas vendas não os vê.
const can = useCan();
const { filtros, definir } = useFiltros();
const qs = computed(() => {
  const p = new URLSearchParams();
  if (filtros.value.de) p.set('de', filtros.value.de);
  if (filtros.value.ate) p.set('ate', filtros.value.ate);
  if (filtros.value.gestor.length) p.set('gestor', filtros.value.gestor.join(','));
  return p.toString();
});
const qsPedidos = computed(() => {
  const p = new URLSearchParams(qs.value);
  p.set('page', '1');
  p.set('pageSize', '8');
  p.set('sort', 'dtEmissao');
  p.set('dir', 'desc');
  return p.toString();
});

const q = useVisaoGeralQuery(qs);
const clientes = useClientesQuery(qs);
const estados = useRankingQuery('estados', qs);
const pedidos = usePedidosQuery(qsPedidos);
const reps = useRepresentantesQuery();

const v = computed(() => q.data.value);
const carregando = computed(() => q.isPending.value);
const primeiroNome = computed(() => auth.usuario?.nome.split(' ')[0] ?? '');
/** Representantes ligados ao usuário (a API devolve só esses) e os que ele escolheu mostrar. */
const opcoesRep = computed(() =>
  (reps.data.value ?? []).map((r) => ({ valor: r.id, rotulo: r.nomeExibicao })),
);
const codigos = computed(() => {
  const sel = filtros.value.gestor;
  return opcoesRep.value
    .filter((o) => !sel.length || sel.includes(o.valor))
    .map((o) => o.rotulo)
    .join(', ');
});
const rotuloPeriodo = computed(() =>
  v.value ? periodoPorExtenso(v.value.periodo.de, v.value.periodo.ate) : '',
);
const linkPeriodo = computed(() => ({
  de: filtros.value.de,
  ate: filtros.value.ate,
  ...(filtros.value.gestor.length ? { gestor: filtros.value.gestor.join(',') } : {}),
}));

const serie = (k: 'total' | 'qtd' | 'ticket') => v.value?.kpis[k].serie.map((s) => Number(s.valor)) ?? [];
const variacoes = (k: 'total' | 'qtd' | 'ticket') =>
  v.value ? variacoesKpi(v.value.kpis[k], v.value.periodo) : [];

const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MES = (n: number) => NOMES_MES[n - 1]!;
const metaMes = computed(() => (v.value ? atingimentoDoMes(v.value.evolucao, v.value.periodo) : null));
const metaAno = computed(() => v.value?.evolucao.atingimento ?? null);
/** Atingimento no mês final do período e acumulado no ano (só os que têm meta). */
const blocosMeta = computed(() => {
  const b: { r: string; meta: string; real: string; pct: number | null }[] = [];
  if (metaMes.value) b.push({ ...metaMes.value, r: `Em ${MES(metaMes.value.mes)}` });
  const a = metaAno.value;
  if (a) {
    const meses = a.mesInicial === a.mesFinal ? MES(a.mesFinal) : `${MES(a.mesInicial)}–${MES(a.mesFinal)}`;
    b.push({ ...a, r: `Acumulado ${meses}` });
  }
  return b;
});
const barra = (pct: number | null | undefined) => `${Math.min(Math.max(pct ?? 0, 0), 1) * 100}%`;
const corPct = (pct: number | null | undefined) => ((pct ?? 0) >= 1 ? 'text-success' : 'text-warning');

const COR: Record<string, string> = {
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary',
  highlight: 'bg-highlight/15 text-highlight',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
};
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-2xl font-semibold">Olá, {{ primeiroNome }}</h2>
        <p class="text-sm text-muted-foreground">
          {{ rotuloPeriodo || 'Carregando período…' }}
          <template v-if="codigos"> · representante {{ codigos }}</template>
        </p>
      </div>
      <DashboardExportarMenu />
    </div>

    <DashboardFilterBar :periodo="v?.periodo" somente-periodo>
      <DashboardMultiFiltro
        v-if="opcoesRep.length > 1"
        rotulo="Representante"
        :opcoes="opcoesRep"
        :selecionados="filtros.gestor"
        @alterar="(v) => definir({ gestor: v })"
      />
    </DashboardFilterBar>

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

        <div class="flex flex-col rounded-xl border bg-card p-5" aria-label="Atingimento da meta">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-muted-foreground">Meta</span>
            <span class="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary">
              <UIcon name="i-lucide-target" class="size-4" aria-hidden="true" />
            </span>
          </div>
          <template v-if="carregando">
            <div class="mt-4 h-8 w-3/4 animate-pulse rounded-md bg-muted" />
            <div class="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
          </template>
          <p v-else-if="!blocosMeta.length" class="mt-3 text-sm text-muted-foreground">
            Meta não cadastrada para o período.
          </p>
          <div v-else class="mt-3 space-y-3">
            <div v-for="m in blocosMeta" :key="m.r">
              <div class="flex items-baseline justify-between text-xs">
                <span class="text-muted-foreground">{{ m.r }}</span>
                <b class="num text-base" :class="corPct(m.pct)">{{ formatPct(m.pct) }}</b>
              </div>
              <div
                class="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                :aria-label="`${m.r}: ${formatPct(m.pct)} da meta`"
                :aria-valuenow="Math.round((m.pct ?? 0) * 100)"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="h-full rounded-full"
                  :class="(m.pct ?? 0) >= 1 ? 'bg-success' : 'bg-warning'"
                  :style="{ width: barra(m.pct) }"
                />
              </div>
              <p class="num mt-1 text-xs text-muted-foreground">
                {{ formatBRL(m.real) }} de {{ formatBRL(m.meta) }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-xl border bg-card p-5">
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
          rotulo="Gráfico da evolução mensal das suas vendas comparando com o ano anterior e a meta"
          :opcoes="(t) => evolucaoOptions(v!.evolucao, t)"
        />
      </section>
    </template>

    <section class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <div class="rounded-xl border bg-card">
        <div class="flex items-center justify-between p-5 pb-3">
          <h3 class="text-sm font-medium text-muted-foreground">Top 10 clientes</h3>
          <NuxtLink
            v-if="can('dashboard.view')"
            :to="{ path: '/dashboard/clientes', query: linkPeriodo }"
            class="text-xs font-medium text-primary hover:underline"
          >
            Ver todos
          </NuxtLink>
        </div>
        <UiExtraEstadoBloco
          :carregando="clientes.isPending.value"
          :erro="clientes.error.value"
          :vazio="!clientes.data.value?.ranking.length"
          texto-vazio="Sem vendas no período."
          @tentar-de-novo="clientes.refetch()"
        >
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th class="w-10 px-5 py-2 text-left font-medium">#</th>
                <th class="px-3 py-2 text-left font-medium">Cliente</th>
                <th class="px-3 py-2 text-right font-medium">Pedidos</th>
                <th class="px-5 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="(c, i) in clientes.data.value?.ranking.slice(0, 10)" :key="c.chave">
                <td class="num px-5 py-2.5 text-muted-foreground">{{ i + 1 }}</td>
                <td class="px-3 py-2.5">
                  <span class="block max-w-64 truncate font-medium" :title="c.rotulo">{{ c.rotulo }}</span>
                </td>
                <td class="num px-3 py-2.5 text-right">{{ formatInt(c.qtd) }}</td>
                <td class="num px-5 py-2.5 text-right">{{ formatBRL(c.total) }}</td>
              </tr>
            </tbody>
          </table>
        </UiExtraEstadoBloco>
      </div>

      <div class="rounded-xl border bg-card p-5">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-muted-foreground">Vendas por estado</h3>
          <NuxtLink
            v-if="can('dashboard.view')"
            :to="{ path: '/dashboard/estados', query: linkPeriodo }"
            class="text-xs font-medium text-primary hover:underline"
          >
            Ver detalhes
          </NuxtLink>
        </div>
        <UiExtraEstadoBloco
          :carregando="estados.isPending.value"
          :erro="estados.error.value"
          :vazio="!estados.data.value?.linhas.length"
          texto-vazio="Sem vendas no período."
          @tentar-de-novo="estados.refetch()"
        >
          <ChartsBaseChart
            class="mt-2"
            altura="340px"
            rotulo="Ranking dos estados com maior volume das suas vendas"
            :opcoes="(t) => barrasRankingOptions(estados.data.value!.linhas, t)"
          />
        </UiExtraEstadoBloco>
      </div>
    </section>

    <section class="rounded-xl border bg-card">
      <div class="flex items-center justify-between p-5 pb-3">
        <h3 class="text-sm font-medium text-muted-foreground">Pedidos recentes</h3>
        <NuxtLink
          v-if="can('pedidos.view')"
          :to="{ path: '/pedidos', query: linkPeriodo }"
          class="text-xs font-medium text-primary hover:underline"
        >
          Ver todos os pedidos
        </NuxtLink>
      </div>
      <UiExtraEstadoBloco
        :carregando="pedidos.isPending.value"
        :erro="pedidos.error.value"
        :vazio="!pedidos.data.value?.data.length"
        texto-vazio="Nenhum pedido no período."
        @tentar-de-novo="pedidos.refetch()"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th class="px-5 py-2 text-left font-medium">Nº pedido</th>
                <th class="px-3 py-2 text-left font-medium">Emissão</th>
                <th class="px-3 py-2 text-left font-medium">Status</th>
                <th class="px-3 py-2 text-left font-medium">Cliente</th>
                <th class="px-3 py-2 text-left font-medium">UF</th>
                <th class="px-5 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="p in pedidos.data.value?.data" :key="p.id" class="hover:bg-muted/30">
                <td class="num px-5 py-2.5">{{ p.numPedido }}</td>
                <td class="num whitespace-nowrap px-3 py-2.5">{{ formatDate(p.dtEmissao) }}</td>
                <td class="px-3 py-2.5">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="COR[p.status.cor] ?? COR.muted"
                    :title="p.status.descricao"
                  >
                    {{ p.status.codigo }}
                  </span>
                </td>
                <td class="px-3 py-2.5">
                  <span class="block max-w-72 truncate" :title="p.cliente">{{ p.cliente }}</span>
                </td>
                <td class="px-3 py-2.5">{{ p.uf }}</td>
                <td class="num px-5 py-2.5 text-right">{{ formatBRL(p.valor) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiExtraEstadoBloco>
    </section>
  </div>
</template>
