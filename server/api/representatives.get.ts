import { listRepresentatives } from '../utils/representatives'
import { requireAuth } from '../utils/auth'

export default defineEventHandler(async event => {
  await requireAuth(event)
  return { representatives: await listRepresentatives() }
})
