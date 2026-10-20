<script setup lang="ts">
import { SEGMENTO_ROTULO, SEGMENTOS, type Segmento } from '@metabi/shared';
import {
  type Representante,
  useAtualizarRepresentante,
  useRepresentantesQuery,
} from '~/composables/api/useCadastros';

const aviso = useAviso();
definePageMeta({ titulo: 'Representantes', permissao: 'cadastros.edit' });
useHead({ title: 'Representantes — MetaBI' });

const reps = useRepresentantesQuery();
const atualizar = useAtualizarRepresentante();

/** O USelect não aceita '' como valor: NENHUM representa "sem segmento definido". */
const NENHUM = 'NENHUM';
const itensSegmento = [
  { label: 'Não definido', value: NENHUM },
  ...SEGMENTOS.map((s) => ({ label: SEGMENTO_ROTULO[s], value: s })),
];

/** Linhas com salvamento em andamento. */
const salvando = reactive(new Set<string>());

async function salvar(
  r: Representante,
  dados: Parameters<typeof atualizar.mutateAsync>[0]['dados'],
  msg = 'Salvo.',
) {
  salvando.add(r.id);
  try {
    await atualizar.mutateAsync({ id: r.id, dados });
    aviso.sucesso(msg);
  } catch (e) {
    aviso.erro(e, 'Não foi possível salvar.');
  } finally {
    salvando.delete(r.id);
  }
}

function salvarNome(r: Representante, e: Event) {
  const nome = (e.target as HTMLInputElement).value.trim();
  if (nome && nome !== r.nomeExibicao) void salvar(r, { nomeExibicao: nome }, 'Nome atualizado.');
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <UiExtraPageHeader
      titulo="Representantes"
      descricao="Representantes vindos do Focco. Ajuste o nome de exibição, o segmento padrão e se estão ativos."
    />
    <section class="rounded-xl border bg-card">
      <UiExtraEstadoBloco
        :carregando="reps.isPending.value"
        :erro="reps.error.value"
        :vazio="!reps.data.value?.length"
        texto-vazio="Nenhum representante. Eles são criados automaticamente na importação."
        @tentar-de-novo="reps.refetch()"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-5 py-3 font-medium">Código (Focco)</th>
                <th class="px-3 py-3 font-medium">Nome de exibição</th>
                <th class="px-3 py-3 font-medium">Segmento padrão</th>
                <th class="px-5 py-3 font-medium">Ativo</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr
                v-for="r in reps.data.value"
                :key="r.id"
                :aria-busy="salvando.has(r.id)"
                class="transition-opacity"
                :class="salvando.has(r.id) && 'opacity-60'"
              >
                <td class="px-5 py-2 font-medium">{{ r.codigo }}</td>
                <td class="px-3 py-2">
                  <UInput
                    :model-value="r.nomeExibicao"
                    class="min-w-56"
                    :aria-label="`Nome de exibição de ${r.codigo}`"
                    @blur="salvarNome(r, $event)"
                    @keydown.enter="($event.target as HTMLInputElement).blur()"
                  />
                </td>
                <td class="px-3 py-2">
                  <USelect
                    :model-value="r.segmentoPadrao ?? NENHUM"
                    :items="itensSegmento"
                    class="w-40"
                    :aria-label="`Segmento de ${r.codigo}`"
                    @update:model-value="
                      (v) => salvar(r, { segmentoPadrao: (v === NENHUM ? null : v) as Segmento | null })
                    "
                  />
                </td>
                <td class="px-5 py-2">
                  <USwitch
                    :model-value="r.ativo"
                    :label="r.ativo ? 'Ativo' : 'Inativo'"
                    :aria-label="`${r.codigo} ativo`"
                    @update:model-value="(v) => salvar(r, { ativo: v })"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiExtraEstadoBloco>
    </section>
  </div>
</template>
