<script setup lang="ts">
import { useAnaliseNotasQuery } from '~/composables/api/useNotasFiscais';
import { corDaDivisao, divisoesOptions, legendaDivisoes } from '~/utils/charts/notas-fiscais';
import { coresFatias } from '~/utils/charts/palette';
import { deslocarMes, periodoPorExtenso } from '~/utils/periodo';

// Análise de faturamento a partir das notas fiscais do Focco (itens de NF): divisão de venda,
// representantes e curvas ABC de clientes e produtos. Número da empresa inteira (escopo "todos").
definePageMeta({ titulo: 'Análise de faturamento', permissao: 'faturamento-analise.view' });
useHead({ title: 'Análise de faturamento — BI Metahospitalar' });

const route = useRoute();
const router = useRouter();
const can = useCan();
const importando = ref(false);

const mesValido = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : undefined;
const de = computed(() => mesValido(route.query.de));
const ate = computed(() => mesValido(route.query.ate));
const qs = computed(() =>
  new URLSearchParams(
    Object.entries({ de: de.value, ate: ate.value }).filter(([, v]) => v) as [string, string][],
  ).toString(),
);
const q = useAnaliseNotasQuery(qs);
const r = computed(() => q.data.value);
const carregando = computed(() => q.isPending.value);
const periodo = computed(() => r.value?.periodo);

function mudar(campo: 'de' | 'ate', valor: string) {
  const p = {
    de: de.value ?? periodo.value?.de ?? valor,
    ate: ate.value ?? periodo.value?.ate ?? valor,
    [campo]: valor,
  };
  if (p.de > p.ate) {
    if (campo === 'de') p.ate = p.de;
    else p.de = p.ate;
  }
  void router.replace({ query: { ...route.query, ...p } });
}
function atalho(tipo: 'mes' | 'ano') {
  const fim = periodo.value?.ate;
  if (!fim) return;
  void router.replace({
    query: { ...route.query, de: tipo === 'mes' ? fim : `${fim.slice(0, 4)}-01`, ate: fim },
  });
}

const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const opcoesMes = computed(() => {
  const hoje = new Date().toISOString().slice(0, 7);
  const lista: { label: string; value: string }[] = [];
  for (let m = `${Number(hoje.slice(0, 4)) - 2}-01`; m <= hoje; m = deslocarMes(m, 1)) {
    lista.unshift({ label: `${NOMES[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}`, value: m });
  }
  return lista;
});

