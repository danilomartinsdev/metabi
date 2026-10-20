<script setup lang="ts">
import type { PreviaFaturamento } from '@metabi/shared';
import { useConfirmarFaturamento, usePreviaFaturamento } from '~/composables/api/useFaturamento';

const aberto = defineModel<boolean>('aberto', { required: true });
const aviso = useAviso();
const previaMut = usePreviaFaturamento();
const confirmarMut = useConfirmarFaturamento();
const previa = ref<PreviaFaturamento | null>(null);
const arrastando = ref(false);

const EXTENSOES = ['.xls', '.xlsx', '.csv', '.html', '.htm'];
const TAMANHO_MAX = 4 * 1024 * 1024;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
/** Meses da planilha marcados para importar (todos, por padrão). */
const selecionados = ref<number[]>([]);

function alternar(mes: number, marcado: boolean) {
  selecionados.value = marcado
    ? [...new Set([...selecionados.value, mes])].sort((a, b) => a - b)
    : selecionados.value.filter((m) => m !== mes);
}

const escolhidos = computed(
  () => previa.value?.meses.filter((m) => selecionados.value.includes(m.mes)) ?? [],
);
const diasSubstituidos = computed(() => escolhidos.value.reduce((n, m) => n + m.diasExistentes, 0));
const nomesEscolhidos = computed(() => escolhidos.value.map((m) => MESES[m.mes - 1]).join(', '));

watch(aberto, (v) => {
  if (!v) {
    previa.value = null;
    selecionados.value = [];
    previaMut.reset();
  }
});

async function enviar(arquivo?: File) {
  if (!arquivo) return;
  if (!EXTENSOES.some((e) => arquivo.name.toLowerCase().endsWith(e))) {
    aviso.erro('Formato não suportado. Envie o relatório de faturamento do Focco (.xls).');
    return;
  }
  if (arquivo.size > TAMANHO_MAX) {
    aviso.erro('Arquivo grande demais. O limite é 4 MB.');
    return;
  }
  previa.value = null;
  try {
    previa.value = await previaMut.mutateAsync(arquivo);
    selecionados.value = previa.value.meses.map((m) => m.mes);
  } catch (e) {
    aviso.erro(e, 'Não foi possível ler o arquivo.');
  }
}

async function confirmar() {
  if (!previa.value) return;
  try {
    const r = await confirmarMut.mutateAsync({
      hash: previa.value.hash,
      arquivoNome: previa.value.arquivoNome,
      meses: selecionados.value,
    });
    const meses = r.meses.map((m) => MESES[m - 1]).join(', ');
    aviso.sucesso(
      `Faturamento de ${meses}/${r.ano} importado: ${r.dias} dias${r.substituidos ? ` (substituiu ${r.substituidos} já existentes)` : ''}.`,
    );
    aberto.value = false;
  } catch (e) {
    aviso.erro(e, 'Não foi possível importar.');
  }
}

const podeConfirmar = computed(
  () =>
    !!previa.value &&
    previa.value.ano !== null &&
    !previa.value.erros.length &&
    selecionados.value.length > 0,
);
</script>

