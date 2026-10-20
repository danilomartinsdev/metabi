<script setup lang="ts">
import { NAV } from '~/components/layout/nav';

const route = useRoute();
const item = computed(() => NAV.flatMap((g) => g.itens).find((i) => route.path.startsWith(i.to) && i.fase));
definePageMeta({ titulo: '' });
useHead({ title: () => `${item.value?.label ?? 'Página não encontrada'} — MetaBI` });
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
    <UIcon name="i-lucide-construction" class="size-12 text-muted-foreground" aria-hidden="true" />
    <template v-if="item">
      <h2 class="text-xl font-semibold">{{ item.label }}</h2>
      <p class="text-sm text-muted-foreground">Esta tela será entregue na Fase {{ item.fase }}.</p>
    </template>
    <template v-else>
      <h2 class="text-xl font-semibold">Página não encontrada</h2>
      <p class="text-sm text-muted-foreground">O endereço não existe ou foi movido.</p>
    </template>
    <UButton to="/dashboard" color="neutral" variant="outline" label="Voltar à visão geral" />
  </div>
</template>
