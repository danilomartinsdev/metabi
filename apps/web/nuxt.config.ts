import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:4318';

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  // Permite um segundo servidor (E2E) rodar junto com o de dev sem disputar a pasta .nuxt.
  buildDir: process.env.NUXT_BUILD_DIR ?? '.nuxt',
  devtools: { enabled: false },
  // Rótulo do ambiente (ex.: "homologacao"), lido de NUXT_PUBLIC_AMBIENTE no build; vazio em produção.
  runtimeConfig: { public: { ambiente: '' } },
  modules: ['@nuxt/ui', '@pinia/nuxt'],
  colorMode: { storageKey: 'metabi-tema', classSuffix: '' },
  // Ícones usados no código (i-lucide-*) entram no bundle: nada de buscar na API do Iconify em produção
  // (a CSP só permite conexões ao próprio site).
  // .ts entra na varredura: os ícones do menu ficam em components/layout/nav.ts (o padrão só lê .vue/.tsx/...).
  icon: {
    clientBundle: { scan: { globInclude: ['**/*.{vue,ts,tsx}'] } },
    serverBundle: 'local',
  },
  css: ['~/assets/css/main.css'],
  // Usa o código-fonte do pacote compartilhado (sem depender do build em dist/ durante o dev).
  alias: { '@metabi/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) },
  vite: {
    plugins: [tailwindcss()],
    // Pré-empacota no início do dev o que o Vite descobriria navegando — senão cada descoberta
    // recarrega a página inteira e o app parece lento.
    optimizeDeps: {
      include: [
        '@tanstack/vue-query',
        '@vueuse/core',
        'zod',
        'vue-echarts',
        'echarts/core',
        'echarts/charts',
        'echarts/components',
        'echarts/renderers',
      ],
    },
    // O servidor do E2E (outro buildDir) usa cache próprio para não invalidar o do dev.
    ...(process.env.NUXT_BUILD_DIR ? { cacheDir: 'node_modules/.cache/vite-e2e' } : {}),
  },
  fonts: { families: [{ name: 'Inter', provider: 'google', weights: [400, 500, 600] }] },
  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'MetaBI',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [{ rel: 'icon', type: 'image/png', href: '/brand/icone-meta.png' }],
    },
  },
  // Em dev, /api é repassado à API Nest (em produção quem faz isso é o Caddy).
  nitro: { devProxy: { '/api': { target: `${apiTarget}/api`, changeOrigin: true } } },
  typescript: { strict: true },
});
