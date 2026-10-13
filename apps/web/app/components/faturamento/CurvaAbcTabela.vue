<script setup lang="ts">
import type { AnaliseNotas, ClasseAbc } from '@meta-bi/shared';
import type { TableColumn } from '@nuxt/ui';

type LinhaCliente = AnaliseNotas['abcClientes'][number];
type LinhaProduto = AnaliseNotas['abcProdutos'][number];
type Linha = (LinhaCliente | LinhaProduto) & { pos: number };

const props = defineProps<
  | { tipo: 'clientes'; linhas: AnaliseNotas['abcClientes'] }
  | { tipo: 'produtos'; linhas: AnaliseNotas['abcProdutos'] }
>();

const busca = ref('');
const classe = ref<ClasseAbc | 'todas'>('todas');
const pagina = ref(1);
const porPagina = ref(25);
watch([busca, classe, porPagina], () => (pagina.value = 1));

const CLASSES: ClasseAbc[] = ['A', 'B', 'C'];
const DESCRICAO_CLASSE: Record<ClasseAbc, string> = {
  A: 'até 80% do faturamento',
  B: 'de 80% a 95%',
  C: 'últimos 5%',
};
const COR: Record<ClasseAbc, 'primary' | 'warning' | 'neutral'> = {
  A: 'primary',
  B: 'warning',
  C: 'neutral',
};

const comPosicao = computed<Linha[]>(() =>
  (props.linhas as (LinhaCliente | LinhaProduto)[]).map((l, i) => ({ ...l, pos: i + 1 })),
);
const resumo = computed(() =>
  CLASSES.map((c) => {
    const ls = comPosicao.value.filter((l) => l.classe === c);
    return {
      classe: c,
      qtd: ls.length,
      total: ls.reduce((s, l) => s + Number(l.total), 0),
      participacao: ls.reduce((s, l) => s + l.participacao, 0),
    };
  }),
);

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const textoBusca = (l: Linha) =>
  'razaoSocial' in l
    ? `${l.codigo} ${l.nomeFantasia ?? ''} ${l.razaoSocial} ${l.uf}`
    : `${l.codigo} ${l.descricao}`;
const filtradas = computed(() => {
  const q = normalizar(busca.value.trim());
  return comPosicao.value.filter(
    (l) =>
      (classe.value === 'todas' || l.classe === classe.value) &&
      (!q || normalizar(textoBusca(l)).includes(q)),
  );
});
const pagina_ = computed(() =>
  filtradas.value.slice((pagina.value - 1) * porPagina.value, pagina.value * porPagina.value),
);

const NUM = { class: { th: 'text-right', td: 'num text-right' } };
const colunas = computed<TableColumn<Linha>[]>(() => [
  { id: 'pos', header: '#', meta: { class: { th: 'w-10', td: 'num text-muted-foreground' } } },
  { id: 'codigo', accessorKey: 'codigo', header: 'Código', meta: { class: { td: 'num whitespace-nowrap' } } },
  ...(props.tipo === 'clientes'
    ? ([
        { id: 'nome', header: 'Cliente', meta: { class: { td: 'min-w-56 max-w-md' } } },
        { id: 'uf', header: 'UF', meta: { class: { td: 'whitespace-nowrap' } } },
        { id: 'notas', header: 'Notas', meta: NUM },
      ] as TableColumn<Linha>[])
    : ([
        { id: 'descricao', header: 'Descrição', meta: { class: { td: 'min-w-56 max-w-md' } } },
        { id: 'quantidade', header: 'Qtde', meta: NUM },
      ] as TableColumn<Linha>[])),
  { id: 'total', header: 'Valor', meta: NUM },
  { id: 'participacao', header: '% Part.', meta: NUM },
  { id: 'acumulado', header: '% Acum.', meta: NUM },
  { id: 'classe', header: 'Classe', meta: { class: { th: 'text-center', td: 'text-center' } } },
]);
const rotulo = computed(() => (props.tipo === 'clientes' ? 'clientes' : 'produtos'));
</script>

