import { readClassifiedOrders } from '../utils/representatives'
import { requireAuth } from '../utils/auth'
import type { ClientSummary } from '~/types/order'

// Lista de clientes para a tela de análise individual.
export default defineEventHandler(async event => {
  await requireAuth(event)
  const map = new Map<string, ClientSummary>()
  for (const o of await readClassifiedOrders()) {
    const name = o.client || 'Não informado'
    const item = map.get(name)
    if (!item) { map.set(name, { name, value: o.value, orders: 1, lastOrder: o.issueDate, segment: o.segment }); continue }
    item.value += o.value
    item.orders += 1
    if (o.issueDate > item.lastOrder) item.lastOrder = o.issueDate
    if (item.segment !== o.segment) item.segment = 'Misto'
  }
  return { clients: [...map.values()].sort((a, b) => b.value - a.value) }
})
