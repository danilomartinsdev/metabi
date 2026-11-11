<script setup lang="ts">
const config = useRuntimeConfig()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const router = useRouter()
const { data: maintenance } = await useFetch<{ active: boolean, message: string }>('/api/maintenance')
const showAdminLogin = ref(false)
async function login() {
  loading.value = true; error.value = ''
  try { await $fetch('/api/auth/login', { method: 'POST', body: { email: email.value, password: password.value } }); await router.push('/dashboard') }
  catch (err: any) { error.value = err?.data?.message || 'Não foi possível entrar' }
  finally { loading.value = false }
}
</script>
<template>
  <main class="login-page">
    <section class="login-card">
      <img class="company-logo" :src="config.public.logoUrl" alt="Meta Hospitalar">
      <p class="eyebrow">META HOSPITALAR</p>
      <h1>BI Executivo</h1>
      <template v-if="maintenance?.active">
        <h2>🛠 Sistema em manutenção</h2>
        <p class="muted">{{ maintenance.message }}</p>
        <button v-if="!showAdminLogin" type="button" class="ghost-button" @click="showAdminLogin = true">Acesso administrativo</button>
      </template>
      <p v-else class="muted">Acompanhe vendas, pedidos e performance em um só lugar.</p>
      <form v-if="!maintenance?.active || showAdminLogin" @submit.prevent="login">
        <label>E-mail<input v-model="email" type="email" autocomplete="email" required></label>
        <label>Senha<input v-model="password" type="password" autocomplete="current-password" required></label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="primary-button" :disabled="loading">{{ loading ? 'Entrando...' : 'Entrar no painel' }}</button>
      </form>
    </section>
  </main>
</template>
