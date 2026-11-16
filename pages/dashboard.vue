<script setup lang="ts">
import type { DashboardData, RepresentativeSummary, Segment } from '~/types/order'
const filters = reactive({ region: '', uf: '', manager: '', segment: '', search: '' })
const { data, pending, error, refresh } = await useFetch<DashboardData>('/api/dashboard', { query: filters, watch: [filters] })
if (error.value?.statusCode === 401) await navigateTo('/')
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
const clients = computed(() => data.value?.clients || [])
const maxSegment = computed(() => Math.max(...(data.value?.segments || []).map(x => x.value), 1))
const maxClient = computed(() => Math.max(...clients.value.map(x => x.value), 1))
const ufs = computed(() => [...new Set((data.value?.states || []).map(x => x.name))].sort())
const { data: repsData, refresh: refreshReps } = await useFetch<{ representatives: RepresentativeSummary[] }>('/api/representatives')
const representatives = computed(() => repsData.value?.representatives || [])
const repCounts = computed(() => ({ public: representatives.value.filter(r => r.segment === 'Público').length, private: representatives.value.filter(r => r.segment === 'Privado').length }))
const newRep = reactive<{ name: string, segment: Segment }>({ name: '', segment: 'Privado' })
const savingRep = ref(false)
async function saveRep(name: string, segment: Segment, isNew = false) {
  savingRep.value = true; message.value = ''
  try {
    const result = await $fetch<{ name: string, created: boolean }>('/api/admin/representatives', { method: 'POST', body: { name, segment } })
    message.value = isNew && !result.created ? `${result.name} já existia: segmento atualizado para ${segment}` : `${result.name} ${result.created ? 'cadastrado' : 'atualizado'} como ${segment}`
    if (isNew) newRep.name = ''
    await Promise.all([refreshReps(), refresh()])
  } catch (err: any) { message.value = err?.data?.message || 'Falha ao salvar representante' }
  finally { savingRep.value = false }
}
async function removeRep(name: string) {
  if (!confirm(`Remover o cadastro de ${name}?`)) return
  message.value = ''
  try { await $fetch('/api/admin/representatives', { method: 'DELETE', query: { name } }); message.value = `${name} removido`; await refreshReps() }
  catch (err: any) { message.value = err?.data?.message || 'Falha ao remover representante' }
}
const { data: maintenance, refresh: refreshMaintenance } = await useFetch<{ active: boolean, message: string }>('/api/maintenance')
const maintenanceMessage = ref(maintenance.value?.message || '')
const togglingMaintenance = ref(false)
async function toggleMaintenance() {
  const next = !maintenance.value?.active
  if (!confirm(next ? 'Ativar modo manutenção? Visitantes verão a tela de manutenção; só administradores continuam acessando.' : 'Desativar modo manutenção e liberar o sistema?')) return
  togglingMaintenance.value = true; message.value = ''
  try {
    await $fetch('/api/admin/maintenance', { method: 'POST', body: { active: next, message: maintenanceMessage.value } })
    await refreshMaintenance()
    message.value = next ? 'Modo manutenção ATIVADO' : 'Modo manutenção desativado'
  } catch (err: any) { message.value = err?.data?.message || 'Falha ao alterar modo manutenção' }
  finally { togglingMaintenance.value = false }
}
const adminOpen = ref(true)
const selectedYears = ref<string[]>([])
const clearing = ref(false)
const { data: yearsData, refresh: refreshYears } = await useFetch<{ years: { year: string, count: number, total: number }[], total: number }>('/api/admin/years')
async function clearData(all: boolean) {
  const years = selectedYears.value
  if (!all && !years.length) return
  const text = all ? 'Isso apagará TODAS as importações e zerará o BI. Continuar?' : `Apagar os pedidos de ${years.join(', ')}? Esta ação não pode ser desfeita.`
  if (!confirm(text)) return
  clearing.value = true; message.value = ''
  try {
    const result = await $fetch<{ removed: number }>('/api/admin/clear', { method: 'POST', body: all ? { all: true } : { years } })
    message.value = `${result.removed} pedidos removidos`
    selectedYears.value = []
    await Promise.all([refresh(), refreshYears()])
  } catch (err: any) { message.value = err?.data?.message || 'Falha ao limpar dados' }
  finally { clearing.value = false }
}
async function importFile() {
  if (!file.value) return
  importing.value = true; message.value = ''
  const body = new FormData(); body.append('file', file.value)
  try { const result = await $fetch<{ imported: number }>('/api/import', { method: 'POST', body }); message.value = `${result.imported} pedidos importados com sucesso`; await Promise.all([refresh(), refreshYears(), refreshReps()]) }
  catch (err: any) { message.value = err?.data?.message || 'Falha ao importar arquivo' }
  finally { importing.value = false }
}
</script>
<template>
  <div class="app-shell">
    <AppHeader><span v-if="maintenance?.active" class="updated"><i></i> EM MANUTENÇÃO</span><span v-else class="updated"><i></i> Dados atualizados</span></AppHeader>
    <main class="dashboard">
      <div class="heading"><div><p class="eyebrow">PAINEL EXECUTIVO</p><h1>Visão geral</h1></div><label class="import-button">＋ Importar Excel<input type="file" accept=".xls,.xlsx" @change="file = ($event.target as HTMLInputElement).files?.[0] || null"></label><button v-if="file" class="primary-button compact" @click="importFile">{{ importing ? 'Importando...' : 'Confirmar importação' }}</button></div>
      <p v-if="message" class="notice">{{ message }}</p>
      <section class="panel admin-panel">
        <div class="panel-title"><div><h2>Administração · Importações</h2><p>{{ yearsData?.total || 0 }} pedidos na base</p></div><button class="ghost-button" @click="adminOpen = !adminOpen">{{ adminOpen ? 'Fechar' : 'Gerenciar' }}</button></div>
        <div v-if="adminOpen">
          <div class="maintenance-box" :class="{ on: maintenance?.active }">
            <strong>Modo manutenção: {{ maintenance?.active ? 'ATIVO' : 'desligado' }}</strong>
            <input v-model="maintenanceMessage" maxlength="300" placeholder="Mensagem exibida aos visitantes (opcional)">
            <button class="ghost-button" :class="{ danger: !maintenance?.active }" :disabled="togglingMaintenance" @click="toggleMaintenance">{{ maintenance?.active ? 'Desativar manutenção' : 'Ativar manutenção' }}</button>
          </div>
          <p v-if="!yearsData?.years.length">Nenhuma importação na base.</p>
          <div v-else class="admin-years">
            <label v-for="y in yearsData.years" :key="y.year" class="admin-year"><input v-model="selectedYears" type="checkbox" :value="y.year"> <b>{{ y.year }}</b> · {{ y.count }} pedidos · {{ money(y.total) }}</label>
          </div>
          <div class="admin-actions">
            <button class="ghost-button" :disabled="!selectedYears.length || clearing" @click="clearData(false)">Apagar anos selecionados</button>
            <button class="ghost-button danger" :disabled="!yearsData?.total || clearing" @click="clearData(true)">Zerar BI (apagar tudo)</button>
          </div>
          <div class="reps-admin">
            <h3>Representantes · {{ repCounts.public }} públicos · {{ repCounts.private }} privados</h3>
            <p class="muted">O segmento vale para todos os pedidos do representante. Quem não tem cadastro conta como Privado.</p>
            <form class="rep-form" @submit.prevent="saveRep(newRep.name, newRep.segment, true)">
              <input v-model="newRep.name" maxlength="120" placeholder="Nome do novo representante (como vem na planilha)" required>
              <select v-model="newRep.segment"><option>Público</option><option>Privado</option></select>
              <button class="primary-button compact" :disabled="savingRep || !newRep.name.trim()">Adicionar</button>
            </form>
            <div class="table-wrap"><table>
              <thead><tr><th>REPRESENTANTE</th><th>SEGMENTO</th><th>PEDIDOS</th><th>VALOR (R$)</th><th></th></tr></thead>
              <tbody><tr v-for="r in representatives" :key="r.name">
                <td>{{ r.name }} <small v-if="!r.registered" class="muted">(sem cadastro)</small></td>
                <td><select :value="r.segment" :disabled="savingRep" @change="saveRep(r.name, ($event.target as HTMLSelectElement).value as Segment)"><option>Público</option><option>Privado</option></select></td>
                <td>{{ r.orders }}</td><td class="value">{{ money(r.value) }}</td>
                <td><button v-if="r.registered && !r.orders" class="ghost-button danger" @click="removeRep(r.name)">Remover</button></td>
              </tr></tbody>
            </table></div>
          </div>
        </div>
      </section>
      <section class="filters"><label>REGIÃO<select v-model="filters.region"><option value="">Todas</option><option v-for="item in regions" :key="item.name">{{ item.name }}</option></select></label><label>UF<select v-model="filters.uf"><option value="">Todas</option><option v-for="uf in ufs" :key="uf">{{ uf }}</option></select></label><label>REPRESENTANTE<select v-model="filters.manager"><option value="">Todos</option><option v-for="item in representatives.filter(r => r.orders)" :key="item.name">{{ item.name }}</option></select></label><label>SEGMENTO<select v-model="filters.segment"><option value="">Todos</option><option>Público</option><option>Privado</option></select></label><label class="search">BUSCA<input v-model="filters.search" placeholder="Cliente, pedido, representante..."></label><button class="clear" @click="Object.assign(filters, { region: '', uf: '', manager: '', segment: '', search: '' })">× Limpar</button></section>
      <div v-if="pending" class="loading">Carregando indicadores...</div>
      <p v-else-if="error" class="error">{{ error }}</p>
      <template v-else-if="data">
        <section class="kpis"><article><span>💰 TOTAL VENDIDO</span><strong>{{ money(data.total) }}</strong><small>{{ data.orderCount }} pedidos no período</small></article><article><span>▣ QTD PEDIDOS</span><strong>{{ data.orderCount }}</strong><small>Pedidos importados</small></article><article><span>◉ TICKET MÉDIO</span><strong>{{ money(data.averageTicket) }}</strong><small>Valor médio por pedido</small></article><article><span>⌁ REGIÕES ATIVAS</span><strong>{{ data.regions.length }}</strong><small>{{ data.states.length }} estados atendidos</small></article></section>
        <section class="grid-two"><article class="panel"><div class="panel-title"><div><h2>Vendas por região</h2><p>Distribuição do valor vendido</p></div></div><div class="bars"><div v-for="item in regions" :key="item.name" class="bar-row"><span>{{ item.name }}</span><div class="bar-track"><i :style="{ width: `${item.value / maxRegion * 100}%` }"></i></div><b>{{ money(item.value) }}</b></div></div></article><article class="panel"><div class="panel-title"><div><h2>Top 10 representantes</h2><p>Ranking por valor vendido</p></div></div><div class="bars"><div v-for="item in managers" :key="item.name" class="bar-row"><span>{{ item.name }}</span><div class="bar-track"><i :style="{ width: `${item.value / maxManager * 100}%` }"></i></div><b>{{ money(item.value) }}</b></div></div></article></section>
        <section class="grid-two">
          <article class="panel"><div class="panel-title"><div><h2>Público x Privado</h2><p>Valor vendido por segmento do representante</p></div></div><div class="bars"><div v-for="item in data.segments" :key="item.name" class="bar-row"><span>{{ item.name }} · {{ pct(item.value / (data.total || 1)) }}</span><div class="bar-track"><i :style="{ width: `${item.value / maxSegment * 100}%` }"></i></div><b>{{ money(item.value) }}</b></div></div></article>
          <article class="panel"><div class="panel-title"><div><h2>Top 10 clientes</h2><p>Clique para a análise individual · <NuxtLink class="link" to="/clientes">ver todos</NuxtLink></p></div></div><div class="bars"><div v-for="item in clients" :key="item.name" class="bar-row"><NuxtLink class="link" :to="{ path: '/clientes/detalhe', query: { nome: item.name } }" :title="item.name">{{ item.name }}</NuxtLink><div class="bar-track"><i :style="{ width: `${item.value / maxClient * 100}%` }"></i></div><b>{{ money(item.value) }}</b></div></div></article>
        </section>
        <section class="panel table-panel"><div class="panel-title"><div><h2>Base de pedidos</h2><p>{{ data.orderCount }} pedidos encontrados · {{ money(data.total) }}</p></div></div><div class="table-wrap"><table><thead><tr><th>EMISSÃO</th><th>PEDIDO</th><th>CLIENTE</th><th>UF</th><th>REGIÃO</th><th>REPRESENTANTE</th><th>SEGMENTO</th><th>VALOR (R$)</th></tr></thead><tbody><tr v-for="order in data.orders.slice(0, 50)" :key="order.id"><td>{{ date(order.issueDate) }}</td><td>{{ order.orderNumber }}</td><td><NuxtLink class="link" :to="{ path: '/clientes/detalhe', query: { nome: order.client } }">{{ order.client }}</NuxtLink></td><td>{{ order.uf }}</td><td>{{ order.region }}</td><td>{{ order.manager }}</td><td>{{ order.segment }}</td><td class="value">{{ money(order.value) }}</td></tr></tbody></table></div></section>
      </template>
    </main>
  </div>
</template>
