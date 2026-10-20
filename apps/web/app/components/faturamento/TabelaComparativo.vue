<script setup lang="ts">
import type { CampoTotalFaturamento, FaturamentoComparativo } from '@metabi/shared';

/** Comparativo entre dois anos (página de Faturamento e PDF). */
const props = defineProps<{
  comp: FaturamentoComparativo;
  indicador: CampoTotalFaturamento;
  /** Há meses escolhidos (o total passa a ser "dos meses selecionados"). */
  filtrandoMeses?: boolean;
  /** PDF: letra e espaçamento menores para caber na largura do A4 (valores na casa dos milhões). */
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
const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Cor pela diferença (B − A): subir é bom em todos os indicadores — em antecipações e devoluções,
// que são negativos, uma diferença positiva significa valor menor.
const classeDif = (d: string) =>
  Number(d) > 0 ? 'text-success' : Number(d) < 0 ? 'text-danger' : 'text-muted-foreground';
const comSinal = (d: string) => `${Number(d) > 0 ? '+' : ''}${formatBRL(d)}`;
const pctComSinal = (p: number | null) => (p === null ? '—' : `${p > 0 ? '+' : ''}${formatPct(p)}`);
const rotuloEmComum = computed(() => {
  const ms = props.comp.emComum.meses;
  if (!ms.length) return '';
  return ms.length === 1 ? NOMES[ms[0]! - 1] : `${NOMES[ms[0]! - 1]}–${NOMES[ms.at(-1)! - 1]}`;
});
</script>

<template>
  <div
    :class="
      compacto && '[&_td]:px-2 [&_th]:px-2 [&_table]:text-xs [&_tfoot]:text-sm [&_tr]:break-inside-avoid'
    "
  >
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-xs text-muted-foreground">
          <tr>
            <th scope="col" class="px-5 py-2 text-left font-medium">Mês</th>
            <th scope="col" class="px-5 py-2 text-right font-medium">{{ comp.anoA }}</th>
            <th scope="col" class="px-5 py-2 text-right font-medium">{{ comp.anoB }}</th>
            <th scope="col" class="px-5 py-2 text-right font-medium">Diferença</th>
            <th scope="col" class="px-5 py-2 text-right font-medium">Variação</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="m in comp.meses" :key="m.mes" class="hover:bg-muted/30">
            <th scope="row" class="px-5 py-2 text-left font-medium">{{ MESES_EXTENSO[m.mes - 1] }}</th>
            <td
              class="num whitespace-nowrap px-5 py-2 text-right"
              :class="!m.temA && 'text-muted-foreground'"
            >
              {{ m.temA ? formatBRL(m.a[indicador]) : '—' }}
            </td>
            <td
              class="num whitespace-nowrap px-5 py-2 text-right"
              :class="!m.temB && 'text-muted-foreground'"
            >
              {{ m.temB ? formatBRL(m.b[indicador]) : '—' }}
            </td>
            <template v-if="m.temA && m.temB">
              <td
                class="num whitespace-nowrap px-5 py-2 text-right"
                :class="classeDif(m.diferenca[indicador])"
              >
                {{ comSinal(m.diferenca[indicador]) }}
              </td>
              <td
                class="num whitespace-nowrap px-5 py-2 text-right"
                :class="classeDif(m.diferenca[indicador])"
              >
                {{ pctComSinal(m.pct[indicador]) }}
              </td>
            </template>
            <td
              v-else
              colspan="2"
              class="whitespace-nowrap px-5 py-2 text-right text-xs text-muted-foreground"
            >
              sem dado em {{ m.temA ? comp.anoB : comp.anoA }}
            </td>
          </tr>
        </tbody>
        <tfoot class="border-t-2 border-foreground/20 bg-muted font-bold">
          <tr v-if="comp.emComum.meses.length && comp.emComum.meses.length !== comp.meses.length">
            <th scope="row" class="px-5 py-3 text-left">
              Acumulado comparável
              <span class="block text-xs font-normal text-muted-foreground">
                meses com dado nos dois anos ({{ rotuloEmComum }})
              </span>
            </th>
            <td class="num whitespace-nowrap px-5 py-3 text-right">
              {{ formatBRL(comp.emComum.a[indicador]) }}
            </td>
            <td class="num whitespace-nowrap px-5 py-3 text-right">
              {{ formatBRL(comp.emComum.b[indicador]) }}
            </td>
            <td
              class="num whitespace-nowrap px-5 py-3 text-right"
              :class="classeDif(comp.emComum.diferenca[indicador])"
            >
              {{ comSinal(comp.emComum.diferenca[indicador]) }}
            </td>
            <td
              class="num whitespace-nowrap px-5 py-3 text-right"
              :class="classeDif(comp.emComum.diferenca[indicador])"
            >
              {{ pctComSinal(comp.emComum.pct[indicador]) }}
            </td>
          </tr>
          <tr class="text-base">
            <th scope="row" class="px-5 py-3 text-left">
              <span class="uppercase tracking-wide">Total</span>
              <span v-if="filtrandoMeses" class="block text-xs font-normal text-muted-foreground">
                dos meses selecionados
              </span>
            </th>
            <td class="num whitespace-nowrap px-5 py-3 text-right">
              {{ formatBRL(comp.total.a[indicador]) }}
            </td>
            <td class="num whitespace-nowrap px-5 py-3 text-right">
              {{ formatBRL(comp.total.b[indicador]) }}
            </td>
            <td
              class="num whitespace-nowrap px-5 py-3 text-right"
              :class="classeDif(comp.total.diferenca[indicador])"
            >
              {{ comSinal(comp.total.diferenca[indicador]) }}
            </td>
            <td
              class="num whitespace-nowrap px-5 py-3 text-right"
              :class="classeDif(comp.total.diferenca[indicador])"
            >
              {{ pctComSinal(comp.total.pct[indicador]) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="px-5 py-3 text-xs text-muted-foreground">
      Diferença = {{ comp.anoB }} − {{ comp.anoA }}. Verde quando {{ comp.anoB }} foi melhor (em antecipações
      e devoluções, que são valores negativos, melhor é um valor menor). O total soma os meses da tabela
      (todos, ou só os selecionados); o acumulado comparável usa, entre eles, só os meses com faturamento nos
      dois anos.
    </p>
  </div>
</template>
