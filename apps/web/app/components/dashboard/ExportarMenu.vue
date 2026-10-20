<script setup lang="ts">
import type { ExportXlsxTipo } from '@metabi/shared';
import type { DropdownMenuItem } from '@nuxt/ui';
import { useApi } from '~/composables/api/useApi';

/** `xlsx`: planilha da tela atual. O PDF é sempre o relatório executivo com os filtros atuais. */
const props = defineProps<{ xlsx?: ExportXlsxTipo; ordenacao?: { sort: string; dir: string } }>();

const { baixar } = useApi();
const { query } = useFiltros();
const can = useCan();
const aviso = useAviso();
const gerando = ref<'xlsx' | 'pdf' | null>(null);

async function exportar(formato: 'xlsx' | 'pdf') {
  if (gerando.value) return;
  gerando.value = formato;
  const qs = new URLSearchParams({ ...query.value, ...(formato === 'xlsx' ? props.ordenacao : {}) });
  try {
    await baixar(formato === 'xlsx' ? `/export/xlsx/${props.xlsx}?${qs}` : `/export/pdf?${qs}`);
    aviso.sucesso(formato === 'xlsx' ? 'Planilha gerada.' : 'PDF gerado.');
  } catch (e) {
    aviso.erro(e, formato === 'pdf' ? 'Não foi possível gerar o PDF.' : 'Não foi possível gerar a planilha.');
  } finally {
    gerando.value = null;
  }
}

const itens = computed<DropdownMenuItem[]>(() => [
  ...(props.xlsx && can('export.xlsx')
    ? [{ label: 'Excel (.xlsx)', icon: 'i-lucide-file-spreadsheet', onSelect: () => exportar('xlsx') }]
    : []),
  ...(can('export.pdf')
    ? [{ label: 'Relatório executivo (PDF)', icon: 'i-lucide-file-text', onSelect: () => exportar('pdf') }]
    : []),
]);
</script>

<template>
  <UDropdownMenu v-if="itens.length" :items="itens" :content="{ align: 'end' }">
    <UButton
      color="neutral"
      variant="outline"
      size="sm"
      icon="i-lucide-download"
      :loading="!!gerando"
      :label="gerando === 'pdf' ? 'Gerando PDF…' : gerando === 'xlsx' ? 'Gerando planilha…' : 'Exportar'"
    />
  </UDropdownMenu>
</template>
