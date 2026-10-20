<script setup lang="ts">
import type { PreviaNotas } from '@metabi/shared';
import { useConfirmarNotas, usePreviaNotas } from '~/composables/api/useNotasFiscais';

const aberto = defineModel<boolean>('aberto', { required: true });
const aviso = useAviso();
const previaMut = usePreviaNotas();
const confirmarMut = useConfirmarNotas();
const previa = ref<PreviaNotas | null>(null);
const arrastando = ref(false);

const EXTENSOES = ['.xls', '.xlsx', '.csv', '.html', '.htm'];
const TAMANHO_MAX = 4 * 1024 * 1024;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`;
const substituidos = computed(() => previa.value?.meses.reduce((n, m) => n + m.itensExistentes, 0) ?? 0);

watch(aberto, (v) => {
  if (!v) {
    previa.value = null;
    previaMut.reset();
  }
});

async function enviar(arquivo?: File) {
  if (!arquivo) return;
  if (!EXTENSOES.some((e) => arquivo.name.toLowerCase().endsWith(e))) {
    aviso.erro('Formato não suportado. Envie o relatório de notas fiscais do Focco (.xlsx).');
    return;
  }
  if (arquivo.size > TAMANHO_MAX) {
    aviso.erro('Arquivo grande demais. O limite é 4 MB.');
    return;
  }
  previa.value = null;
  try {
    previa.value = await previaMut.mutateAsync(arquivo);
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
    });
    aviso.sucesso(
      `Notas de ${r.meses.map(nomeMes).join(', ')} importadas: ${formatInt(r.itens)} itens${r.substituidos ? ` (substituiu ${formatInt(r.substituidos)} já existentes)` : ''}.`,
    );
    aberto.value = false;
  } catch (e) {
    aviso.erro(e, 'Não foi possível importar.');
  }
}

const podeConfirmar = computed(() => !!previa.value && previa.value.itens > 0 && !previa.value.erros.length);
</script>

<template>
  <UModal
    v-model:open="aberto"
    title="Importar notas fiscais"
    description="Relatório de itens de nota fiscal do Focco (uma linha por item). Cada mês de emissão da planilha substitui o mesmo mês no sistema."
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
        <span class="text-xs text-muted-foreground">.xlsx exportado do Focco — até 4 MB</span>
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
            <p class="text-xs text-muted-foreground">Notas</p>
            <p class="num text-lg font-semibold">{{ formatInt(previa.notas) }}</p>
          </div>
          <div class="rounded-lg border p-3">
            <p class="text-xs text-muted-foreground">Itens</p>
            <p class="num text-lg font-semibold">{{ formatInt(previa.itens) }}</p>
          </div>
          <div class="col-span-2 rounded-lg border p-3">
            <p class="text-xs text-muted-foreground">Valor total no arquivo</p>
            <p class="num text-lg font-semibold">{{ formatBRL(previa.total) }}</p>
          </div>
        </div>

        <ul v-if="previa.meses.length" class="divide-y rounded-lg border text-sm">
          <li
            v-for="m in previa.meses"
            :key="m.mes"
            class="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          >
            <span class="font-medium capitalize">{{ nomeMes(m.mes) }}</span>
            <span class="num text-xs text-muted-foreground">
              {{ formatInt(m.itens) }} itens · {{ formatBRL(m.total) }}
              <template v-if="m.itensExistentes">
                ·
                <span class="text-warning"
                  >substitui {{ formatInt(m.itensExistentes) }} itens ({{
                    formatBRL(m.totalExistente)
                  }})</span
                >
              </template>
              <template v-else> · mês novo</template>
            </span>
          </li>
        </ul>

        <UAlert
          v-if="substituidos"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`Vai substituir ${formatInt(substituidos)} itens já importados`"
          description="As notas desses meses no sistema serão trocadas pelas desta planilha."
        />

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
