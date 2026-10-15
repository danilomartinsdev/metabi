<script setup lang="ts">
const route = useRoute();
const titulo = computed(() => route.meta.titulo as string | undefined);
usePresenca();
</script>

<template>
  <a
    href="#conteudo"
    class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
  >
    Pular para o conteúdo
  </a>

  <UDashboardGroup storage="local" storage-key="meta-bi-sidebar" unit="rem">
    <UDashboardSidebar
      collapsible
      :default-size="16"
      :min-size="13"
      :max-size="20"
      :collapsed-size="4.5"
      :ui="{ root: 'hidden md:flex', content: 'md:hidden', overlay: 'md:hidden', body: 'p-0!' }"
    >
      <template #default="{ collapsed }">
        <LayoutAppSidebar :recolhida="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel :ui="{ body: 'gap-0 p-0 sm:gap-0 sm:p-0' }">
      <template #header>
        <UDashboardNavbar :title="titulo" :toggle="false" class="bg-background/85 backdrop-blur">
          <template #leading>
            <UDashboardSidebarCollapse
              aria-label="Recolher ou expandir menu lateral"
              class="hidden md:inline-flex"
            />
          </template>
          <template #right>
            <LayoutThemeToggle />
            <LayoutUserMenu />
          </template>
          <template #toggle>
            <UDashboardSidebarToggle aria-label="Abrir menu" class="md:hidden" />
          </template>
        </UDashboardNavbar>
      </template>

      <!-- Conteúdo no #body: um slot default substituiria header/body do painel. -->
      <template #body>
        <main id="conteudo" class="flex min-w-0 flex-1 flex-col px-4 pt-6 pb-20 md:px-8 md:pt-8">
          <slot />
        </main>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>

  <LayoutAparenciaFlutuante />
</template>
