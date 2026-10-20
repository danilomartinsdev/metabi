<script setup lang="ts">
import type { AuthResposta } from '@metabi/shared';
import { trocarSenhaSchema } from '@metabi/shared';
import type { FormSubmitEvent } from '@nuxt/ui';
import type { z } from 'zod';
import { useApi } from '~/composables/api/useApi';
import { useAuthStore } from '~/stores/auth';
import { paginaInicial } from '~/utils/navegacao';

const aviso = useAviso();
const auth = useAuthStore();
const obrigatoria = computed(() => auth.usuario?.trocarSenha === true);
definePageMeta({ layout: 'auth' });
useHead({ title: 'Trocar senha — MetaBI' });

const { request } = useApi();
const erro = ref<string | null>(null);
const estado = reactive({ senhaAtual: '', novaSenha: '', confirmacao: '' });

async function salvar({ data: dados }: FormSubmitEvent<z.output<typeof trocarSenhaSchema>>) {
  erro.value = null;
  try {
    // A troca revoga as outras sessões e devolve uma sessão nova.
    const r = await request<AuthResposta>('/auth/trocar-senha', { method: 'POST', body: dados });
    auth.aplicar(r);
    aviso.sucesso('Senha alterada.');
    await navigateTo(paginaInicial(r.usuario));
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    erro.value =
      code === 'INVALID_CREDENTIALS' ? 'A senha atual está incorreta.' : 'Não foi possível trocar a senha.';
  }
}
</script>

<template>
  <UForm :schema="trocarSenhaSchema" :state="estado" class="space-y-5" @submit="salvar">
    <div class="space-y-1">
      <h1 class="text-xl font-semibold">{{ obrigatoria ? 'Crie sua senha' : 'Trocar senha' }}</h1>
      <p class="text-sm text-muted-foreground">
        {{
          obrigatoria
            ? 'Por segurança, troque a senha provisória antes de continuar.'
            : 'Mínimo de 10 caracteres, com letras e números.'
        }}
      </p>
    </div>
    <p
      v-if="erro"
      class="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
      role="alert"
    >
      {{ erro }}
    </p>
    <UiExtraFormField
      v-model="estado.senhaAtual"
      name="senhaAtual"
      :label="obrigatoria ? 'Senha provisória' : 'Senha atual'"
      type="password"
      autocomplete="current-password"
    />
    <UiExtraFormField
      v-model="estado.novaSenha"
      name="novaSenha"
      label="Nova senha"
      type="password"
      autocomplete="new-password"
      dica="Mínimo de 10 caracteres, com letras e números."
    />
    <UiExtraFormField
      v-model="estado.confirmacao"
      name="confirmacao"
      label="Confirme a nova senha"
      type="password"
      autocomplete="new-password"
    />
    <UButton type="submit" size="lg" block class="h-10 justify-center" label="Salvar" loading-auto />
    <p v-if="!obrigatoria" class="text-center">
      <NuxtLink to="/dashboard" class="text-sm text-muted-foreground hover:text-foreground"
        >Cancelar</NuxtLink
      >
    </p>
    <p v-else class="text-center">
      <button
        type="button"
        class="text-sm text-muted-foreground hover:text-foreground"
        @click="auth.logout()"
      >
        Sair
      </button>
    </p>
  </UForm>
</template>
