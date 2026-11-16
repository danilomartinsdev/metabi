<script setup lang="ts">
const config = useRuntimeConfig()
const router = useRouter()
async function logout() { await $fetch('/api/auth/logout', { method: 'POST' }); await router.push('/') }
</script>
<template>
  <header class="topbar">
    <div class="brand"><img class="company-logo small" :src="config.public.logoUrl" alt="Meta Hospitalar"><div><strong>META HOSPITALAR</strong><span>BI Executivo</span></div></div>
    <nav class="topnav"><NuxtLink to="/dashboard">Visão geral</NuxtLink><NuxtLink to="/clientes">Clientes</NuxtLink></nav>
    <div class="topbar-actions"><slot /><button class="ghost-button" @click="logout">Sair</button></div>
  </header>
</template>
