import jwt from 'jsonwebtoken'

export function requireAuth(event: any) {
  const token = getCookie(event, 'meta_bi_token')
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  try {
    return jwt.verify(token, useRuntimeConfig().jwtSecret)
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Sessão expirada' })
  }
}
