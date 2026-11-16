import { normalizeName, readRepresentatives, writeRepresentatives } from '../../utils/representatives'
import { readOrders } from '../../utils/orders'
import { requireAdmin } from '../../utils/auth'

// Só remove cadastros sem pedidos na base; quem tem pedidos apenas troca de segmento.
export default defineEventHandler(async event => {
  await requireAdmin(event)
  const name = normalizeName(getQuery(event).name)
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Informe o representante' })
  if ((await readOrders()).some(o => normalizeName(o.manager) === name)) {
    throw createError({ statusCode: 409, statusMessage: 'Representante possui pedidos na base e não pode ser removido' })
  }
  const list = await readRepresentatives()
  const kept = list.filter(r => normalizeName(r.name) !== name)
  if (kept.length === list.length) throw createError({ statusCode: 404, statusMessage: 'Representante não cadastrado' })
  await writeRepresentatives(kept)
  return { removed: name }
})
