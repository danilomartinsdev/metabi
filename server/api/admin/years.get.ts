import { readOrders } from '../../utils/orders'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const orders = await readOrders()
  const map = new Map<string, { count: number, total: number }>()
  for (const o of orders) {
    const year = /^\d{4}/.test(o.issueDate) ? o.issueDate.slice(0, 4) : 'Sem data'
    const item = map.get(year) || { count: 0, total: 0 }
    item.count++; item.total += o.value || 0
    map.set(year, item)
  }
  const years = [...map.entries()].map(([year, v]) => ({ year, ...v })).sort((a, b) => b.year.localeCompare(a.year))
  return { years, total: orders.length }
})
