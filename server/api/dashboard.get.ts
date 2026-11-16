import { readClassifiedOrders } from '../utils/representatives'
import { aggregate, monthly } from '../utils/aggregate'
import { requireAuth } from '../utils/auth'
import type { DashboardData } from '~/types/order'

export default defineEventHandler(async event => {
  await requireAuth(event)
  const query = getQuery(event)
  let orders = await readClassifiedOrders()
  if (query.region) orders = orders.filter(o => o.region === query.region)
  if (query.uf) orders = orders.filter(o => o.uf === query.uf)
  if (query.manager) orders = orders.filter(o => o.manager === query.manager)
  if (query.segment) orders = orders.filter(o => o.segment === query.segment)
  if (query.search) {
    const search = String(query.search).toLowerCase()
    orders = orders.filter(o => [o.client, o.orderNumber, o.manager, o.uf].some(v => v.toLowerCase().includes(search)))
  }
  const total = orders.reduce((sum, order) => sum + order.value, 0)
  return {
    orders: orders.slice(0, 200),
    total,
    orderCount: orders.length,
    averageTicket: orders.length ? total / orders.length : 0,
    regions: aggregate(orders, 'region'),
    managers: aggregate(orders, 'manager').slice(0, 10),
    states: aggregate(orders, 'uf') as DashboardData['states'],
    segments: aggregate(orders, 'segment'),
    clients: aggregate(orders, 'client').slice(0, 10),
    monthly: monthly(orders),
    updatedAt: new Date().toISOString()
  } satisfies DashboardData
})
