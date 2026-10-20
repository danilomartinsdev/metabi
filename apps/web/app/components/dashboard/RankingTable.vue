<script setup lang="ts">
import type { LinhaRanking } from '@metabi/shared';
import type { TableColumn } from '@nuxt/ui';

const props = defineProps<{
  linhas: LinhaRanking[];
  total: { total: string; qtd: number; ticket: string | null };
  rotuloColuna: string;
}>();

const UButton = resolveComponent('UButton');
const ordenacao = ref([{ id: 'total', desc: true }]);

interface Coluna {
  getIsSorted: () => false | 'asc' | 'desc';
  toggleSorting: () => void;
}

/** Cabeçalho clicável; 1º clique: texto em ordem crescente, números em decrescente. */
const cabecalho =
  (rotulo: string, direita = false) =>
  ({ column }: { column: Coluna }) => {
    const s = column.getIsSorted();
    return h(UButton, {
      color: 'neutral',
      variant: 'ghost',
      size: 'xs',
      label: rotulo,
      trailingIcon:
        s === 'asc' ? 'i-lucide-arrow-up' : s === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up-down',
      class: ['-mx-2 font-medium text-muted-foreground hover:text-foreground', direita && 'ml-auto'],
      onClick: () => column.toggleSorting(),
    });
  };

const NUM = { class: { th: 'text-right', td: 'num text-right' } };
const numero = (v: string | number | null) => (v == null ? -Infinity : Number(v));

const colunas = computed<TableColumn<LinhaRanking>[]>(() => [
  {
    id: 'pos',
    header: '#',
    enableSorting: false,
    meta: { class: { th: 'w-10', td: 'num text-muted-foreground' } },
  },
  {
    id: 'rotulo',
    accessorKey: 'rotulo',
    header: cabecalho(props.rotuloColuna),
    sortDescFirst: false,
    sortingFn: (a, b) => a.original.rotulo.localeCompare(b.original.rotulo, 'pt-BR'),
    footer: 'Total',
    meta: { class: { td: 'font-medium' } },
  },
  {
    id: 'total',
    accessorFn: (l) => numero(l.total),
    header: cabecalho('Total', true),
    sortDescFirst: true,
    footer: () => formatBRL(props.total.total),
    meta: NUM,
  },
  {
    id: 'qtd',
    accessorKey: 'qtd',
    header: cabecalho('Pedidos', true),
    sortDescFirst: true,
    footer: () => formatInt(props.total.qtd),
    meta: NUM,
  },
  {
    id: 'ticket',
    accessorFn: (l) => numero(l.ticket),
    header: cabecalho('Ticket médio', true),
    sortDescFirst: true,
    footer: () => formatBRL(props.total.ticket),
    meta: NUM,
  },
  {
    id: 'participacao',
    accessorFn: (l) => numero(l.participacao),
    header: cabecalho('% Part.', true),
    sortDescFirst: true,
    footer: () => (props.linhas.length ? '100,0%' : '—'),
    meta: NUM,
  },
]);
</script>

<template>
  <UTable
    v-model:sorting="ordenacao"
    :data="linhas"
    :columns="colunas"
    :sorting-options="{ enableSortingRemoval: false }"
    :ui="{
      thead: 'bg-muted/50',
      th: 'px-3 py-2 text-xs font-medium text-muted-foreground',
      td: 'px-3 py-2.5 text-sm text-foreground',
      tr: 'hover:bg-muted/30',
      tfoot: 'border-t-2 [&_th]:text-sm [&_th]:font-semibold [&_th]:text-foreground',
    }"
    class="text-sm"
  >
    <template #pos-cell="{ row, table }">
      <span
        v-for="pos in [table.getRowModel().rows.findIndex((r) => r.id === row.id) + 1]"
        :key="pos"
        class="inline-grid size-6 place-items-center rounded-md text-xs font-semibold"
        :class="pos <= 3 ? 'bg-primary-soft text-primary' : 'text-muted-foreground'"
        :aria-label="`${pos}º lugar`"
        >{{ pos }}</span
      >
    </template>
    <template #total-cell="{ row }">{{ formatBRL(row.original.total) }}</template>
    <template #qtd-cell="{ row }">{{ formatInt(row.original.qtd) }}</template>
    <template #ticket-cell="{ row }">{{ formatBRL(row.original.ticket) }}</template>
    <template #participacao-cell="{ row }">
      <div class="flex items-center justify-end gap-2">
        <div class="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
          <div
            class="h-full rounded-full bg-primary"
            :style="{ width: `${Math.round((row.original.participacao ?? 0) * 100)}%` }"
          />
        </div>
        <span class="num w-14">{{ formatPct(row.original.participacao) }}</span>
      </div>
    </template>
  </UTable>
</template>
