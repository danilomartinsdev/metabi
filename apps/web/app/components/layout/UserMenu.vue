<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

const auth = useAuthStore();
const router = useRouter();
const paletaAberta = ref(false);
const novidadesAbertas = ref(false);
const { visiveis, naoVistas, marcarVistas } = useNovidades();
// Abre sozinho uma vez, ao entrar, se houver novidade ainda não vista.
onMounted(() => {
  if (naoVistas.value.length) novidadesAbertas.value = true;
});

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
      label: 'Novidades',
      icon: 'i-lucide-sparkles',
      ...(naoVistas.value.length
        ? { trailingIcon: 'i-lucide-dot', ui: { itemTrailingIcon: 'text-primary size-6' } }
        : {}),
      onSelect: () => (novidadesAbertas.value = true),
    },
    {
      label: 'Cores dos gráficos',
      icon: 'i-lucide-palette',
      onSelect: () => (paletaAberta.value = true),
    },
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
  <UDropdownMenu :items="itens" :ui="{ content: 'w-60' }">
    <button
      type="button"
      aria-label="Menu do usuário"
      class="flex items-center gap-3 rounded-lg p-1 pr-2 text-left hover:bg-accent focus-visible:outline-2"
    >
      <UChip :show="naoVistas.length > 0" color="primary" size="md" position="top-right" inset>
        <UAvatar
        :text="iniciais"
        :alt="auth.usuario?.nome"
        size="md"
        :ui="{ root: 'bg-primary-soft', fallback: 'text-xs font-semibold text-primary' }"
        />
      </UChip>
      <span class="hidden leading-tight md:block">
        <span class="block text-sm font-medium">{{ auth.usuario?.nome }}</span>
        <span class="block truncate text-xs text-muted-foreground">{{ auth.usuario?.papel.nome }}</span>
      </span>
    </button>
  </UDropdownMenu>
  <LayoutPaletaGraficosModal v-model:aberto="paletaAberta" />
  <LayoutNovidadesModal
    v-model:aberto="novidadesAbertas"
    :novidades="visiveis"
    :nao-vistas="naoVistas"
    @vistas="marcarVistas"
  />
</template>
