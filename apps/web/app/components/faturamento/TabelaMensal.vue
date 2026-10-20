<script setup lang="ts">
import type { FaturamentoMensal } from '@metabi/shared';

/** Tabela mês a mês de um ano (página de Faturamento e PDF). */
defineProps<{
  mensal: FaturamentoMensal;
  /** PDF: letra e espaçamento menores para as 6 colunas caberem na largura do A4. */
  compacto?: boolean;
}>();

const MESES_EXTENSO = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const COLUNAS_TABELA = [
  { k: 'bruto', r: 'Bruto' },
  { k: 'antecipado', r: 'Antecipado' },
  { k: 'remessa', r: 'Remessa' },
  { k: 'devolucao', r: 'Devolução' },
] as const;
</script>

<template>
  <div
    class="overflow-x-auto"
    :class="
      compacto &&
      '[&_td]:px-1.5 [&_th]:px-1.5 [&_table]:text-[11px] [&_tfoot]:text-xs [&_tr]:break-inside-avoid'
    "
  >
    <table class="w-full text-sm">
      <thead class="text-xs text-muted-foreground">
        <tr>
          <th scope="col" class="px-5 py-2 text-left font-medium">Mês</th>
          <th v-for="c in COLUNAS_TABELA" :key="c.k" scope="col" class="px-5 py-2 text-right font-medium">
            {{ c.r }}
          </th>
          <th
            scope="col"
            class="bg-grafico-principal-forte px-5 py-2 text-right font-semibold text-foreground"
          >
            Fatura DRE
          </th>
        </tr>
      </thead>
      <tbody class="divide-y">
        <tr v-for="m in mensal.meses" :key="m.mes" class="hover:bg-muted/30">
          <th scope="row" class="px-5 py-2 text-left font-medium">{{ MESES_EXTENSO[m.mes - 1] }}</th>
          <td
            v-for="c in COLUNAS_TABELA"
            :key="c.k"
            class="num whitespace-nowrap px-5 py-2 text-right"
            :class="Number(m[c.k]) < 0 && 'text-danger'"
          >
            {{ Number(m[c.k]) === 0 ? '—' : formatBRL(m[c.k]) }}
          </td>
          <td class="num whitespace-nowrap bg-grafico-principal-soft px-5 py-2 text-right font-medium">
            {{ formatBRL(m.dre) }}
          </td>
        </tr>
      </tbody>
      <tfoot class="border-t-2 border-foreground/20 bg-muted text-base font-bold">
        <tr>
          <th scope="row" class="px-5 py-3 text-left uppercase tracking-wide">Total</th>
          <td
            v-for="c in COLUNAS_TABELA"
            :key="c.k"
            class="num whitespace-nowrap px-5 py-3 text-right"
            :class="Number(mensal.total[c.k]) < 0 && 'text-danger'"
          >
            {{ formatBRL(mensal.total[c.k]) }}
          </td>
          <td class="num whitespace-nowrap bg-grafico-principal-forte px-5 py-3 text-right">
            {{ formatBRL(mensal.total.dre) }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