<template>
  <div>
    <div class="grid grid-cols-1 gap-3 px-5 pb-4 sm:grid-cols-3">
      <button
        v-for="r in resumo"
        :key="r.classe"
        type="button"
        class="rounded-lg border p-3 text-left transition-colors hover:bg-elevated/50"
        :class="classe === r.classe ? 'border-primary bg-primary-soft' : ''"
        :aria-pressed="classe === r.classe"
        @click="classe = classe === r.classe ? 'todas' : r.classe"
      >
        <div class="flex items-center justify-between gap-2">
          <UBadge :color="COR[r.classe]" variant="soft" :label="`Classe ${r.classe}`" />
          <span class="text-xs text-muted-foreground">{{ DESCRICAO_CLASSE[r.classe] }}</span>
        </div>
        <p class="num mt-2 text-lg font-semibold">{{ formatBRL(r.total) }}</p>
        <p class="num text-xs text-muted-foreground">
          {{ formatInt(r.qtd) }} {{ rotulo }} · {{ formatPct(r.participacao) }} do total
        </p>
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-2 px-5 pb-3">
      <UInput
        v-model="busca"
        icon="i-lucide-search"
        size="sm"
        class="w-full sm:w-72"
        :placeholder="
          tipo === 'clientes' ? 'Buscar por código, nome ou UF…' : 'Buscar por código ou descrição…'
        "
        :aria-label="`Buscar ${rotulo}`"
      />
      <USelect
        v-model="classe"
        size="sm"
        class="w-36"
        aria-label="Filtrar por classe"
        :items="[
          { label: 'Todas as classes', value: 'todas' },
          ...CLASSES.map((c) => ({ label: `Classe ${c}`, value: c })),
        ]"
      />
    </div>

    <div class="overflow-x-auto">
      <UTable
        :data="pagina_"
        :columns="colunas"
        :ui="{
          thead: 'bg-muted/50',
          th: 'px-3 py-2 text-xs font-medium text-muted-foreground',
          td: 'px-3 py-2.5 text-sm text-foreground',
          tr: 'hover:bg-muted/30',
        }"
        class="text-sm"
      >
        <template #pos-cell="{ row }">{{ row.original.pos }}</template>
        <template #nome-cell="{ row }">
          <template v-if="'razaoSocial' in row.original">
            <span
              class="block truncate font-medium"
              :title="row.original.nomeFantasia ?? row.original.razaoSocial"
            >
              {{ row.original.nomeFantasia ?? row.original.razaoSocial }}
            </span>
            <span
              v-if="row.original.nomeFantasia && row.original.nomeFantasia !== row.original.razaoSocial"
              class="block truncate text-xs text-muted-foreground"
              :title="row.original.razaoSocial"
              >{{ row.original.razaoSocial }}</span
            >
          </template>
        </template>
        <template #uf-cell="{ row }">{{ 'uf' in row.original ? row.original.uf : '' }}</template>
        <template #notas-cell="{ row }">{{
          'notas' in row.original ? formatInt(row.original.notas) : ''
        }}</template>
        <template #descricao-cell="{ row }">
          <span v-if="'descricao' in row.original" class="block truncate" :title="row.original.descricao">{{
            row.original.descricao
          }}</span>
        </template>
        <template #quantidade-cell="{ row }">
          {{ 'quantidade' in row.original ? formatInt(row.original.quantidade) : '' }}
        </template>
        <template #total-cell="{ row }">{{ formatBRL(row.original.total) }}</template>
        <template #participacao-cell="{ row }">{{ formatPct(row.original.participacao) }}</template>
        <template #acumulado-cell="{ row }">{{ formatPct(row.original.acumulado) }}</template>
        <template #classe-cell="{ row }">
          <UBadge :color="COR[row.original.classe]" variant="soft" :label="row.original.classe" />
        </template>
        <template #empty>
          <p class="py-8 text-center text-sm text-muted-foreground">Nenhum resultado para o filtro.</p>
        </template>
      </UTable>
    </div>
    <UiExtraPaginacaoBar
      v-model:pagina="pagina"
      v-model:por-pagina="porPagina"
      :total="filtradas.length"
      :rotulo="rotulo"
    />
  </div>
</template>
