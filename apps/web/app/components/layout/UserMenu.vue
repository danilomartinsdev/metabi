<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

/** No rodapé do menu lateral; recolhida = menu só com ícones (mostra só o avatar). */
defineProps<{ recolhida?: boolean }>();

const auth = useAuthStore();
const router = useRouter();

const iniciais = computed(() =>
  (auth.usuario?.nome ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join(''),
);

const itens = computed<DropdownMenuItem[][]>(() => [
  [
    { type: 'label', label: auth.usuario?.nome ?? '?', class: 'font-normal' },
    {
      type: 'label',
      label: auth.usuario?.email ?? '',
      class: '-mt-2 truncate text-xs font-normal text-muted-foreground',
    },
  ],
  [
    {
      label: 'Trocar senha',
      icon: 'i-lucide-key-round',
      onSelect: () => router.push('/trocar-senha'),
    },
    {
      label: 'Sair',
      icon: 'i-lucide-log-out',
      onSelect: () => auth.logout(),
    },
  ],
]);
</script>

<template>
  <UDropdownMenu
    :items="itens"
    :content="{ side: recolhida ? 'right' : 'top', align: recolhida ? 'end' : 'start' }"
    :ui="{ content: 'w-60' }"
  >
    <button
      type="button"
      aria-label="Menu do usuário"
      class="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-active/60 focus-visible:outline-2"
      :class="recolhida && 'justify-center'"
    >
      <UAvatar
          :text="iniciais"
          :alt="auth.usuario?.nome"
          size="sm"
          :ui="{ root: 'bg-sidebar-active', fallback: 'text-[11px] font-semibold text-sidebar-foreground' }"
        />
      <template v-if="!recolhida">
        <span class="min-w-0 flex-1 leading-tight">
          <span class="block truncate text-[13px] font-medium">{{ auth.usuario?.nome }}</span>
          <span class="block truncate text-[11px] text-sidebar-muted">{{ auth.usuario?.papel.nome }}</span>
        </span>
        <UIcon name="i-lucide-chevrons-up-down" class="size-3.5 shrink-0 text-sidebar-muted" aria-hidden="true" />
      </template>
    </button>
  </UDropdownMenu>
</template>
