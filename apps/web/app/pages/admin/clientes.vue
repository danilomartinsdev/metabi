<script setup lang="ts">
import { SEGMENTO_ROTULO, SEGMENTOS, type Segmento } from '@metabi/shared';
import { refDebounced } from '@vueuse/core';
import { useAtualizarCliente, useClientesAdminQuery } from '~/composables/api/useAdmin';

const aviso = useAviso();
definePageMeta({ titulo: 'Segmento por cliente', permissao: 'cadastros.edit' });
useHead({ title: 'Segmento por cliente — MetaBI' });

const busca = ref('');
const buscaDebounced = refDebounced(busca, 350);
const page = ref(1);
const pageSize = ref(25);
watch([buscaDebounced, pageSize], () => (page.value = 1));
const qs = computed(() =>
  new URLSearchParams({
    page: String(page.value),
    pageSize: String(pageSize.value),
    ...(buscaDebounced.value ? { busca: buscaDebounced.value } : {}),
  }).toString(),
);
const q = useClientesAdminQuery(qs);
const atualizar = useAtualizarCliente();

/** O USelect não aceita '' como valor: NENHUM representa "sem segmento definido". */
const NENHUM = 'NENHUM';
const itensSegmento = [
  { label: 'Do representante', value: NENHUM },
  ...SEGMENTOS.map((s) => ({ label: SEGMENTO_ROTULO[s], value: s })),
];

/** Linhas com salvamento em andamento. */
const salvando = reactive(new Set<string>());

async function salvar(id: string, v: string) {
  salvando.add(id);
  try {
    await atualizar.mutateAsync({ id, segmentoOverride: (v === NENHUM ? null : v) as Segmento | null });
    aviso.sucesso('Segmento salvo.');
  } catch (e) {
    aviso.erro(e, 'Não foi possível salvar.');
  } finally {
    salvando.delete(id);
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <UiExtraPageHeader
      titulo="Segmento por cliente"
      descricao="Por padrão o segmento vem do representante. Defina aqui só as exceções (ex.: cliente público atendido por representante privado)."
    />
    <UInput
      v-model="busca"
      icon="i-lucide-search"
      class="w-full max-w-sm"
      placeholder="Buscar cliente"
      aria-label="Buscar cliente"
    />
    <section class="rounded-xl border bg-card">
      <UiExtraEstadoBloco
        :carregando="q.isPending.value"
        :erro="q.error.value"
        :vazio="!q.data.value?.data.length"
        texto-vazio="Nenhum cliente encontrado."
        @tentar-de-novo="q.refetch()"
      >
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th class="px-5 py-3 font-medium">Cliente</th>
              <th class="px-5 py-3 font-medium">Segmento</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr
              v-for="c in q.data.value?.data"
              :key="c.id"
              :aria-busy="salvando.has(c.id)"
              class="transition-opacity"
              :class="salvando.has(c.id) && 'opacity-60'"
            >
              <td class="px-5 py-2">{{ c.nomeOriginal }}</td>
              <td class="px-5 py-2">
                <USelect
                  :model-value="c.segmentoOverride ?? NENHUM"
                  :items="itensSegmento"
                  size="sm"
                  class="w-44"
                  :aria-label="`Segmento de ${c.nomeOriginal}`"
                  @update:model-value="(v) => salvar(c.id, String(v))"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <UiExtraPaginacaoBar
          v-model:pagina="page"
          v-model:por-pagina="pageSize"
          :total="q.data.value?.meta.total ?? 0"
          rotulo="clientes"
        />
      </UiExtraEstadoBloco>
    </section>
  </div>
</template>
