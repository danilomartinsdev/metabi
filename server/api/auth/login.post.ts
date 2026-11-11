import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getAdminCredentials, getJwtSecret } from '../../utils/security'

// Hash fixo para gastar o mesmo tempo quando o e-mail não confere (evita descobrir e-mails pelo tempo de resposta).
const DUMMY_HASH = '$2b$10$dVyz8s6r2h5ihEAnVFSCVeF25v8EkXTHhmhG7zhFSlWnyFZb/ICcu'

export default defineEventHandler(async event => {
  const body = await readBody<{ email?: string; password?: string }>(event)
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')
  const admin = getAdminCredentials()
  const emailMatches = email === admin.email
  const passwordMatches = await bcrypt.compare(password, emailMatches ? admin.passwordHash : DUMMY_HASH)
  if (!emailMatches || !passwordMatches) throw createError({ statusCode: 401, statusMessage: 'E-mail ou senha inválidos' })
  const token = jwt.sign({ email, name: 'Administrador', role: 'admin' }, getJwtSecret(), { algorithm: 'HS256', expiresIn: '8h' })
  setCookie(event, 'meta_bi_token', token, { httpOnly: true, sameSite: 'lax', secure: Boolean(useRuntimeConfig().cookieSecure), maxAge: 60 * 60 * 8 })
  return { user: { email, name: 'Administrador' } }
})
