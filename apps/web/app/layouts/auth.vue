<script setup lang="ts">
// Login e telas de senha: cartão em duas colunas — formulário à esquerda, painel da marca à
// direita (só a partir de lg; no celular fica só o formulário).
const ano = new Date().getFullYear();

// Prévia ilustrativa do BI no painel (valores fictícios, só decoração).
const KPIS = [
  { rotulo: 'Total vendido', valor: 'R$ 6,0 mi' },
  { rotulo: 'Pedidos', valor: '65' },
  { rotulo: 'Ticket médio', valor: 'R$ 93 mil' },
  { rotulo: 'Meta', valor: '87%', destaque: true },
];
const BARRAS = [42, 55, 38, 61, 50, 72, 58, 80, 66, 70, 54, 76];
const RANKING = [92, 74, 61, 48];
</script>

<template>
  <div class="relative flex min-h-dvh items-center justify-center bg-background p-4 sm:p-8">
    <div class="absolute top-4 right-4 z-10"><LayoutThemeToggle /></div>

    <div
      class="grid w-full max-w-[1224px] overflow-hidden rounded-3xl border bg-card shadow-xl lg:min-h-[668px] lg:grid-cols-2 lg:p-3"
    >
      <!-- Formulário -->
      <div class="flex flex-col px-6 py-10 sm:px-12">
        <div class="flex justify-center">
          <!-- translate-x-1: ajuste óptico; o "meta" escuro pesa mais e a logo parecia puxada para a esquerda. -->
          <img
            src="/brand/logo-meta-hospitalar.webp"
            alt="Metahospitalar"
            class="h-12 w-auto translate-x-1 dark:brightness-0 dark:invert"
          />
        </div>
        <div class="mx-auto flex w-full max-w-[408px] flex-1 flex-col justify-center py-10 [&_input]:h-[42px] [&_input]:rounded-[10px]">
          <slot />
        </div>
        <p class="text-center text-xs text-muted-foreground">© {{ ano }} Meta Hospitalar · BI Comercial</p>
      </div>

      <!-- Painel da marca -->
      <aside
        class="relative hidden flex-col overflow-hidden rounded-2xl bg-linear-to-br from-primary-strong to-primary text-primary-foreground lg:flex"
      >
        <div class="px-11 pt-[52px]">
          <h2 class="max-w-lg text-[34px] leading-[1.2] font-semibold tracking-tight">
            Vendas, metas e faturamento num só lugar.
          </h2>
          <p class="mt-5 max-w-md text-[15px] leading-6 text-primary-foreground/80">
            Indicadores, rankings de representantes e curvas ABC a partir dos pedidos e notas do Focco — cada
            pessoa vendo só os dados que lhe cabem.
          </p>
        </div>

        <!-- Prévia do sistema (decorativa) -->
        <div
          class="mt-9 ml-9 flex flex-1 overflow-hidden rounded-tl-[22px] border-t-8 border-l-8 border-primary-foreground/15 bg-background text-foreground"
          aria-hidden="true"
        >
          <div class="w-24 shrink-0 bg-sidebar px-3 py-4">
            <img
              src="/brand/logo-meta-hospitalar.webp"
              alt=""
              class="mx-auto h-4 w-auto brightness-0 invert"
            />
            <div class="mt-5 h-5 rounded-md bg-sidebar-active" />
            <div v-for="n in 4" :key="n" class="mt-3 flex items-center gap-1.5">
              <span class="size-2 rounded-sm bg-sidebar-foreground/40" />
              <span class="h-1.5 rounded-full bg-sidebar-foreground/30" :class="n % 2 ? 'w-10' : 'w-7'" />
            </div>
          </div>
          <div class="min-w-0 flex-1 p-4">
            <p class="text-[9px] text-muted-foreground">Análise</p>
            <p class="text-sm font-semibold">Visão geral</p>
            <div class="mt-3 grid grid-cols-4 gap-2">
              <div v-for="k in KPIS" :key="k.rotulo" class="rounded-lg border bg-card px-2 py-1.5">
                <p class="truncate text-[8px] text-muted-foreground">{{ k.rotulo }}</p>
                <p class="num truncate text-xs font-semibold" :class="k.destaque && 'text-success'">
                  {{ k.valor }}
                </p>
              </div>
            </div>
            <div class="mt-2 rounded-lg border bg-card p-2.5">
              <p class="text-[8px] font-medium">Evolução mensal</p>
              <div class="mt-2 flex h-20 items-end gap-1.5">
                <span
                  v-for="(h, i) in BARRAS"
                  :key="i"
                  class="flex-1 rounded-t-sm bg-primary"
                  :style="{ height: `${h}%` }"
                />
              </div>
            </div>
            <div class="mt-2 space-y-1.5 rounded-lg border bg-card p-2.5">
              <p class="text-[8px] font-medium">Top representantes</p>
              <div v-for="(w, i) in RANKING" :key="i" class="flex items-center gap-2">
                <span class="h-1.5 w-8 shrink-0 rounded-full bg-muted-foreground/40" />
                <span class="h-1.5 rounded-full bg-primary/70" :style="{ width: `${w}%` }" />
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
