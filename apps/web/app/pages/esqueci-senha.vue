<script setup lang="ts">
import { esqueciSenhaSchema } from '@metabi/shared';
import type { FormSubmitEvent } from '@nuxt/ui';
import type { z } from 'zod';

definePageMeta({ layout: 'auth' });
useHead({ title: 'Esqueci minha senha — MetaBI' });

const enviado = ref(false);
const erro = ref<string | null>(null);
const estado = reactive({ email: '' });

async function enviar({ data: dados }: FormSubmitEvent<z.output<typeof esqueciSenhaSchema>>) {
  erro.value = null;
  try {
    await $fetch('/api/auth/esqueci-senha', { method: 'POST', body: dados });
    enviado.value = true;
  } catch {
    erro.value = 'Não foi possível enviar agora. Tente novamente em instantes.';
  }
}
</script>

<template>
  <div v-if="enviado" class="space-y-4 text-center">
    <UIcon name="i-lucide-mail-check" class="mx-auto size-10 text-highlight" aria-hidden="true" />
    <h1 class="text-xl font-semibold">Verifique seu e-mail</h1>
    <p class="text-sm text-muted-foreground">
      Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha. O link vale por 1 hora.
    </p>
    <NuxtLink to="/login" class="inline-block text-sm font-medium text-primary hover:underline"
      >Voltar ao login</NuxtLink
    >
  </div>

  <UForm v-else :schema="esqueciSenhaSchema" :state="estado" class="space-y-5" @submit="enviar">
    <div class="space-y-1">
      <h1 class="text-xl font-semibold">Esqueci minha senha</h1>
      <p class="text-sm text-muted-foreground">Informe seu e-mail para receber um link de redefinição.</p>
    </div>
    <p
      v-if="erro"
      class="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
      role="alert"
    >
      {{ erro }}
    </p>
    <UiExtraFormField
      v-model="estado.email"
      name="email"
      label="E-mail"
      type="email"
      autocomplete="username"
    />
    <UButton type="submit" size="lg" block class="h-10 justify-center" label="Enviar link" loading-auto />
    <p class="text-center">
      <NuxtLink to="/login" class="text-sm text-muted-foreground hover:text-foreground"
        >Voltar ao login</NuxtLink
      >
    </p>
  </UForm>
</template>