// Clique numa fatia (ou na divisão da lista): o ranking mostra só os representantes daquela divisão.
const divisaoSel = ref<string | null>(null);
const rankingRef = ref<HTMLElement | null>(null);
const rankingDivisao = computed(() =>
  divisaoSel.value
    ? (r.value?.representantesPorDivisao.find((d) => d.divisao === divisaoSel.value) ?? null)
    : null,
);
const linhasRanking = computed(() => rankingDivisao.value?.representantes ?? r.value?.representantes ?? []);
const totaisRanking = computed(() => {
  const d = divisaoSel.value ? r.value?.divisoes.find((x) => x.divisao === divisaoSel.value) : null;
  return d
    ? { notas: d.notas, clientes: null, total: d.total }
    : { notas: r.value?.notas, clientes: r.value?.clientes, total: r.value?.total };
});
// Legenda ao lado do donut e marcadores da lista com as mesmas cores das fatias (paleta do usuário).
const paleta = usePaletaGraficos();
const cores = computed(() => coresFatias(paleta.value));
const legenda = computed(() => legendaDivisoes(r.value?.divisoes ?? [], cores.value));
// O período mudou e a divisão sumiu: volta para todas.
watch(r, (v) => {
  if (divisaoSel.value && !v?.divisoes.some((d) => d.divisao === divisaoSel.value)) divisaoSel.value = null;
});
function escolherDivisao(nome: string | undefined) {
  if (!nome || !r.value?.divisoes.some((d) => d.divisao === nome)) return; // "Outros (n)" não filtra
  divisaoSel.value = divisaoSel.value === nome ? null : nome;
  // Em telas estreitas o ranking fica abaixo do gráfico: leva até ele.
  if (divisaoSel.value && window.matchMedia('(max-width: 1279px)').matches) {
    nextTick(() => rankingRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}

const cards = computed(() => [
  { rotulo: 'Faturamento no período', icone: 'i-lucide-dollar-sign', valor: formatBRL(r.value?.total) },
  { rotulo: 'Notas fiscais', icone: 'i-lucide-receipt', valor: formatInt(r.value?.notas) },
  { rotulo: 'Clientes faturados', icone: 'i-lucide-building-complex', valor: formatInt(r.value?.clientes) },
  {
    rotulo: 'Representantes',
    icone: 'i-lucide-square-user-round',
    valor: formatInt(r.value?.representantes.length),
  },
]);
</script>

<template>
  <div class="space-y-4 lg:space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-2xl font-semibold">Análise de faturamento</h2>
        <p class="text-sm text-muted-foreground">
          {{ periodo ? periodoPorExtenso(periodo.de, periodo.ate) : 'Carregando período…' }}
          <template v-if="r?.temDados"> · notas fiscais do Focco</template>
        </p>
      </div>
      <UButton
        v-if="can('faturamento.import')"
        icon="i-lucide-file-up"
        label="Importar notas"
        @click="importando = true"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <UIcon name="i-lucide-calendar-days" class="size-4 text-muted-foreground" />
      <USelect
        :model-value="periodo?.de"
        :items="opcoesMes"
        size="sm"
        class="w-28"
        aria-label="Mês inicial"
        @update:model-value="(v) => mudar('de', String(v))"
      />
      <span class="text-sm text-muted-foreground">até</span>
      <USelect
        :model-value="periodo?.ate"
        :items="opcoesMes"
        size="sm"
        class="w-28"
        aria-label="Mês final"
        @update:model-value="(v) => mudar('ate', String(v))"
      />
      <UButton color="neutral" variant="ghost" size="sm" label="Último mês" @click="atalho('mes')" />
      <UButton color="neutral" variant="ghost" size="sm" label="Acumulado do ano" @click="atalho('ano')" />
    </div>

    <UiExtraEstadoBloco v-if="q.error.value" :erro="q.error.value" @tentar-de-novo="q.refetch()" />
    <section
      v-else-if="r && !r.temDados"
      class="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-16 text-center"
    >
      <UIcon name="i-lucide-receipt" class="size-8 text-muted-foreground" />
      <p class="font-medium">Nenhuma nota fiscal importada ainda</p>
      <p class="text-sm text-muted-foreground">
        Importe o relatório de notas fiscais do Focco para ver a análise.
      </p>
      <UButton
        v-if="can('faturamento.import')"
        icon="i-lucide-file-up"
        label="Importar notas"
        @click="importando = true"
      />
    </section>
    <template v-else>
      <section
        aria-label="Indicadores de faturamento"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <DashboardKpiCard
          v-for="c in cards"
          :key="c.rotulo"
          :rotulo="c.rotulo"
          :icone="c.icone"
          :carregando="carregando"
          :valor="c.valor"
          compacto
        />
      </section>

      <section class="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-5">
        <div class="@container rounded-xl border bg-card p-5 xl:col-span-2">
          <h3 class="text-sm font-medium text-muted-foreground">Faturamento por divisão de venda</h3>
          <p v-if="r?.divisoes.length" class="text-xs text-muted-foreground">
            Clique numa divisão para ver o ranking dos representantes nela
          </p>
          <div v-if="carregando" class="mt-4 h-80 animate-pulse rounded-lg bg-muted" />
          <p v-else-if="!r?.divisoes.length" class="py-24 text-center text-sm text-muted-foreground">
            Sem notas no período.
          </p>
          <template v-else>
            <!-- Legenda ao lado quando o card tem largura (container query); senão, embaixo do donut. -->
            <div class="mt-4 flex flex-col items-center gap-4 @md:flex-row">
              <ChartsBaseChart
                class="w-full max-w-72 shrink-0 @md:w-[42%]"
                altura="260px"
                :rotulo="`Faturamento por divisão de venda: ${r.divisoes
                  .slice(0, 3)
                  .map((d) => `${d.divisao} ${formatPct(d.participacao)}`)
                  .join(', ')}`"
                :opcoes="(t) => divisoesOptions(r!.divisoes, t, divisaoSel)"
                @clique="(p) => escolherDivisao(p.name)"
              />
              <!-- Legenda: mesma ordem e cores das fatias; clicar filtra o ranking (menos "Outros"). -->
              <ul class="w-full min-w-0 flex-1 space-y-0.5" aria-label="Legenda do gráfico">
                <li v-for="item in legenda" :key="item.nome">
                  <button
                    type="button"
                    class="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors enabled:hover:bg-muted/40 disabled:cursor-default"
                    :class="[
                      divisaoSel === item.divisao && item.divisao ? 'bg-primary-soft' : '',
                      divisaoSel && divisaoSel !== item.divisao ? 'opacity-50' : '',
                    ]"
                    :disabled="!item.divisao"
                    :aria-pressed="item.divisao ? divisaoSel === item.divisao : undefined"
                    @click="escolherDivisao(item.divisao ?? undefined)"
                  >
                    <span
                      class="mt-0.5 size-3.5 shrink-0 rounded-sm"
                      :style="{ backgroundColor: item.cor }"
                      aria-hidden="true"
                    />
                    <span class="min-w-0 flex-1">
                      <span class="line-clamp-2 text-xs leading-snug font-medium" :title="item.nome">
                        {{ item.nome }}
                      </span>
                      <span class="num block text-xs text-muted-foreground">{{ formatBRL(item.valor) }}</span>
                    </span>
                    <span class="num shrink-0 text-sm font-semibold">{{ formatPct(item.participacao) }}</span>
                  </button>
                </li>
              </ul>
            </div>
            <ul class="mt-4 divide-y border-t text-sm">
              <li v-for="(d, i) in r.divisoes" :key="d.divisao">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
                  :class="divisaoSel === d.divisao ? 'bg-primary-soft text-primary' : ''"
                  :aria-pressed="divisaoSel === d.divisao"
                  @click="escolherDivisao(d.divisao)"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <span
                      class="size-2.5 shrink-0 rounded-full"
                      :style="{ backgroundColor: corDaDivisao(i, cores) }"
                      aria-hidden="true"
                    />
                    <span class="truncate" :title="d.divisao">{{ d.divisao }}</span>
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

        <div
          ref="rankingRef"
          class="scroll-mt-4 rounded-xl border bg-card xl:col-span-3"
          aria-labelledby="titulo-rank-rep"
        >
          <div class="flex flex-wrap items-start justify-between gap-2 px-5 pt-5 pb-3">
            <div class="min-w-0">
              <h3 id="titulo-rank-rep" class="text-sm font-medium text-muted-foreground">
                Ranking por representante
              </h3>
              <p v-if="divisaoSel" class="truncate text-xs text-muted-foreground" :title="divisaoSel">
                Na divisão <b class="text-foreground">{{ divisaoSel }}</b> · % sobre o total da divisão
              </p>
              <p v-else-if="r" class="text-xs text-muted-foreground">
                Faturamento das notas de cada representante no período, em todas as divisões
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
          <div v-if="carregando" class="space-y-2 px-5 pb-5">
            <div v-for="i in 8" :key="i" class="h-8 animate-pulse rounded bg-muted" />
          </div>
          <div v-else-if="r" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th class="w-10 px-3 py-2 text-left font-medium">#</th>
                  <th class="px-3 py-2 text-left font-medium">Representante</th>
                  <th class="px-3 py-2 text-right font-medium">Notas</th>
                  <th class="px-3 py-2 text-right font-medium">Clientes</th>
                  <th class="px-3 py-2 text-right font-medium">Valor</th>
                  <th class="px-3 py-2 text-right font-medium">% Part.</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="(l, i) in linhasRanking" :key="l.codigo" class="hover:bg-muted/30">
                  <td class="px-3 py-2.5">
                    <span
                      class="num inline-grid size-6 place-items-center rounded-md text-xs font-semibold"
                      :class="i < 3 ? 'bg-primary-soft text-primary' : 'text-muted-foreground'"
                      :aria-label="`${i + 1}º lugar`"
                      >{{ i + 1 }}</span
                    >
                  </td>
                  <td class="max-w-72 truncate px-3 py-2.5 font-medium" :title="l.nome">{{ l.nome }}</td>
                  <td class="num px-3 py-2.5 text-right">{{ formatInt(l.notas) }}</td>
                  <td class="num px-3 py-2.5 text-right">{{ formatInt(l.clientes) }}</td>
                  <td class="num whitespace-nowrap px-3 py-2.5 text-right">{{ formatBRL(l.total) }}</td>
                  <td class="px-3 py-2.5">
                    <div class="flex items-center justify-end gap-2">
                      <div class="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                        <div
                          class="h-full rounded-full bg-primary"
                          :style="{ width: `${Math.round(l.participacao * 100)}%` }"
                        />
                      </div>
                      <span class="num w-14 text-right">{{ formatPct(l.participacao) }}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
              <tfoot class="border-t-2 font-semibold">
                <tr>
                  <td class="px-3 py-2.5" />
                  <td class="px-3 py-2.5">Total</td>
                  <td class="num px-3 py-2.5 text-right">{{ formatInt(totaisRanking.notas) }}</td>
                  <!-- Na divisão, o mesmo cliente pode comprar de mais de um representante: sem soma. -->
                  <td class="num px-3 py-2.5 text-right">{{ formatInt(totaisRanking.clientes) }}</td>
                  <td class="num whitespace-nowrap px-3 py-2.5 text-right">
                    {{ formatBRL(totaisRanking.total) }}
                  </td>
                  <td class="num px-3 py-2.5 text-right">{{ linhasRanking.length ? '100,0%' : '—' }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      <section class="rounded-xl border bg-card" aria-labelledby="titulo-abc-cli">
        <div class="px-5 pt-5 pb-3">
          <h3 id="titulo-abc-cli" class="text-sm font-medium text-muted-foreground">
            Curva ABC de faturamento por cliente
          </h3>
          <p class="text-xs text-muted-foreground">Clientes do maior para o menor faturamento no período</p>
        </div>
        <div v-if="carregando" class="space-y-2 px-5 pb-5">
          <div v-for="i in 6" :key="i" class="h-8 animate-pulse rounded bg-muted" />
        </div>
        <FaturamentoCurvaAbcTabela v-else-if="r" tipo="clientes" :linhas="r.abcClientes" />
      </section>

      <section class="rounded-xl border bg-card" aria-labelledby="titulo-abc-prod">
        <div class="px-5 pt-5 pb-3">
          <h3 id="titulo-abc-prod" class="text-sm font-medium text-muted-foreground">
            Curva ABC por produto
          </h3>
          <p class="text-xs text-muted-foreground">
            Pelo valor ou pela quantidade vendida · mesmo produto somado em uma linha (variantes como "MT169."
            e "MT169" juntas)
          </p>
        </div>
        <div v-if="carregando" class="space-y-2 px-5 pb-5">
          <div v-for="i in 6" :key="i" class="h-8 animate-pulse rounded bg-muted" />
        </div>
        <FaturamentoCurvaAbcTabela
          v-else-if="r"
          tipo="produtos"
          :linhas="r.abcProdutos"
          :por-unidade="r.abcProdutosQuantidade"
        />
      </section>
    </template>

    <FaturamentoImportarNotas v-model:aberto="importando" />
  </div>
</template>
