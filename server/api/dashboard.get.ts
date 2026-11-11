import { readOrders } from '../utils/orders'
import { requireAuth } from '../utils/auth'
import type { DashboardData, Order } from '~/types/order'

function aggregate(orders: Order[], key: keyof Order) {
  const map = new Map<string, { name: string; value: number; orders: number; region?: string }>()
  for (const order of orders) {
    const name = String(order[key] || 'Não informado')
    const item = map.get(name) || { name, value: 0, orders: 0 }
    item.value += order.value
    item.orders += 1
    if (key === 'uf') item.region = order.region
    map.set(name, item)
  }
  return [...map.values()].sort((a, b) => b.value - a.value)
}

export default defineEventHandler(async event => {
  await requireAuth(event)
  const query = getQuery(event)
  let orders = await readOrders()
  if (query.region) orders = orders.filter(o => o.region === query.region)
  if (query.uf) orders = orders.filter(o => o.uf === query.uf)
  if (query.manager) orders = orders.filter(o => o.manager === query.manager)
  if (query.segment) orders = orders.filter(o => o.segment === query.segment)
  if (query.search) {
    const search = String(query.search).toLowerCase()
    orders = orders.filter(o => [o.client, o.orderNumber, o.manager, o.uf].some(v => v.toLowerCase().includes(search)))
  }
  const monthlyMap = new Map<string, { value: number; orders: number }>()
  for (const order of orders) {
    const month = order.issueDate?.slice(0, 7) || 'Sem data'
    const item = monthlyMap.get(month) || { value: 0, orders: 0 }
    item.value += order.value
    item.orders += 1
    monthlyMap.set(month, item)
  }
  const total = orders.reduce((sum, order) => sum + order.value, 0)
  return {
    orders: orders.slice(0, 200),
    total,
    orderCount: orders.length,
    averageTicket: orders.length ? total / orders.length : 0,
    regions: aggregate(orders, 'region'),
    managers: aggregate(orders, 'manager').slice(0, 10),
    states: aggregate(orders, 'uf'),
    monthly: [...monthlyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, ...value })),
    updatedAt: new Date().toISOString()
  } satisfies DashboardData
})
