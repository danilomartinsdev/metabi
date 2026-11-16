import { isSegment, normalizeName, readRepresentatives, writeRepresentatives } from '../../utils/representatives'
import { requireAdmin } from '../../utils/auth'

// Cadastra um representante novo ou altera o segmento de um existente.
export default defineEventHandler(async event => {
  await requireAdmin(event)
  const body = await readBody<{ name?: string, segment?: string }>(event)
  const name = normalizeName(body?.name)
  if (!name || name.length > 120) throw createError({ statusCode: 400, statusMessage: 'Informe o nome do representante (até 120 caracteres)' })
  if (!isSegment(body?.segment)) throw createError({ statusCode: 400, statusMessage: 'Segmento deve ser Público ou Privado' })
  const list = await readRepresentatives()
  const now = new Date().toISOString()
  const existing = list.find(r => normalizeName(r.name) === name)
  if (existing) Object.assign(existing, { segment: body.segment, updatedAt: now })
  else list.push({ name, segment: body.segment, createdAt: now, updatedAt: now })
  await writeRepresentatives(list)
  return { name, segment: body.segment, created: !existing }
})
