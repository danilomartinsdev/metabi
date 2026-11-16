import type { Aggregate, Order } from '~/types/order'

export function aggregate(orders: Order[], key: keyof Order) {
  const map = new Map<string, Aggregate & { region?: string }>()
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

export function monthly(orders: Order[]) {
  const map = new Map<string, { value: number; orders: number }>()
  for (const order of orders) {
    const month = order.issueDate?.slice(0, 7) || 'Sem data'
    const item = map.get(month) || { value: 0, orders: 0 }
    item.value += order.value
    item.orders += 1
    map.set(month, item)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, ...value }))
}
