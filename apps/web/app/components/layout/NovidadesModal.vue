<script setup lang="ts">
import type { Novidade } from '~/utils/novidades';

const aberto = defineModel<boolean>('aberto', { required: true });
defineProps<{ novidades: Novidade[]; naoVistas: Novidade[] }>();
const emit = defineEmits<{ vistas: [] }>();

// Fechar (ou seguir um link) marca tudo como visto.
watch(aberto, (v, antes) => {
  if (antes && !v) emit('vistas');
});
</script>

<template>
  <UModal v-model:open="aberto" title="Novidades" description="O que mudou no sistema.">
    <template #body>
      <p v-if="!novidades.length" class="py-6 text-center text-sm text-muted-foreground">
        Nenhuma novidade por enquanto.
      </p>
      <ol v-else class="space-y-3">
        <li
          v-for="n in novidades"
          :key="n.id"
          class="rounded-lg border p-4"
          :class="naoVistas.some((x) => x.id === n.id) ? 'border-primary/60 bg-primary-soft/40' : ''"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-medium">{{ n.titulo }}</h3>
            <div class="flex items-center gap-2">
              <UBadge
                v-if="naoVistas.some((x) => x.id === n.id)"
                color="primary"
                variant="soft"
                size="sm"
                label="Nova"
              />
              <span class="text-xs text-muted-foreground">{{ formatDate(n.data) }}</span>
            </div>
          </div>
          <p class="mt-1.5 text-sm text-muted-foreground">{{ n.texto }}</p>
          <UButton
            v-if="n.para"
            :to="n.para"
            size="xs"
            variant="link"
            trailing-icon="i-lucide-arrow-right"
            label="Abrir"
            class="mt-1 -ml-2.5"
            @click="aberto = false"
          />
        </li>
      </ol>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton label="Entendi" @click="aberto = false" />
      </div>
    </template>
  </UModal>
</template>
