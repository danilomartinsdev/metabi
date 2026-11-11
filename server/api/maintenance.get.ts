import { readMaintenance } from '../utils/maintenance'

// Público: a tela de login precisa saber se o sistema está em manutenção.
export default defineEventHandler(async () => {
  const { active, message } = await readMaintenance()
  return { active, message }
})
