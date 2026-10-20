<script setup lang="ts">
// Faixa de ambiente: só aparece quando o build define NUXT_PUBLIC_AMBIENTE (homologação).
// Produção é gerada sem ele e não muda. Fica fixa (não empurra o layout) e não captura cliques.
const ambiente = useRuntimeConfig().public.ambiente as string;

useHead(ambiente ? { titleTemplate: (t?: string) => `[HOMOLOG] ${t ?? 'MetaBI'}` } : {});
</script>

<template>
  <div v-if="ambiente" class="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center">
    <div class="absolute inset-x-0 top-0 h-1 bg-warning" />
    <p
      role="status"
      class="rounded-b-lg bg-warning px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary-strong"
    >
      Homologação · dados copiados da produção — alterações aqui não valem
    </p>
  </div>
</template>
