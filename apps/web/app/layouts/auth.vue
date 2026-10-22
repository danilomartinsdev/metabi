<script setup lang="ts">
// Login e telas de senha, no padrão de login dos sistemas da Meta (docs/design/padrao-login.md):
// formulário à esquerda e painel da marca à direita (a partir de 768px; no celular só o formulário).
const ano = new Date().getFullYear();

// Miniatura ilustrativa do BI: formas e números fixos, sem dado real (a tela é pública).
const INDICADORES = [
  { rotulo: 'Vendido', valor: '6,0 mi', cor: '' },
  { rotulo: 'Pedidos', valor: '65', cor: '' },
  { rotulo: 'Ticket médio', valor: '93 mil', cor: '' },
  { rotulo: 'Meta', valor: '87%', cor: 'text-success' },
];
const BARRAS = [42, 58, 36, 64, 50, 72, 55, 80, 61, 68, 47, 76];
const MENU = [42, 36, 48, 30];
const LINHAS = [
  { largura: 'w-24', status: 'bg-success', barra: 'w-14 bg-success' },
  { largura: 'w-32', status: 'bg-primary', barra: 'w-10 bg-warning' },
  { largura: 'w-20', status: 'bg-success', barra: 'w-16 bg-success' },
];
</script>

<template>
  <div class="relative flex min-h-dvh items-center justify-center bg-background p-4 sm:p-8">
    <div class="absolute top-4 right-4 z-10"><LayoutThemeToggle /></div>

    <div
      class="grid w-full max-w-6xl gap-3 rounded-3xl bg-card p-3 shadow-xl md:min-h-[640px] md:grid-cols-2"
    >
      <section class="flex flex-col items-center px-4 pt-10 pb-6 sm:px-10">
        <!-- Nome do sistema e formulário num bloco só, centralizado na altura do cartão. -->
        <div class="flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <!-- Nome do sistema no estilo do logo, sem o símbolo (padrão "metasac"): "meta" escuro
               (branco no modo escuro) + "bi" no azul-claro do logo. O h1 de cada tela vem no slot. -->
          <p
            aria-hidden="true"
            class="text-center text-5xl leading-none font-bold tracking-tight select-none sm:text-6xl"
          >
            <span class="text-primary-strong dark:text-white">meta</span
            ><span class="text-sidebar-destaque">bi</span>
          </p>
          <div class="mt-8 w-full [&_input]:rounded-lg">
            <slot />
          </div>
        </div>
        <!-- No celular o painel some: o logo da empresa fica aqui (branco no modo escuro). -->
        <img
          src="/brand/logo-meta-hospitalar.webp"
          alt="Metahospitalar"
          class="mb-4 h-10 w-auto md:hidden dark:brightness-0 dark:invert"
        />
        <p class="text-xs text-muted-foreground">© {{ ano }} Metahospitalar · MetaBI</p>
      </section>

      <section
        aria-hidden="true"
        class="painel-login relative hidden flex-col overflow-hidden rounded-2xl px-10 pt-12 text-white md:flex"
      >
        <!-- Brilho decorativo no canto: azul-claro do logo a 25%. -->
        <div
          class="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-sidebar-destaque/25 blur-3xl"
        />
        <img
          src="/brand/logo-meta-hospitalar.webp"
          alt=""
          class="relative h-10 w-auto self-start brightness-0 invert"
        />
        <h2 class="relative mt-12 max-w-md text-3xl leading-tight font-semibold tracking-tight">
          Vendas, metas e faturamento num só lugar.
        </h2>
        <p class="relative mt-4 max-w-md text-sm leading-relaxed text-white/75">
          Indicadores, rankings de representantes e curvas ABC a partir dos pedidos e notas do Focco — cada
          pessoa vendo só os dados que lhe cabem.
        </p>

        <!-- Miniatura do sistema: posicionada dentro da área que sobra, encosta embaixo e é cortada
             ali. Assim a altura dela não estica o cartão além dos 640px. -->
        <div class="relative mt-10 min-h-48 flex-1">
          <div
            class="absolute inset-y-0 left-0 -right-16 flex overflow-hidden rounded-t-xl bg-card text-foreground shadow-2xl ring-8 ring-white/15"
          >
            <div class="flex w-24 shrink-0 flex-col gap-2.5 bg-sidebar p-3">
              <img
                src="/brand/logo-meta-hospitalar.webp"
                alt=""
                class="mb-2 h-4 w-auto self-center brightness-0 invert"
              />
              <span class="h-5 rounded-md bg-sidebar-active" />
              <span v-for="w in MENU" :key="w" class="flex items-center gap-1.5 px-1.5">
                <span class="size-2 rounded-xs bg-sidebar-muted/60" />
                <span class="h-1.5 rounded-full bg-sidebar-muted/40" :style="{ width: `${w}px` }" />
              </span>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-3 bg-background p-4">
              <div>
                <p class="text-[9px] text-muted-foreground">Análise</p>
                <p class="text-sm font-semibold">Visão geral</p>
              </div>
              <div class="grid grid-cols-4 gap-2">
                <div v-for="k in INDICADORES" :key="k.rotulo" class="rounded-md border bg-card px-2 py-1.5">
                  <p class="truncate text-[8px] text-muted-foreground">{{ k.rotulo }}</p>
                  <p class="num truncate text-base font-semibold" :class="k.cor">{{ k.valor }}</p>
                </div>
              </div>
              <div class="rounded-md border bg-card p-2.5">
                <p class="text-[9px] font-semibold">Vendas por mês</p>
                <div class="mt-2 flex h-16 items-end gap-1.5">
                  <span
                    v-for="(h, i) in BARRAS"
                    :key="i"
                    class="flex-1 rounded-t-[2px] bg-primary"
                    :style="{ height: `${h}%` }"
                  />
                </div>
              </div>
              <div class="flex flex-col rounded-md border bg-card">
                <div
                  v-for="(l, i) in LINHAS"
                  :key="i"
                  class="flex items-center gap-3 border-b px-2.5 py-2 last:border-b-0"
                >
                  <span class="flex flex-col gap-1">
                    <span class="h-1.5 w-12 rounded-full bg-foreground/70" />
                    <span class="h-1.5 rounded-full bg-muted-foreground/35" :class="l.largura" />
                  </span>
                  <span class="ml-auto size-1.5 rounded-full" :class="l.status" />
                  <span class="h-1 rounded-full" :class="l.barra" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
