<script setup lang="ts">
definePageMeta({ titulo: 'Acesso negado' });
useHead({ title: 'Acesso negado — MetaBI' });
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
    <UIcon name="i-lucide-shield-alert" class="size-12 text-warning" aria-hidden="true" />
    <h2 class="text-xl font-semibold">Você não tem acesso a esta página</h2>
    <p class="text-sm text-muted-foreground">
      Se precisar dela, peça ao administrador para ajustar seu perfil.
    </p>
    <UButton to="/dashboard" label="Voltar à visão geral" />
  </div>
</template>
