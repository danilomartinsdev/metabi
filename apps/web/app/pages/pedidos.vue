<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import { useLocalStorage } from '@vueuse/core';
import { usePedidosQuery } from '~/composables/api/useDashboard';

definePageMeta({ titulo: 'Pedidos', permissao: 'pedidos.view' });
useHead({ title: 'Pedidos — BI Metahospitalar' });

const route = useRoute();
const router = useRouter();
const { query } = useFiltros();

type Ordem = 'dtEmissao' | 'valor' | 'numPedido' | 'cliente' | 'uf' | 'representante';
const page = computed(() => Number(route.query.page ?? 1) || 1);
const pageSize = computed(() => Number(route.query.pageSize ?? 25) || 25);
const sort = computed(() => (route.query.sort as Ordem) ?? 'dtEmissao');
const dir = computed(() => (route.query.dir === 'asc' ? 'asc' : 'desc'));
const qs = computed(() =>
  new URLSearchParams({
    ...query.value,
    page: String(page.value),
    pageSize: String(pageSize.value),
    sort: sort.value,
    dir: dir.value,
  }).toString(),
);
const q = usePedidosQuery(qs);

function navegar(p: Record<string, string | number>) {
  void router.replace({
    query: { ...route.query, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) },
  });
}
function ordenar(col: Ordem) {
  navegar({ sort: col, dir: sort.value === col && dir.value === 'desc' ? 'asc' : 'desc', page: 1 });
}
// Filtros mudaram → volta para a página 1.
watch(
  () => JSON.stringify(query.value),
  () => page.value !== 1 && navegar({ page: 1 }),
);

const COLUNAS = [
  { k: 'numPedido', r: 'Nº pedido', ordem: 'numPedido' },
  { k: 'dtEmissao', r: 'Emissão', ordem: 'dtEmissao' },
  { k: 'dtEntrega', r: 'Entrega' },
  { k: 'status', r: 'Status' },
  { k: 'cliente', r: 'Cliente', ordem: 'cliente' },
  { k: 'uf', r: 'UF', ordem: 'uf' },
  { k: 'gestor', r: 'Representante', ordem: 'representante' },
  { k: 'segmento', r: 'Segmento' },
  { k: 'ordemCpr', r: 'Ordem CPR' },
  { k: 'valor', r: 'Valor', ordem: 'valor', num: true },
] as const;
const visiveis = useLocalStorage<string[]>('meta-bi-colunas-pedidos', [
  'numPedido',
  'dtEmissao',
  'status',
  'cliente',
  'uf',
  'gestor',
  'valor',
]);
const colunas = computed(() => COLUNAS.filter((c) => visiveis.value.includes(c.k)));
function alternarColuna(k: string, v: boolean) {
  visiveis.value = v ? [...visiveis.value, k] : visiveis.value.filter((x) => x !== k);
}
const itensColunas = computed<DropdownMenuItem[]>(() =>
  COLUNAS.map((c) => ({
    type: 'checkbox' as const,
    label: c.r,
    checked: visiveis.value.includes(c.k),
    onUpdateChecked: (v: boolean) => alternarColuna(c.k, v),
    onSelect: (e: Event) => e.preventDefault(),
  })),
);

const COR: Record<string, string> = {
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary',
  highlight: 'bg-highlight/15 text-highlight',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
};
const total = computed(() => q.data.value?.meta.total ?? 0);
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h2 class="text-2xl font-semibold">Pedidos</h2>
      <div class="flex items-center gap-2">
        <DashboardExportarMenu xlsx="pedidos" :ordenacao="{ sort, dir }" />
        <UDropdownMenu :items="itensColunas" :content="{ align: 'end' }">
          <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-columns-3" label="Colunas" />
        </UDropdownMenu>
      </div>
    </div>

    <DashboardFilterBar :periodo="q.data.value?.periodo" />

    <section
      aria-label="Total dos pedidos filtrados"
      class="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border bg-card px-5 py-4"
    >
      <div>
        <p class="text-xs text-muted-foreground">Valor total do filtro</p>
        <USkeleton v-if="q.isPending.value" class="mt-1 h-7 w-44" />
        <p v-else class="num text-2xl font-semibold">{{ formatBRL(q.data.value?.meta.valorTotal ?? 0) }}</p>
      </div>
      <div>
        <p class="text-xs text-muted-foreground">Pedidos</p>
        <USkeleton v-if="q.isPending.value" class="mt-1 h-7 w-16" />
        <p v-else class="num text-2xl font-semibold">{{ formatInt(total) }}</p>
      </div>
    </section>

    <section class="rounded-xl border bg-card">
      <UiExtraEstadoBloco
        :carregando="q.isPending.value"
        :erro="q.error.value"
        :vazio="!q.data.value?.data.length"
        texto-vazio="Nenhum pedido para os filtros escolhidos."
        :linhas="8"
        @tentar-de-novo="q.refetch()"
      >
        <div class="overflow-x-auto" :class="q.isFetching.value && 'opacity-60 transition-opacity'">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th
                  v-for="c in colunas"
                  :key="c.k"
                  class="whitespace-nowrap px-3 py-3 font-medium first:pl-5 last:pr-5"
                  :class="'num' in c ? 'text-right' : 'text-left'"
                  :aria-sort="
                    'ordem' in c && sort === c.ordem
                      ? dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  "
                >
                  <button
                    v-if="'ordem' in c"
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
              <tr v-for="p in q.data.value?.data" :key="p.id" class="hover:bg-muted/30">
                <td
                  v-for="c in colunas"
                  :key="c.k"
                  class="px-3 py-2.5 first:pl-5 last:pr-5"
                  :class="'num' in c && 'num text-right'"
                >
                  <template v-if="c.k === 'status'">
                    <span
                      class="rounded-full px-2 py-0.5 text-xs font-semibold"
                      :class="COR[p.status.cor] ?? COR.muted"
                      :title="p.status.descricao"
                    >
                      {{ p.status.codigo }}
                    </span>
                  </template>
                  <template v-else-if="c.k === 'valor'">{{ formatBRL(p.valor) }}</template>
                  <template v-else-if="c.k === 'dtEmissao' || c.k === 'dtEntrega'">
                    <span class="num whitespace-nowrap">{{ formatDate(p[c.k]) }}</span>
                  </template>
                  <template v-else-if="c.k === 'cliente'"
                    ><span class="block max-w-72 truncate" :title="p.cliente">{{ p.cliente }}</span></template
                  >
                  <template v-else>{{ p[c.k] ?? '—' }}</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UiExtraPaginacaoBar
          :pagina="page"
          :por-pagina="pageSize"
          :total="total"
          rotulo="pedidos"
          @update:pagina="(p) => navegar({ page: p })"
          @update:por-pagina="(n) => navegar({ pageSize: n, page: 1 })"
        />
      </UiExtraEstadoBloco>
    </section>
  </div>
</template>
