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

    <div class="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      <div v-for="g in grupos" :key="g.titulo">
        <p
          v-if="!recolhida"
          class="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted"
        >
          {{ g.titulo }}
        </p>
        <ul class="space-y-0.5">
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
                class="flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-sidebar-active"
                :class="[
                  ativo(item.to)
                    ? 'bg-sidebar-active font-medium text-sidebar-foreground'
                    : 'text-sidebar-foreground/85',
                  recolhida && 'justify-center px-0',
                ]"
                @click="emit('navegou')"
              >
                <UIcon :name="item.icon" class="size-[18px] shrink-0" aria-hidden="true" />
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

    <div class="shrink-0 border-t border-sidebar-border px-3 py-3">
      <UTooltip text="Sair" :content="{ side: 'right' }" :delay-duration="0" :disabled="!recolhida">
        <button
          type="button"
          class="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-active"
          :class="recolhida && 'justify-center px-0'"
          :aria-label="recolhida ? 'Sair' : undefined"
          @click="auth.logout()"
        >
          <UIcon name="i-lucide-log-out" class="size-[18px] shrink-0" aria-hidden="true" />
          <span v-if="!recolhida" class="flex-1 truncate text-left">Sair</span>
        </button>
      </UTooltip>
    </div>
  </nav>
</template>
