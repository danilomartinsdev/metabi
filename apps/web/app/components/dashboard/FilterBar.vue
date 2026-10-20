<script setup lang="ts">
import { REGIAO_ENUM_ROTULO, REGIOES_ENUM, UFS } from '@metabi/shared';
import { useDebounceFn } from '@vueuse/core';
import { useRepresentantesQuery, useStatusQuery } from '~/composables/api/useCadastros';
import { useMesesQuery } from '~/composables/api/useDashboard';

/** Período exibido quando a URL não define um (vem da API: início do ano até o último mês com dados). */
/** somentePeriodo: esconde região/UF/representante/segmento/status/busca (ex.: Minhas vendas). */
const props = defineProps<{
  periodo?: { de: string; ate: string };
  semPeriodo?: boolean;
  somentePeriodo?: boolean;
}>();

const { filtros, ativos, definir, limpar } = useFiltros();
const meses = useMesesQuery();
const reps = useRepresentantesQuery();
const status = useStatusQuery();

const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (m: string) => `${NOMES_MES[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}`;
const opcoesMes = computed(() =>
  [...(meses.data.value ?? [])].reverse().map((m) => ({ label: rotuloMes(m), value: m })),
);
const de = computed(() => filtros.value.de ?? props.periodo?.de ?? '');
const ate = computed(() => filtros.value.ate ?? props.periodo?.ate ?? '');

function mudarPeriodo(campo: 'de' | 'ate', valor: string) {
  const novo = { de: de.value, ate: ate.value, [campo]: valor };
  if (novo.de > novo.ate) {
    if (campo === 'de') novo.ate = novo.de;
    else novo.de = novo.ate;
  }
  definir(novo);
}

/** Atalhos de período a partir do último mês com dados. "Ano anterior" só aparece se houver dados nele. */
const atalhos = computed(() => {
  const lista = meses.data.value ?? [];
  const ultimo = lista.at(-1);
  if (!ultimo) return [];
  const ano = Number(ultimo.slice(0, 4));
  const doAnoAnterior = lista.filter((m) => m.startsWith(`${ano - 1}-`));
  return [
    { rotulo: 'Último mês', de: ultimo, ate: ultimo },
    { rotulo: 'Acumulado do ano', de: `${ano}-01`, ate: ultimo },
    ...(doAnoAnterior.length
      ? [{ rotulo: `Ano ${ano - 1}`, de: doAnoAnterior[0]!, ate: doAnoAnterior.at(-1)! }]
      : []),
  ];
});
const atalhoAtivo = (a: { de: string; ate: string }) => a.de === de.value && a.ate === ate.value;

const busca = ref(filtros.value.q ?? '');
watch(
  () => filtros.value.q,
  (q) => (busca.value = q ?? ''),
);
const buscar = useDebounceFn((v: string) => definir({ q: v.trim() || undefined }), 400);

const opcoes = computed(() => ({
  regiao: REGIOES_ENUM.map((r) => ({ valor: r, rotulo: REGIAO_ENUM_ROTULO[r] })),
  uf: UFS.map((u) => ({ valor: u, rotulo: u })),
  gestor: (reps.data.value ?? []).map((r) => ({ valor: r.id, rotulo: r.nomeExibicao })),
  segmento: [
    { valor: 'PUBLICO', rotulo: 'Público' },
    { valor: 'PRIVADO', rotulo: 'Privado' },
    { valor: 'SEM', rotulo: 'Sem segmento' },
  ],
  status: (status.data.value ?? []).map((s) => ({
    valor: s.codigo,
    rotulo: s.descricao === s.codigo ? s.codigo : `${s.codigo} — ${s.descricao}`,
  })),
}));
</script>

<template>
  <div data-tour="filtros" class="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center">
    <div v-if="!semPeriodo" class="flex flex-wrap items-center gap-2">
      <UIcon name="i-lucide-calendar-days" class="size-4 text-muted-foreground" aria-hidden="true" />
      <USelect
        :model-value="de"
        :items="opcoesMes"
        size="sm"
        class="w-28"
        aria-label="Mês inicial"
        @update:model-value="(v) => mudarPeriodo('de', String(v))"
      />
      <span class="text-sm text-muted-foreground">até</span>
      <USelect
        :model-value="ate"
        :items="opcoesMes"
        size="sm"
        class="w-28"
        aria-label="Mês final"
        @update:model-value="(v) => mudarPeriodo('ate', String(v))"
      />
      <UButton
        v-for="a in atalhos"
        :key="a.rotulo"
        :color="atalhoAtivo(a) ? 'primary' : 'neutral'"
        :variant="atalhoAtivo(a) ? 'soft' : 'ghost'"
        size="sm"
        :label="a.rotulo"
        :aria-pressed="atalhoAtivo(a)"
        @click="definir({ de: a.de, ate: a.ate })"
      />
    </div>

    <!-- Com somentePeriodo, a tela pode pôr filtros próprios aqui (ex.: representantes em Minhas vendas). -->
    <div
      v-if="somentePeriodo && $slots.default"
      class="flex flex-1 flex-wrap items-center gap-2 lg:justify-end"
    >
      <slot />
    </div>
    <div v-if="!somentePeriodo" class="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
      <DashboardMultiFiltro
        rotulo="Região"
        :opcoes="opcoes.regiao"
        :selecionados="filtros.regiao"
        @alterar="(v) => definir({ regiao: v })"
      />
      <DashboardMultiFiltro
        rotulo="UF"
        :opcoes="opcoes.uf"
        :selecionados="filtros.uf"
        @alterar="(v) => definir({ uf: v })"
      />
      <DashboardMultiFiltro
        rotulo="Representante"
        :opcoes="opcoes.gestor"
        :selecionados="filtros.gestor"
        @alterar="(v) => definir({ gestor: v })"
      />
      <DashboardMultiFiltro
        rotulo="Segmento"
        :opcoes="opcoes.segmento"
        :selecionados="filtros.segmento"
        @alterar="(v) => definir({ segmento: v })"
      />
      <DashboardMultiFiltro
        rotulo="Status"
        :opcoes="opcoes.status"
        :selecionados="filtros.status"
        @alterar="(v) => definir({ status: v })"
      />
      <UInput
        v-model="busca"
        icon="i-lucide-search"
        size="sm"
        class="w-full sm:w-56"
        placeholder="Cliente, pedido, CPR, representante"
        aria-label="Buscar"
        @update:model-value="(v) => buscar(String(v))"
      />
      <UButton
        v-if="ativos"
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-x"
        :label="`Limpar (${ativos})`"
        @click="limpar"
      />
    </div>
  </div>
</template>
