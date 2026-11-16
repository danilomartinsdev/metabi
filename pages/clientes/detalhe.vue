<script setup lang="ts">
import type { ClientDetail } from '~/types/order'
const route = useRoute()
const name = computed(() => String(route.query.nome || ''))
const { data, pending, error } = await useFetch<ClientDetail>('/api/client', { query: { name } })
if (error.value?.statusCode === 401) await navigateTo('/')
const money = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0)
const date = (v: string) => v ? new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR') : '-'
const monthLabel = (m: string) => /^\d{4}-\d{2}$/.test(m) ? new Date(`${m}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) : m
const max = (list?: { value: number }[]) => Math.max(...(list || []).map(x => x.value), 1)
</script>
<template>
  <div class="app-shell">
    <AppHeader />
    <main class="dashboard">
      <NuxtLink to="/clientes" class="back-link">← Todos os clientes</NuxtLink>
      <div v-if="pending" class="loading">Carregando cliente...</div>
      <p v-else-if="error" class="error">{{ error.statusMessage || error }}</p>
      <template v-else-if="data">
        <div class="heading"><div><p class="eyebrow">ANÁLISE INDIVIDUAL · {{ data.segments.map(s => s.name).join(' / ') }}</p><h1>{{ data.name }}</h1></div></div>
        <section class="kpis">
          <article><span>💰 FATURAMENTO</span><strong>{{ money(data.total) }}</strong><small>{{ data.orderCount }} pedidos</small></article>
          <article><span>◉ TICKET MÉDIO</span><strong>{{ money(data.averageTicket) }}</strong><small>Valor médio por pedido</small></article>
          <article><span>▣ PRIMEIRA COMPRA</span><strong>{{ date(data.firstOrder) }}</strong><small>Na base importada</small></article>
          <article><span>⌁ ÚLTIMA COMPRA</span><strong>{{ date(data.lastOrder) }}</strong><small>{{ data.states.map(s => s.name).join(', ') }}</small></article>
        </section>
        <section class="grid-two">
          <article class="panel"><div class="panel-title"><div><h2>Faturamento mensal</h2><p>Evolução do valor faturado</p></div></div>
            <div class="bars"><div v-for="m in data.monthly" :key="m.month" class="bar-row"><span>{{ monthLabel(m.month) }}</span><div class="bar-track"><i :style="{ width: `${m.value / max(data.monthly) * 100}%` }"></i></div><b>{{ money(m.value) }}</b></div></div>
          </article>
          <article class="panel"><div class="panel-title"><div><h2>Representantes</h2><p>Quem atende o cliente</p></div></div>
            <div class="bars"><div v-for="m in data.managers" :key="m.name" class="bar-row"><span>{{ m.name }}</span><div class="bar-track"><i :style="{ width: `${m.value / max(data.managers) * 100}%` }"></i></div><b>{{ money(m.value) }}</b></div></div>
          </article>
        </section>
        <section class="panel table-panel">
          <div class="panel-title"><div><h2>Pedidos do cliente</h2><p>{{ data.orderCount }} pedidos · {{ money(data.total) }}</p></div></div>
          <div class="table-wrap"><table>
            <thead><tr><th>EMISSÃO</th><th>ENTREGA</th><th>PEDIDO</th><th>UF</th><th>REPRESENTANTE</th><th>SEGMENTO</th><th>VALOR (R$)</th></tr></thead>
            <tbody><tr v-for="o in data.orders" :key="o.id"><td>{{ date(o.issueDate) }}</td><td>{{ date(o.deliveryDate) }}</td><td>{{ o.orderNumber }}</td><td>{{ o.uf }}</td><td>{{ o.manager }}</td><td>{{ o.segment }}</td><td class="value">{{ money(o.value) }}</td></tr></tbody>
          </table></div>
        </section>
      </template>
    </main>
  </div>
</template>
