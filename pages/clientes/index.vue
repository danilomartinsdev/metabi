<script setup lang="ts">
import type { ClientSummary } from '~/types/order'
const { data, pending, error } = await useFetch<{ clients: ClientSummary[] }>('/api/clients')
if (error.value?.statusCode === 401) await navigateTo('/')
const search = ref('')
const segment = ref('')
const money = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0)
const date = (v: string) => v ? new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR') : '-'
const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (data.value?.clients || []).filter(c => (!term || c.name.toLowerCase().includes(term)) && (!segment.value || c.segment === segment.value))
})
const total = computed(() => filtered.value.reduce((s, c) => s + c.value, 0))
</script>
<template>
  <div class="app-shell">
    <AppHeader />
    <main class="dashboard">
      <div class="heading"><div><p class="eyebrow">ANÁLISE INDIVIDUAL</p><h1>Clientes</h1></div></div>
      <section class="filters client-filters">
        <label class="search">BUSCAR CLIENTE<input v-model="search" placeholder="Nome do cliente..."></label>
        <label>SEGMENTO<select v-model="segment"><option value="">Todos</option><option>Público</option><option>Privado</option><option>Misto</option></select></label>
      </section>
      <div v-if="pending" class="loading">Carregando clientes...</div>
      <p v-else-if="error" class="error">{{ error.statusMessage || error }}</p>
      <section v-else class="panel table-panel">
        <div class="panel-title"><div><h2>Faturamento por cliente</h2><p>{{ filtered.length }} clientes · {{ money(total) }}. Clique no cliente para ver a análise individual.</p></div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>CLIENTE</th><th>SEGMENTO</th><th>PEDIDOS</th><th>ÚLTIMA COMPRA</th><th>FATURAMENTO (R$)</th></tr></thead>
          <tbody><tr v-for="c in filtered.slice(0, 300)" :key="c.name">
            <td><NuxtLink class="link" :to="{ path: '/clientes/detalhe', query: { nome: c.name } }">{{ c.name }}</NuxtLink></td>
            <td>{{ c.segment }}</td><td>{{ c.orders }}</td><td>{{ date(c.lastOrder) }}</td><td class="value">{{ money(c.value) }}</td>
          </tr></tbody>
        </table></div>
        <p v-if="filtered.length > 300" class="muted">Mostrando 300 de {{ filtered.length }}. Refine a busca.</p>
      </section>
    </main>
  </div>
</template>
