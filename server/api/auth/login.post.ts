import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async event => {
  const body = await readBody<{ email?: string; password?: string }>(event)
  const email = body.email?.trim().toLowerCase()
  const password = body.password || ''
  const valid = email === 'admin@metahospitalar.com.br' && await bcrypt.compare(password, await bcrypt.hash('admin123', 10))
  if (!valid) throw createError({ statusCode: 401, statusMessage: 'E-mail ou senha inválidos' })
  const token = jwt.sign({ email, name: 'Administrador' }, useRuntimeConfig().jwtSecret, { expiresIn: '8h' })
  setCookie(event, 'meta_bi_token', token, { httpOnly: true, sameSite: 'lax', secure: Boolean(useRuntimeConfig().cookieSecure), maxAge: 60 * 60 * 8 })
  return { user: { email, name: 'Administrador' } }
})
