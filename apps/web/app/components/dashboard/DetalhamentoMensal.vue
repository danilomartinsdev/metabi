<script setup lang="ts">
import type { VisaoGeral } from '@metabi/shared';
import { anoAnterior, periodoCurto, periodoPorExtenso } from '~/utils/periodo';

const props = defineProps<{
  detalhamento?: VisaoGeral['detalhamentoMensal'];
  periodo?: { de: string; ate: string };
  carregando?: boolean;
}>();

const MESES = [
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
/** Nome do mês; com o ano só quando o período atravessa a virada do ano. */
const rotuloMes = (m: string) => {
  const nome = MESES[Number(m.slice(5, 7)) - 1]!;
  return props.periodo && props.periodo.de.slice(0, 4) !== props.periodo.ate.slice(0, 4)
    ? `${nome}/${m.slice(0, 4)}`
    : nome;
};

const ant = computed(() => (props.periodo ? anoAnterior(props.periodo) : null));
const titulo = computed(() =>
  props.periodo && ant.value
    ? `${periodoPorExtenso(props.periodo.de, props.periodo.ate)} × ${periodoPorExtenso(ant.value.de, ant.value.ate)}`
    : '',
);
const colAtual = computed(() => (props.periodo ? periodoCurto(props.periodo.de, props.periodo.ate) : ''));
const colAnterior = computed(() => (ant.value ? periodoCurto(ant.value.de, ant.value.ate) : ''));
const classePct = (p: number | null) =>
  p === null ? 'text-muted-foreground' : p >= 0 ? 'text-success' : 'text-danger';
</script>

<template>
  <section class="rounded-xl border bg-card" aria-labelledby="titulo-detalhamento">
    <div class="px-5 pt-5 pb-3">
      <h3 id="titulo-detalhamento" class="text-sm font-medium text-muted-foreground">Detalhamento por mês</h3>
      <p v-if="titulo" class="text-xs text-muted-foreground">{{ titulo }}</p>
    </div>
    <div v-if="carregando" class="space-y-2 px-5 pb-5">
      <div v-for="i in 6" :key="i" class="h-8 animate-pulse rounded bg-muted" />
    </div>
    <p
      v-else-if="!detalhamento?.linhas.length"
      class="px-5 pb-10 pt-6 text-center text-sm text-muted-foreground"
    >
      Sem dados no período.
    </p>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-xs text-muted-foreground">
          <tr>
            <th scope="col" class="px-5 py-2 text-left font-medium">Mês</th>
            <th
              scope="col"
              class="bg-grafico-comparacao-forte px-5 py-2 text-right font-semibold text-foreground"
            >
              {{ colAnterior }}
            </th>
            <th
              scope="col"
              class="bg-grafico-principal-forte px-5 py-2 text-right font-semibold text-foreground"
            >
              {{ colAtual }}
            </th>
            <th scope="col" class="px-5 py-2 text-right font-medium">Variação</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="l in detalhamento.linhas" :key="l.mes" class="hover:bg-muted/30">
            <th scope="row" class="px-5 py-2 text-left font-medium">{{ rotuloMes(l.mes) }}</th>
            <td class="num bg-grafico-comparacao-soft px-5 py-2 text-right">{{ formatBRL(l.anterior) }}</td>
            <td class="num bg-grafico-principal-soft px-5 py-2 text-right">{{ formatBRL(l.atual) }}</td>
            <td class="num px-5 py-2 text-right" :class="classePct(l.pct)">
              {{ l.pct === null ? '—' : formatPct(l.pct) }}
            </td>
          </tr>
        </tbody>
        <tfoot class="border-t-2 border-foreground/20 bg-muted text-base font-bold">
          <tr>
            <th scope="row" class="px-5 py-3 text-left uppercase tracking-wide">Total</th>
            <td class="num bg-grafico-comparacao-forte px-5 py-3 text-right">
              {{ formatBRL(detalhamento.total.anterior) }}
            </td>
            <td class="num bg-grafico-principal-forte px-5 py-3 text-right">
              {{ formatBRL(detalhamento.total.atual) }}
            </td>
            <td class="num px-5 py-3 text-right" :class="classePct(detalhamento.total.pct)">
              {{ detalhamento.total.pct === null ? '—' : formatPct(detalhamento.total.pct) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </section>
</template>
