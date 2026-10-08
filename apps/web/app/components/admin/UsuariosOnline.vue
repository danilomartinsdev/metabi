<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core';
import { useUsuariosOnlineQuery } from '~/composables/api/useAdmin';

/** Aba "Online" da auditoria: quantos e quais usuários estão com o sistema aberto. */
const q = useUsuariosOnlineQuery(true);
const usuarios = computed(() => q.data.value?.usuarios ?? []);

/** "agora", "há 2 min" — relativo ao último sinal. */
const agora = ref(Date.now());
useIntervalFn(() => (agora.value = Date.now()), 15_000);
function ha(iso: string) {
  const min = Math.floor((agora.value - new Date(iso).getTime()) / 60_000);
  return min < 1 ? 'agora' : `há ${min} min`;
}
</script>

<template>
  <div class="space-y-4">
    <section
      aria-label="Resumo de usuários online"
      class="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border bg-card px-5 py-4"
    >
      <div>
        <p class="text-xs text-muted-foreground">Usuários online agora</p>
        <USkeleton v-if="q.isPending.value" class="mt-1 h-8 w-12" />
        <p v-else class="num flex items-center gap-2 text-3xl font-semibold">
          <span class="size-2.5 rounded-full" :class="usuarios.length ? 'bg-success' : 'bg-muted'" />
          {{ formatInt(usuarios.length) }}
        </p>
      </div>
      <p class="max-w-md text-xs text-muted-foreground">
        Conta quem está com o sistema aberto e deu sinal nos últimos
        {{ q.data.value?.janelaMinutos ?? 5 }} minutos. A lista se atualiza sozinha a cada 30 segundos.
      </p>
    </section>

    <section class="rounded-xl border bg-card">
      <UiExtraEstadoBloco
        :carregando="q.isPending.value"
        :erro="q.error.value"
        :vazio="!usuarios.length"
        texto-vazio="Ninguém online no momento."
        :linhas="4"
        @tentar-de-novo="q.refetch()"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-5 py-3 font-medium">Usuário</th>
                <th class="px-3 py-3 font-medium">Papel</th>
                <th class="px-3 py-3 font-medium">Último sinal</th>
                <th class="px-3 py-3 font-medium">Navegador</th>
                <th class="px-5 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="u in usuarios" :key="u.id">
                <td class="px-5 py-2.5">
                  <span class="flex items-center gap-2 font-medium">
                    <span class="size-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
                    {{ u.nome }}
                  </span>
                  <span class="block pl-4 text-xs text-muted-foreground">{{ u.email }}</span>
                </td>
                <td class="px-3 py-2.5">{{ u.papel }}</td>
                <td class="num whitespace-nowrap px-3 py-2.5" :title="formatDateTime(u.ultimaAtividadeEm)">
                  {{ ha(u.ultimaAtividadeEm) }}
                </td>
                <td class="px-3 py-2.5">{{ u.dispositivo ?? '—' }}</td>
                <td class="num px-5 py-2.5 text-muted-foreground">{{ u.ip ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiExtraEstadoBloco>
    </section>
  </div>
</template>
