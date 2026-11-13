<script setup lang="ts">
import { LIMPEZA_AREAS, LIMPEZA_AREAS_INFO, type LimpezaArea } from '@metabi/shared';
import { useExecutarLimpeza, useLimpezaQuery } from '~/composables/api/useAdmin';

definePageMeta({ titulo: 'Limpar dados', permissao: 'users.manage' });
useHead({ title: 'Limpar dados — MetaBI' });

const aviso = useAviso();
const confirmarAcao = useConfirmacao();
const resumoQ = useLimpezaQuery();
const executar = useExecutarLimpeza();

const ano = ref<number | undefined>();
const marcadas = ref<LimpezaArea[]>([]);

const anos = computed(() => resumoQ.data.value ?? []);
const itensAno = computed(() => anos.value.map((a) => ({ label: String(a.ano), value: a.ano })));
const contagens = computed(() => anos.value.find((a) => a.ano === ano.value)?.contagens);

// Ao trocar o ano, a seleção anterior não vale mais.
watch(ano, () => {
  marcadas.value = [];
});

const itensAreas = computed(() =>
  LIMPEZA_AREAS.map((area) => {
    const n = contagens.value?.[area] ?? 0;
    return {
      value: area,
      label: LIMPEZA_AREAS_INFO[area].rotulo,
      description: `${LIMPEZA_AREAS_INFO[area].descricao} ${n ? `${n.toLocaleString('pt-BR')} registro(s).` : 'Nada neste ano.'}`,
      disabled: !n,
    };
  }),
);

const total = computed(() => marcadas.value.reduce((s, a) => s + (contagens.value?.[a] ?? 0), 0));
const podeApagar = computed(() => ano.value !== undefined && marcadas.value.length > 0);

async function apagar() {
  const alvo = ano.value;
  if (alvo === undefined || !marcadas.value.length) return;
  const nomes = marcadas.value.map((a) => LIMPEZA_AREAS_INFO[a].rotulo).join(', ');
  const areas = [...marcadas.value];
  const ok = await confirmarAcao({
    titulo: `Apagar os dados de ${alvo}?`,
    descricao: `Serão apagados definitivamente (${total.value.toLocaleString('pt-BR')} registros): ${nomes}. Não há como desfazer. Para confirmar, digite o ano.`,
    rotuloConfirmar: 'Apagar dados',
    perigo: true,
    campo: { rotulo: 'Digite o ano para confirmar', placeholder: String(alvo) },
    acao: async (texto) => {
      if (texto.trim() !== String(alvo)) throw new Error('O ano digitado não confere.');
      await executar.mutateAsync({ ano: alvo, areas, confirmacao: Number(texto.trim()) });
    },
  });
  if (ok) {
    aviso.sucesso(`Dados de ${alvo} apagados.`);
    marcadas.value = [];
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <UiExtraPageHeader
      titulo="Limpar dados"
      descricao="Apague os dados de um ano, escolhendo quais menus entram na limpeza. Só Admin."
    />

    <UAlert
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Ação definitiva"
      description="Faça um backup do banco antes. Usuários, papéis, representantes, clientes, status PDV e a auditoria nunca são apagados."
    />

    <UAlert v-if="resumoQ.error.value" color="error" variant="subtle" title="Não foi possível carregar os anos.">
      <template #actions>
        <UButton size="xs" color="neutral" variant="outline" label="Tentar de novo" @click="resumoQ.refetch()" />
      </template>
    </UAlert>

    <p v-else-if="!resumoQ.isPending.value && !anos.length" class="text-sm text-muted-foreground">
      Não há dados para apagar.
    </p>

    <template v-else>
      <UFormField label="Ano">
        <USelect
          v-model="ano"
          :items="itensAno"
          :loading="resumoQ.isPending.value"
          placeholder="Escolha o ano"
          class="w-40"
        />
      </UFormField>

      <UFormField v-if="ano !== undefined" :label="`O que apagar em ${ano}`">
        <UCheckboxGroup v-model="marcadas" :items="itensAreas" value-key="value" variant="card" />
      </UFormField>

      <UButton
        color="error"
        icon="i-lucide-trash-2"
        :label="podeApagar ? `Apagar ${total.toLocaleString('pt-BR')} registros` : 'Apagar'"
        :disabled="!podeApagar"
        :loading="executar.isPending.value"
        @click="apagar"
      />
    </template>
  </div>
</template>
