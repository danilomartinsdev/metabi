<script setup lang="ts">
import { loginSchema } from '@meta-bi/shared';
import type { FormSubmitEvent } from '@nuxt/ui';
import type { z } from 'zod';
import { useAuthStore } from '~/stores/auth';
import { paginaInicial } from '~/utils/navegacao';

definePageMeta({ layout: 'auth' });
useHead({ title: 'Entrar — BI Metahospitalar' });

const auth = useAuthStore();
const route = useRoute();
const erroGeral = ref<string | null>(
  route.query.motivo === 'sessao-expirada' ? 'Sua sessão expirou. Entre novamente.' : null,
);

const estado = reactive({ email: '', senha: '' });

const MENSAGENS: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  ACCOUNT_LOCKED: 'Acesso bloqueado temporariamente após várias tentativas. Tente de novo mais tarde.',
  ACCOUNT_DISABLED: 'Usuário desativado. Fale com o administrador.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um minuto.',
};

async function entrar({ data: dados }: FormSubmitEvent<z.output<typeof loginSchema>>) {
  erroGeral.value = null;
  try {
    const usuario = await auth.login(dados);
    const destino =
      typeof route.query.r === 'string' && route.query.r.startsWith('/')
        ? route.query.r
        : paginaInicial(usuario);
    await navigateTo(usuario.trocarSenha ? '/trocar-senha' : destino);
  } catch (e: unknown) {
    const code = (e as { data?: { code?: string } }).data?.code;
    erroGeral.value = (code && MENSAGENS[code]) ?? 'Não foi possível entrar. Tente novamente.';
  }
}
</script>

<template>
  <UForm :schema="loginSchema" :state="estado" class="space-y-5" @submit="entrar">
    <div class="mb-8 text-center">
      <h1 class="text-3xl font-semibold tracking-tight">Bem-vindo de volta</h1>
      <p class="mt-2 text-sm text-muted-foreground">Use o e-mail e a senha fornecidos pelo administrador.</p>
    </div>

    <p
      v-if="erroGeral"
      class="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
      role="alert"
    >
      {{ erroGeral }}
    </p>

    <UiExtraFormField
      v-model="estado.email"
      name="email"
      label="E-mail"
      type="email"
      autocomplete="username"
      inputmode="email"
      placeholder="Seu e-mail"
    />
    <UiExtraFormField
      v-model="estado.senha"
      name="senha"
      label="Senha"
      type="password"
      autocomplete="current-password"
      placeholder="Sua senha"
    >
      <template #acao>
        <NuxtLink to="/esqueci-senha" class="text-xs font-medium text-primary hover:underline"
          >Esqueci minha senha</NuxtLink
        >
      </template>
    </UiExtraFormField>

    <UButton
      type="submit"
      size="lg"
      block
      class="h-11 justify-center bg-primary-strong hover:bg-primary-strong/90 dark:bg-primary dark:hover:bg-primary/90"
      label="Entrar"
      loading-auto
    />
  </UForm>
</template>
