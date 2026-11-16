import { readClassifiedOrders } from '../utils/representatives'
import { aggregate, monthly } from '../utils/aggregate'
import { requireAuth } from '../utils/auth'
import type { ClientDetail } from '~/types/order'

// Análise individual do faturamento de um cliente.
export default defineEventHandler(async event => {
  await requireAuth(event)
  const name = String(getQuery(event).name || '')
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Informe o cliente' })
  const orders = (await readClassifiedOrders())
    .filter(o => (o.client || 'Não informado') === name)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
  if (!orders.length) throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado' })
  const total = orders.reduce((sum, o) => sum + o.value, 0)
  const dates = orders.map(o => o.issueDate).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  return {
    name,
    total,
    orderCount: orders.length,
    averageTicket: total / orders.length,
    firstOrder: dates[0] || '',
    lastOrder: dates[dates.length - 1] || '',
    managers: aggregate(orders, 'manager'),
    states: aggregate(orders, 'uf'),
    segments: aggregate(orders, 'segment'),
    monthly: monthly(orders),
    orders
  } satisfies ClientDetail
})
