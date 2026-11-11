import { requireAdmin } from '../../utils/auth'
import { writeMaintenance } from '../../utils/maintenance'

export default defineEventHandler(async event => {
  requireAdmin(event)
  const body = await readBody<{ active?: boolean, message?: string }>(event)
  const state = await writeMaintenance(Boolean(body?.active), body?.message)
  return { active: state.active, message: state.message, since: state.since }
})
