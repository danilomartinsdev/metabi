<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { itemAtivo, paginaInicial } from '~/utils/navegacao';
import { NAV } from './nav';

defineProps<{ recolhida?: boolean }>();
const emit = defineEmits<{ navegou: [] }>();

const can = useCan();
const route = useRoute();
const auth = useAuthStore();
const inicio = computed(() => paginaInicial(auth.usuario));

const grupos = computed(() =>
  NAV.map((g) => ({
    ...g,
    itens: g.itens.filter((i) => can(i.permissao)),
  })).filter((g) => g.itens.length),
);

const destinoAtivo = computed(() =>
  itemAtivo(
    route.path,
    grupos.value.flatMap((g) => g.itens.map((i) => i.to)),
  ),
);
const ativo = (to: string) => to === destinoAtivo.value;

// Grupos recolhíveis (Administração): fechados por padrão, lembrados por navegador.
// O grupo da tela atual sempre aparece aberto.
const CHAVE_ABERTOS = 'meta-bi:menu-grupos-abertos';
const abertos = ref<string[]>([]);
onMounted(() => {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_ABERTOS) ?? '[]');
    if (Array.isArray(salvo)) abertos.value = salvo.filter((t) => typeof t === 'string');
  } catch {
    // sem armazenamento: fica tudo fechado
  }
});
const grupoAtivo = computed(
  () => grupos.value.find((g) => g.itens.some((i) => ativo(i.to)))?.titulo,
);
const aberto = (titulo: string) => abertos.value.includes(titulo) || grupoAtivo.value === titulo;
function alternar(titulo: string) {
  const abrir = !aberto(titulo);
  abertos.value = abrir ? [...abertos.value, titulo] : abertos.value.filter((t) => t !== titulo);
  try {
    localStorage.setItem(CHAVE_ABERTOS, JSON.stringify(abertos.value));
  } catch {
    // ignora
  }
}
</script>

<template>
  <nav
    aria-label="Navegação principal"
    class="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground"
  >
    <NuxtLink
      :to="inicio"
      class="flex h-16 shrink-0 items-center justify-center gap-3 border-b border-sidebar-border"
      :class="recolhida ? 'px-2' : 'px-4'"
      @click="emit('navegou')"
    >
      <img
        v-if="recolhida"
        src="/brand/icone-meta-recortado.png"
        alt="Metahospitalar"
        class="h-3.5 w-auto shrink-0 brightness-0 invert"
      />
      <img
        v-else
        src="/brand/logo-meta-hospitalar.webp"
        alt="Metahospitalar"
        class="h-8 w-auto brightness-0 invert"
      />
    </NuxtLink>

    <div class="scroll-discreto flex-1 space-y-5 overflow-y-auto px-3 py-4">
      <div v-for="g in grupos" :key="g.titulo">
        <button
          v-if="!recolhida && g.recolhivel"
          type="button"
          class="mb-1.5 flex w-full items-center justify-between rounded-md px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-sidebar-muted/80 transition-colors hover:text-sidebar-foreground"
          :aria-expanded="aberto(g.titulo)"
          :aria-controls="`menu-grupo-${g.titulo}`"
          @click="alternar(g.titulo)"
        >
          {{ g.titulo }}
          <UIcon
            name="i-lucide-chevron-right"
            class="size-3.5 transition-transform duration-200"
            :class="aberto(g.titulo) && 'rotate-90'"
            aria-hidden="true"
          />
        </button>
        <p
          v-else-if="!recolhida"
          class="mb-1.5 px-3 text-[10.5px] font-medium uppercase tracking-[0.08em] text-sidebar-muted/80"
        >
          {{ g.titulo }}
        </p>
        <ul
          v-show="recolhida || !g.recolhivel || aberto(g.titulo)"
          :id="`menu-grupo-${g.titulo}`"
          class="space-y-0.5"
        >
          <li v-for="item in g.itens" :key="item.to">
            <UTooltip
              :text="item.label"
              :content="{ side: 'right' }"
              :delay-duration="0"
              :disabled="!recolhida"
            >
              <NuxtLink
                :to="item.to"
                :aria-current="ativo(item.to) ? 'page' : undefined"
                class="relative flex h-9 items-center gap-2.5 rounded-md px-3 text-[13px] transition-colors duration-150 hover:bg-sidebar-active/60 hover:text-sidebar-foreground"
                :class="[
                  ativo(item.to)
                    ? 'bg-sidebar-active font-medium text-sidebar-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-foreground/70'
                    : 'text-sidebar-foreground/70',
                  recolhida && 'justify-center px-0',
                ]"
                @click="emit('navegou')"
              >
                <UIcon
                  :name="item.icon"
                  class="size-4 shrink-0"
                  :class="ativo(item.to) ? 'opacity-100' : 'opacity-75'"
                  aria-hidden="true"
                />
                <span v-if="!recolhida" class="flex-1 truncate">{{ item.label }}</span>
                <span
                  v-if="!recolhida && item.fase"
                  class="rounded-full bg-sidebar-active px-2 py-0.5 text-[10px] text-sidebar-muted"
                >
                  em breve
                </span>
              </NuxtLink>
            </UTooltip>
          </li>
        </ul>
      </div>
    </div>

    <div class="shrink-0 border-t border-sidebar-border px-3 py-2">
      <UTooltip text="Sair" :content="{ side: 'right' }" :delay-duration="0" :disabled="!recolhida">
        <button
          type="button"
          class="flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-[13px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-active/60 hover:text-sidebar-foreground"
          :class="recolhida && 'justify-center px-0'"
          :aria-label="recolhida ? 'Sair' : undefined"
          @click="auth.logout()"
        >
          <UIcon name="i-lucide-log-out" class="size-4 shrink-0 opacity-75" aria-hidden="true" />
          <span v-if="!recolhida" class="flex-1 truncate text-left">Sair</span>
        </button>
      </UTooltip>
    </div>
  </nav>
</template>