<template>
  <UModal
    v-model:open="aberto"
    title="Importar faturamento"
    description="Relatório diário de faturamento do Focco (uma linha por dia). Você escolhe quais meses da planilha importar."
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <label
        class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:border-primary"
        :class="arrastando ? 'border-primary bg-primary-soft' : 'hover:border-primary/60'"
        @dragover.prevent="arrastando = true"
        @dragleave.prevent="arrastando = false"
        @drop.prevent="
          arrastando = false;
          enviar($event.dataTransfer?.files?.[0]);
        "
      >
        <UIcon name="i-lucide-file-up" class="size-7 text-primary" />
        <span class="font-medium">{{
          previaMut.isPending.value ? 'Lendo arquivo…' : 'Arraste o arquivo aqui ou clique para escolher'
        }}</span>
        <span class="text-xs text-muted-foreground">.xls exportado do Focco — até 4 MB</span>
        <input
          type="file"
          class="sr-only"
          accept=".xls,.xlsx,.csv,.html,.htm"
          @change="
            enviar(($event.target as HTMLInputElement).files?.[0]);
            ($event.target as HTMLInputElement).value = '';
          "
        />
      </label>

      <div v-if="previa" class="mt-5 space-y-4">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-lg border p-3">
            <p class="text-xs text-muted-foreground">Ano</p>
            <p class="num text-lg font-semibold">{{ previa.ano ?? '—' }}</p>
          </div>
          <div class="rounded-lg border p-3">
            <p class="text-xs text-muted-foreground">Dias</p>
            <p class="num text-lg font-semibold">{{ formatInt(previa.dias) }}</p>
          </div>
          <div class="col-span-2 rounded-lg border p-3">
            <p class="text-xs text-muted-foreground">Fatura DRE no arquivo</p>
            <p class="num text-lg font-semibold">{{ formatBRL(previa.totais.dre) }}</p>
          </div>
        </div>

        <fieldset v-if="previa.meses.length" class="space-y-2">
          <legend class="mb-2 text-sm font-medium">Quais meses importar?</legend>
          <p class="mb-2 text-xs text-muted-foreground">
            Cada mês marcado é <strong>substituído por completo</strong>: o que já existe no sistema para ele
            é apagado e trocado pelos dias desta planilha. Meses não marcados, e os demais meses do ano, não
            mudam.
          </p>
          <label
            v-for="m in previa.meses"
            :key="m.mes"
            class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-elevated/50"
            :class="selecionados.includes(m.mes) ? 'border-primary/60' : ''"
          >
            <UCheckbox
              :model-value="selecionados.includes(m.mes)"
              class="mt-0.5"
              :aria-label="`Importar ${MESES_LONGOS[m.mes - 1]}`"
              @update:model-value="alternar(m.mes, $event === true)"
            />
            <span class="min-w-0 flex-1">
              <span class="block font-medium capitalize">{{ MESES_LONGOS[m.mes - 1] }}/{{ previa.ano }}</span>
              <span class="num block text-xs text-muted-foreground">
                Na planilha: {{ formatInt(m.dias) }} {{ m.dias === 1 ? 'dia' : 'dias' }} ·
                {{ formatBRL(m.dre) }}
              </span>
              <span
                class="num block text-xs"
                :class="m.diasExistentes ? 'text-warning' : 'text-muted-foreground'"
              >
                <template v-if="m.diasExistentes">
                  No sistema hoje: {{ formatInt(m.diasExistentes) }}
                  {{ m.diasExistentes === 1 ? 'dia' : 'dias' }} · {{ formatBRL(m.dreExistente) }} — será
                  substituído
                </template>
                <template v-else>Mês novo — nada a substituir</template>
              </span>
            </span>
          </label>
        </fieldset>

        <UAlert
          v-if="diasSubstituidos"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`Vai substituir ${formatInt(diasSubstituidos)} dias já importados de ${nomesEscolhidos}/${previa.ano}`"
          description="O faturamento desses meses no sistema será trocado pelo desta planilha."
        />
        <p v-else-if="!selecionados.length && !previa.erros.length" class="text-xs text-warning">
          Marque ao menos um mês para importar.
        </p>

        <UAlert
          v-if="previa.erros.length"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-x"
          :title="`${previa.erros.length} linha(s) com erro — corrija o arquivo e envie de novo`"
        >
          <template #description>
            <ul class="mt-1 space-y-0.5 text-xs">
              <li v-for="e in previa.erros.slice(0, 8)" :key="e.linha">
                Linha {{ e.linha }}: {{ e.mensagens.join('; ') }}
              </li>
              <li v-if="previa.erros.length > 8">… e mais {{ previa.erros.length - 8 }}.</li>
            </ul>
          </template>
        </UAlert>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Cancelar" @click="aberto = false" />
        <UButton
          icon="i-lucide-check"
          label="Importar"
          :disabled="!podeConfirmar"
          :loading="confirmarMut.isPending.value"
          @click="confirmar"
        />
      </div>
    </template>
  </UModal>
</template>
