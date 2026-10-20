<script setup lang="ts">
import { redefinirSenhaSchema } from '@metabi/shared';
import type { FormSubmitEvent } from '@nuxt/ui';
import type { z } from 'zod';

const aviso = useAviso();
definePageMeta({ layout: 'auth' });
useHead({ title: 'Redefinir senha — MetaBI' });

const route = useRoute();
const token = typeof route.query.token === 'string' ? route.query.token : '';
const erro = ref<string | null>(token ? null : 'Link inválido. Peça um novo em "Esqueci minha senha".');

const estado = reactive({ token, novaSenha: '', confirmacao: '' });

async function salvar({ data: dados }: FormSubmitEvent<z.output<typeof redefinirSenhaSchema>>) {
  erro.value = null;
  try {
    await $fetch('/api/auth/redefinir-senha', { method: 'POST', body: dados });
    aviso.sucesso('Senha redefinida. Entre com a nova senha.');
    await navigateTo('/login');
  } catch {
    erro.value = 'Link inválido ou expirado. Peça um novo em "Esqueci minha senha".';
  }
}
</script>

<template>
  <UForm :schema="redefinirSenhaSchema" :state="estado" class="space-y-5" @submit="salvar">
    <div class="space-y-1">
      <h1 class="text-xl font-semibold">Definir nova senha</h1>
      <p class="text-sm text-muted-foreground">Mínimo de 10 caracteres, com letras e números.</p>
    </div>
    <p
      v-if="erro"
      class="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
      role="alert"
    >
      {{ erro }}
    </p>
    <UiExtraFormField
      v-model="estado.novaSenha"
      name="novaSenha"
      label="Nova senha"
      type="password"
      autocomplete="new-password"
    />
    <UiExtraFormField
      v-model="estado.confirmacao"
      name="confirmacao"
      label="Confirme a nova senha"
      type="password"
      autocomplete="new-password"
    />
    <UButton
      type="submit"
      size="lg"
      block
      class="h-10 justify-center"
      label="Salvar nova senha"
      loading-auto
      :disabled="!token"
    />
  </UForm>
</template>
