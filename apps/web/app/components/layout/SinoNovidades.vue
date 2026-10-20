<script setup lang="ts">
/**
 * Sino de Novidades. Fica no topo do menu lateral (ao lado do logo) ou, com o menu recolhido
 * e no celular, na barra do topo — o layout renderiza só um por vez.
 */
const props = defineProps<{ noMenu?: boolean }>();

const aberto = useState('novidades-abertas', () => false);
// Abre sozinho uma vez por sessão, se houver novidade ainda não vista.
const jaAbriuSozinho = useState('novidades-auto', () => false);
const { visiveis, naoVistas, marcarVistas } = useNovidades();

onMounted(() => {
  if (!jaAbriuSozinho.value && naoVistas.value.length) aberto.value = true;
  jaAbriuSozinho.value = true;
});
watch(aberto, (v, antes) => {
  if (antes && !v) marcarVistas();
});

// O popover não fecha com clique fora (como o antigo cartão); Esc e os botões fecham.
function aoTeclar(e: KeyboardEvent) {
  if (e.key === 'Escape' && aberto.value) aberto.value = false;
}
onMounted(() => window.addEventListener('keydown', aoTeclar));
onBeforeUnmount(() => window.removeEventListener('keydown', aoTeclar));

const classeBotao = computed(() =>
  props.noMenu
    ? 'text-sidebar-foreground/75 hover:bg-sidebar-active/60 hover:text-sidebar-foreground'
    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
);
</script>

<template>
  <UPopover
    v-model:open="aberto"
    :dismissible="false"
    :content="
      noMenu
        ? { side: 'right', align: 'start', sideOffset: 12 }
        : { side: 'bottom', align: 'end', sideOffset: 8 }
    "
  >
    <button
      type="button"
      data-tour="novidades"
      class="grid size-8 place-items-center rounded-md transition-colors"
      :class="classeBotao"
      aria-label="Novidades do sistema"
      title="Novidades do sistema"
    >
      <UChip :show="naoVistas.length > 0" color="warning" size="sm" position="top-right" inset>
        <UIcon name="i-lucide-bell" class="size-[18px]" />
      </UChip>
    </button>

    <template #content>
      <LayoutNovidadesCartao :novidades="visiveis" :nao-vistas="naoVistas" @fechar="aberto = false" />
    </template>
  </UPopover>
</template>
