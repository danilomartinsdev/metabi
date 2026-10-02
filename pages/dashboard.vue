<script setup lang="ts">
import type { DashboardData } from '~/types/order'
const config = useRuntimeConfig()
const router = useRouter()
const filters = reactive({ region: '', uf: '', manager: '', segment: '', search: '' })
const { data, pending, error, refresh } = await useFetch<DashboardData>('/api/dashboard', { query: filters, watch: [filters] })
const file = ref<File | null>(null)
const importing = ref(false)
const message = ref('')
const money = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0)
const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`
const date = (v: string) => v ? new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR') : '-'
const maxRegion = computed(() => Math.max(...(data.value?.regions || []).map(x => x.value), 1))
const maxManager = computed(() => Math.max(...(data.value?.managers || []).map(x => x.value), 1))
const regions = computed(() => data.value?.regions || [])
const managers = computed(() => data.value?.managers || [])
const ufs = computed(() => [...new Set((data.value?.states || []).map(x => x.name))].sort())
async function logout() { await $fetch('/api/auth/logout', { method: 'POST' }); await router.push('/') }
async function importFile() {
  if (!file.value) return
  importing.value = true; message.value = ''
  const body = new FormData(); body.append('file', file.value)
  try { const result = await $fetch<{ imported: number }>('/api/import', { method: 'POST', body }); message.value = `${result.imported} pedidos importados com sucesso`; await refresh() }
  catch (err: any) { message.value = err?.data?.message || 'Falha ao importar arquivo' }
  finally { importing.value = false }
}
</script>
<template>
  <div class="app-shell">
    <header class="topbar"><div class="brand"><img class="company-logo small" :src="config.public.logoUrl" alt="Meta Hospitalar"><div><strong>META HOSPITALAR</strong><span>BI Executivo</span></div></div><div class="topbar-actions"><span class="updated"><i></i> Dados atualizados</span><button class="ghost-button" @click="logout">Sair</button></div></header>
    <main class="dashboard">
      <div class="heading"><div><p class="eyebrow">PAINEL EXECUTIVO</p><h1>Visão geral</h1></div><label class="import-button">＋ Importar Excel<input type="file" accept=".xls,.xlsx" @change="file = ($event.target as HTMLInputElement).files?.[0] || null"></label><button v-if="file" class="primary-button compact" @click="importFile">{{ importing ? 'Importando...' : 'Confirmar importação' }}</button></div>
      <p v-if="message" class="notice">{{ message }}</p>
      <section class="filters"><label>REGIÃO<select v-model="filters.region"><option value="">Todas</option><option v-for="item in regions" :key="item.name">{{ item.name }}</option></select></label><label>UF<select v-model="filters.uf"><option value="">Todas</option><option v-for="uf in ufs" :key="uf">{{ uf }}</option></select></label><label>GESTOR<select v-model="filters.manager"><option value="">Todos</option><option v-for="item in managers" :key="item.name">{{ item.name }}</option></select></label><label>SEGMENTO<select v-model="filters.segment"><option value="">Todos</option><option>Público</option><option>Privado</option></select></label><label class="search">BUSCA<input v-model="filters.search" placeholder="Cliente, pedido, gestor..."></label><button class="clear" @click="Object.assign(filters, { region: '', uf: '', manager: '', segment: '', search: '' })">× Limpar</button></section>
      <div v-if="pending" class="loading">Carregando indicadores...</div>
      <p v-else-if="error" class="error">{{ error }}</p>
      <template v-else-if="data">
        <section class="kpis"><article><span>💰 TOTAL VENDIDO</span><strong>{{ money(data.total) }}</strong><small>{{ data.orderCount }} pedidos no período</small></article><article><span>▣ QTD PEDIDOS</span><strong>{{ data.orderCount }}</strong><small>Pedidos importados</small></article><article><span>◉ TICKET MÉDIO</span><strong>{{ money(data.averageTicket) }}</strong><small>Valor médio por pedido</small></article><article><span>⌁ REGIÕES ATIVAS</span><strong>{{ data.regions.length }}</strong><small>{{ data.states.length }} estados atendidos</small></article></section>
        <section class="grid-two"><article class="panel"><div class="panel-title"><div><h2>Vendas por região</h2><p>Distribuição do valor vendido</p></div></div><div class="bars"><div v-for="item in regions" :key="item.name" class="bar-row"><span>{{ item.name }}</span><div class="bar-track"><i :style="{ width: `${item.value / maxRegion * 100}%` }"></i></div><b>{{ money(item.value) }}</b></div></div></article><article class="panel"><div class="panel-title"><div><h2>Top 10 gestores</h2><p>Ranking por valor vendido</p></div></div><div class="bars"><div v-for="item in managers" :key="item.name" class="bar-row"><span>{{ item.name }}</span><div class="bar-track"><i :style="{ width: `${item.value / maxManager * 100}%` }"></i></div><b>{{ money(item.value) }}</b></div></div></article></section>
        <section class="panel table-panel"><div class="panel-title"><div><h2>Base de pedidos</h2><p>{{ data.orderCount }} pedidos encontrados · {{ money(data.total) }}</p></div></div><div class="table-wrap"><table><thead><tr><th>EMISSÃO</th><th>PEDIDO</th><th>CLIENTE</th><th>UF</th><th>REGIÃO</th><th>GESTOR</th><th>VALOR (R$)</th></tr></thead><tbody><tr v-for="order in data.orders.slice(0, 50)" :key="order.id"><td>{{ date(order.issueDate) }}</td><td>{{ order.orderNumber }}</td><td>{{ order.client }}</td><td>{{ order.uf }}</td><td>{{ order.region }}</td><td>{{ order.manager }}</td><td class="value">{{ money(order.value) }}</td></tr></tbody></table></div></section>
      </template>
    </main>
  </div>
</template>
