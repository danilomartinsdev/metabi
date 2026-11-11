import { readOrders, writeOrders } from '../../utils/orders'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const body = await readBody<{ all?: boolean, years?: string[] }>(event)
  const orders = await readOrders()
  if (body?.all) {
    await writeOrders([])
    return { removed: orders.length, remaining: 0 }
  }
  const years = new Set((body?.years || []).map(String))
  if (!years.size) throw createError({ statusCode: 400, statusMessage: 'Selecione ao menos um ano' })
  const yearOf = (d: string) => /^\d{4}/.test(d) ? d.slice(0, 4) : 'Sem data'
  const kept = orders.filter(o => !years.has(yearOf(o.issueDate)))
  await writeOrders(kept)
  return { removed: orders.length - kept.length, remaining: kept.length }
})
