<script setup lang="ts">
import {
  type EscopoTipo,
  REGIAO_ENUM_ROTULO,
  REGIOES_ENUM,
  type RegiaoEnum,
  type UsuarioAdmin,
} from '@metabi/shared';
import { mensagemErro } from '~/composables/api/useApi';
import { usePapeisQuery, useSalvarUsuario } from '~/composables/api/useAdmin';
import { useRepresentantesQuery } from '~/composables/api/useCadastros';

const aviso = useAviso();
const aberto = defineModel<boolean>('aberto', { required: true });
const props = defineProps<{ usuario: UsuarioAdmin | null }>();
const emit = defineEmits<{ criado: [email: string, senha: string] }>();

const papeis = usePapeisQuery();
const reps = useRepresentantesQuery();
const salvar = useSalvarUsuario();

const form = reactive({
  nome: '',
  email: '',
  roleId: '',
  escopoTipo: 'representantes' as EscopoTipo,
  escopoRegioes: [] as RegiaoEnum[],
  representanteIds: [] as string[],
});
const erro = ref<string | null>(null);

watch(aberto, (v) => {
  if (!v) return;
  erro.value = null;
  const u = props.usuario;
  Object.assign(form, {
    nome: u?.nome ?? '',
    email: u?.email ?? '',
    roleId: u?.papel.id ?? papeis.data.value?.find((p) => p.chave === 'visualizador')?.id ?? '',
    escopoTipo: u?.escopoTipo ?? 'todos',
    escopoRegioes: [...(u?.escopoRegioes ?? [])],
    representanteIds: u?.representantes.map((r) => r.id) ?? [],
  });
});

const ESCOPOS: { v: EscopoTipo; r: string; d: string }[] = [
  { v: 'todos', r: 'Todos os pedidos', d: 'Vê a empresa inteira.' },
  { v: 'regiao', r: 'Por região', d: 'Só pedidos de UFs das regiões escolhidas.' },
];

/** Papel Representante: em vez do escopo, escolhe-se qual código do Focco é este usuário (vê só as vendas dele). */
const ehRepresentante = computed(
  () => papeis.data.value?.find((p) => p.id === form.roleId)?.chave === 'representante',
);

const itensEscopo = ESCOPOS.map((e) => ({ value: e.v, label: e.r, description: e.d }));
const itensRegiao = REGIOES_ENUM.map((r) => ({ value: r, label: REGIAO_ENUM_ROTULO[r] }));
const itensRepresentante = computed(() =>
  (reps.data.value ?? []).map((r) => ({ value: r.id, label: r.nomeExibicao })),
);

async function enviar() {
  erro.value = null;
  if (ehRepresentante.value && !form.representanteIds.length) {
    erro.value = 'Escolha qual representante é este usuário.';
    return;
  }
  if (!ehRepresentante.value && form.escopoTipo === 'representantes') {
    erro.value = 'Escolha o escopo de dados.';
    return;
  }
  const dados = {
    nome: form.nome,
    roleId: form.roleId,
    ...(ehRepresentante.value
      ? { escopoTipo: 'representantes', escopoRegioes: [], representanteIds: form.representanteIds }
      : { escopoTipo: form.escopoTipo, escopoRegioes: form.escopoRegioes, representanteIds: [] }),
    ...(props.usuario ? {} : { email: form.email }),
  };
  try {
    const r = await salvar.mutateAsync({ id: props.usuario?.id, dados: dados as never });
    aberto.value = false;
    if (r.senhaProvisoria) emit('criado', r.usuario.email, r.senhaProvisoria);
    else aviso.sucesso('Usuário atualizado.');
  } catch (e) {
    erro.value = mensagemErro(e);
  }
}
</script>

<template>
  <UModal
    v-model:open="aberto"
    :title="usuario ? 'Editar usuário' : 'Novo usuário'"
    :description="
      usuario
        ? 'Mudanças de papel e escopo valem na próxima ação do usuário.'
        : 'Uma senha provisória será gerada e exibida uma única vez.'
    "
  >
    <template #body>
      <form id="form-usuario" class="space-y-4" @submit.prevent="enviar">
        <p
          v-if="erro"
          class="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {{ erro }}
        </p>
        <div class="space-y-2">
          <label for="u-nome" class="text-sm font-medium">Nome</label>
          <UInput id="u-nome" v-model="form.nome" class="w-full" required minlength="2" />
        </div>
        <div class="space-y-2">
          <label for="u-email" class="text-sm font-medium">E-mail</label>
          <UInput
            id="u-email"
            v-model="form.email"
            class="w-full"
            type="email"
            required
            :disabled="!!usuario"
          />
        </div>
        <div class="space-y-2">
          <label for="u-papel" class="text-sm font-medium">Papel</label>
          <USelect
            id="u-papel"
            v-model="form.roleId"
            :items="(papeis.data.value ?? []).map((p) => ({ label: p.nome, value: p.id }))"
            class="w-full"
            placeholder="Selecione o papel"
          />
        </div>

        <div v-if="ehRepresentante" class="space-y-2">
          <label for="u-representante" class="text-sm font-medium">Qual representante é este usuário?</label>
          <USelectMenu
            id="u-representante"
            v-model="form.representanteIds"
            :items="itensRepresentante"
            value-key="value"
            multiple
            class="w-full"
            placeholder="Selecione o código do Focco"
            :search-input="{ placeholder: 'Buscar representante' }"
          />
          <p class="text-xs text-muted-foreground">
            Ele verá só as vendas deste representante, inclusive em Minhas vendas.
          </p>
        </div>

        <URadioGroup
          v-else
          v-model="form.escopoTipo"
          legend="Escopo de dados"
          variant="card"
          :items="itensEscopo"
          :ui="{ legend: 'text-sm font-medium mb-2' }"
        />

        <UCheckboxGroup
          v-if="!ehRepresentante && form.escopoTipo === 'regiao'"
          v-model="form.escopoRegioes"
          legend="Regiões"
          :items="itensRegiao"
          :ui="{ legend: 'text-sm font-medium mb-1', fieldset: 'grid grid-cols-2 gap-2' }"
        />
      </form>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" label="Cancelar" @click="aberto = false" />
        <UButton type="submit" form="form-usuario" label="Salvar" :loading="salvar.isPending.value" />
      </div>
    </template>
  </UModal>
</template>
