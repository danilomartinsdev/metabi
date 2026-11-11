import { parseWorkbook, writeOrders } from '../utils/orders'
import { requireAdmin } from '../utils/auth'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file')
  if (!file?.data?.length) throw createError({ statusCode: 400, statusMessage: 'Arquivo não enviado' })
  const orders = parseWorkbook(file.data)
  if (!orders.length) throw createError({ statusCode: 422, statusMessage: 'Nenhum registro válido encontrado' })
  await writeOrders(orders)
  return { imported: orders.length }
})
