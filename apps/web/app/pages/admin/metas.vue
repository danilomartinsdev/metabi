<script setup lang="ts">
import { valorMetaSchema } from '@metabi/shared';
import { useEventListener } from '@vueuse/core';
import { useMetasQuery, useRepresentantesQuery, useSalvarMetas } from '~/composables/api/useCadastros';

const aviso = useAviso();
const confirmar = useConfirmacao();
definePageMeta({ titulo: 'Metas', permissao: 'metas.edit' });
useHead({ title: 'Metas — MetaBI' });

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const anoAtual = new Date().getFullYear();
const ano = ref(anoAtual);
const metas = useMetasQuery(ano);
const reps = useRepresentantesQuery();
const salvarMut = useSalvarMetas();

/** Grade editável: chave `${representanteId ?? 'total'}:${mes}` → texto digitado. */
const grade = ref<Record<string, string>>({});
const chave = (rep: string | null, mes: number) => `${rep ?? 'total'}:${mes}`;
const linhas = computed(() => [
  { id: null as string | null, nome: 'Meta total da empresa' },
  ...(reps.data.value ?? [])
    .filter((r) => r.ativo)
    .map((r) => ({ id: r.id as string | null, nome: r.nomeExibicao })),
]);

/** Estado salvo, para saber se há alterações pendentes. */
const original = ref('{}');
watch(
  () => metas.data.value,
  (dados) => {
    const g: Record<string, string> = {};
    for (const m of dados ?? [])
      g[chave(m.representanteId, m.mes)] = Number(m.valor).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
      });
    grade.value = g;
    original.value = JSON.stringify(g);
  },
  { immediate: true },
);

const limpa = (g: Record<string, string>) =>
  JSON.stringify(Object.fromEntries(Object.entries(g).filter(([, v]) => v?.trim())));
const alterado = computed(() => limpa(grade.value) !== limpa(JSON.parse(original.value)));

/** Células com valor que a API recusaria (mesmo schema do backend). */
const invalidas = computed(
  () =>
    new Set(
      Object.entries(grade.value)
        .filter(([, v]) => v?.trim() && !valorMetaSchema.safeParse(v).success)
        .map(([k]) => k),
    ),
);

const descartar = () =>
  confirmar({
    titulo: 'Descartar alterações?',
    descricao: 'Há metas digitadas que ainda não foram salvas.',
    rotuloConfirmar: 'Descartar',
    perigo: true,
  });

/** Troca de ano pede confirmação se houver alterações. */
const anoSelecionado = computed({
  get: () => ano.value,
  set: async (v: number) => {
    if (alterado.value && !(await descartar())) return;
    ano.value = v;
  },
});

onBeforeRouteLeave(async () => (alterado.value ? await descartar() : true));
useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
  if (alterado.value) e.preventDefault();
});

async function salvar() {
  if (invalidas.value.size) {
    aviso.erro(
      `${invalidas.value.size} valor(es) inválido(s), marcados em vermelho. Use o formato 1.234,56.`,
    );
    return;
  }
  const lista = linhas.value.flatMap((l) =>
    MESES.map((_, i) => {
      const v = grade.value[chave(l.id, i + 1)]?.trim();
      return { mes: i + 1, representanteId: l.id, valor: v ? v : null };
    }),
  );
  try {
    await salvarMut.mutateAsync({ ano: ano.value, metas: lista });
    original.value = JSON.stringify(grade.value);
    aviso.sucesso('Metas salvas.');
  } catch (e) {
    aviso.erro(e, 'Verifique os valores digitados.');
  }
}
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <UiExtraPageHeader titulo="Metas" descricao="Metas mensais em R$: total da empresa e por representante.">
      <USelect
        v-model="anoSelecionado"
        :items="[anoAtual - 1, anoAtual, anoAtual + 1]"
        class="w-28"
        aria-label="Ano"
      />
      <UBadge v-if="alterado" color="warning" variant="soft" label="Alterações não salvas" />
      <UButton icon="i-lucide-save" label="Salvar" :loading="salvarMut.isPending.value" @click="salvar" />
    </UiExtraPageHeader>

    <section class="rounded-xl border bg-card">
      <UiExtraEstadoBloco
        :carregando="metas.isPending.value || reps.isPending.value"
        :erro="metas.error.value || reps.error.value"
        @tentar-de-novo="metas.refetch()"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th class="sticky left-0 bg-muted px-4 py-3 text-left font-medium">Representante</th>
                <th v-for="m in MESES" :key="m" class="px-1 py-3 text-right font-medium">{{ m }}</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr
                v-for="l in linhas"
                :key="l.id ?? 'total'"
                :class="l.id === null && 'bg-primary-soft/50 font-medium'"
              >
                <th
                  class="sticky left-0 max-w-56 truncate bg-card px-4 py-2 text-left font-medium"
                  :title="l.nome"
                >
                  {{ l.nome }}
                </th>
                <td v-for="(m, i) in MESES" :key="m" class="px-1 py-1.5">
                  <UInput
                    v-model="grade[chave(l.id, i + 1)]"
                    inputmode="decimal"
                    placeholder="—"
                    size="sm"
                    class="w-28"
                    :ui="{ base: 'num text-right' }"
                    :color="invalidas.has(chave(l.id, i + 1)) ? 'error' : undefined"
                    :highlight="invalidas.has(chave(l.id, i + 1))"
                    :aria-invalid="invalidas.has(chave(l.id, i + 1)) || undefined"
                    :aria-label="`Meta de ${l.nome} em ${m}`"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiExtraEstadoBloco>
    </section>
    <p class="text-xs text-muted-foreground">
      Deixe em branco para remover a meta do mês. Valores aceitam "1.234,56".
    </p>
  </div>
</template>
