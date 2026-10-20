<script setup lang="ts">
import { PERMISSION_LABELS, PERMISSIONS, type PapelAdmin, type Permission } from '@meta-bi/shared';
import { usePapeisQuery, useRemoverPapel, useSalvarPapel } from '~/composables/api/useAdmin';

const aviso = useAviso();
const confirmar = useConfirmacao();
definePageMeta({ titulo: 'Papéis', permissao: 'users.manage' });
useHead({ title: 'Papéis — BI Metahospitalar' });

const papeis = usePapeisQuery();
const salvar = useSalvarPapel();
const remover = useRemoverPapel();

/** Papéis com salvamento em andamento (cada card tem o seu). */
const salvando = reactive(new Set<string>());

/** Rascunho editável por papel. */
const rascunho = ref<Record<string, { nome: string; permissoes: Permission[] }>>({});
watch(
  () => papeis.data.value,
  (lista) => {
    for (const p of lista ?? []) rascunho.value[p.id] ??= { nome: p.nome, permissoes: [...p.permissoes] };
  },
  { immediate: true },
);

const alterado = (p: PapelAdmin) => {
  const r = rascunho.value[p.id];
  return !!r && (r.nome !== p.nome || [...r.permissoes].sort().join() !== [...p.permissoes].sort().join());
};

function alternar(p: PapelAdmin, perm: Permission) {
  const r = rascunho.value[p.id]!;
  r.permissoes = r.permissoes.includes(perm)
    ? r.permissoes.filter((x) => x !== perm)
    : [...r.permissoes, perm];
}

async function gravar(p: PapelAdmin) {
  salvando.add(p.id);
  try {
    const r = await salvar.mutateAsync({ id: p.id, dados: rascunho.value[p.id]! });
    rascunho.value[p.id] = { nome: r.nome, permissoes: [...r.permissoes] };
    aviso.sucesso(`Papel "${r.nome}" salvo. Vale na próxima ação de cada usuário.`);
  } catch (e) {
    aviso.erro(e);
  } finally {
    salvando.delete(p.id);
  }
}

async function novo() {
  const ok = await confirmar({
    titulo: 'Novo papel',
    descricao: 'Ele começa só com acesso à visão geral; marque as permissões depois.',
    campo: { rotulo: 'Nome do papel', placeholder: 'Ex.: Supervisor regional' },
    rotuloConfirmar: 'Criar papel',
    acao: (nome) => salvar.mutateAsync({ dados: { nome, permissoes: ['dashboard.view'] } }),
  });
  if (ok) aviso.sucesso('Papel criado.');
}

async function apagar(p: PapelAdmin) {
  const ok = await confirmar({
    titulo: `Remover o papel "${p.nome}"?`,
    descricao: 'Esta ação não pode ser desfeita.',
    rotuloConfirmar: 'Remover',
    perigo: true,
    acao: () => remover.mutateAsync(p.id),
  });
  if (ok) aviso.sucesso('Papel removido.');
}
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <UiExtraPageHeader
      titulo="Papéis e permissões"
      descricao="O que cada papel pode fazer. O escopo de dados é definido por usuário."
    >
      <UButton color="neutral" variant="outline" icon="i-lucide-plus" label="Novo papel" @click="novo" />
    </UiExtraPageHeader>

    <UiExtraEstadoBloco
      :carregando="papeis.isPending.value"
      :erro="papeis.error.value"
      @tentar-de-novo="papeis.refetch()"
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section
          v-for="p in papeis.data.value"
          :key="p.id"
          class="flex flex-col rounded-xl border bg-card p-5"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <UInput
                v-if="rascunho[p.id]"
                v-model="rascunho[p.id]!.nome"
                class="w-full"
                :ui="{ base: 'font-semibold' }"
                :disabled="p.chave === 'admin'"
                :aria-label="`Nome do papel ${p.nome}`"
              />
              <p class="mt-1 text-xs text-muted-foreground">{{ p.usuarios }} usuário(s)</p>
            </div>
            <UBadge v-if="p.sistema" color="neutral" variant="soft" label="padrão" />
          </div>

          <p v-if="p.chave === 'admin'" class="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <UIcon name="i-lucide-lock" class="size-3.5" /> Admin sempre tem todas as permissões (menos Minhas
            vendas, que é dos representantes).
          </p>
          <ul class="mt-3 flex-1 space-y-1">
            <li
              v-for="perm in PERMISSIONS"
              :key="perm"
              class="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
            >
              <UCheckbox
                class="flex-1"
                :disabled="p.chave === 'admin'"
                :model-value="rascunho[p.id]?.permissoes.includes(perm)"
                :label="PERMISSION_LABELS[perm]"
                @update:model-value="alternar(p, perm)"
              />
              <code class="text-[10px] text-muted-foreground">{{ perm }}</code>
            </li>
          </ul>

          <div class="mt-4 flex justify-between gap-2 border-t pt-4">
            <UButton
              v-if="!p.sistema"
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-trash-2"
              label="Remover"
              @click="apagar(p)"
            />
            <span v-else />
            <UButton
              size="sm"
              icon="i-lucide-save"
              label="Salvar"
              :loading="salvando.has(p.id)"
              :disabled="!alterado(p)"
              @click="gravar(p)"
            />
          </div>
        </section>
      </div>
    </UiExtraEstadoBloco>
  </div>
</template>
