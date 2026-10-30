<script setup lang="ts">
const config = useRuntimeConfig()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const router = useRouter()
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
      <p class="muted">Acompanhe vendas, pedidos e performance em um só lugar.</p>
      <form @submit.prevent="login">
        <label>E-mail<input v-model="email" type="email" autocomplete="email" required></label>
        <label>Senha<input v-model="password" type="password" autocomplete="current-password" required></label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="primary-button" :disabled="loading">{{ loading ? 'Entrando...' : 'Entrar no painel' }}</button>
      </form>
    </section>
  </main>
</template>
