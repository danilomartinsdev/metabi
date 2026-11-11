import jwt from 'jsonwebtoken'
import { getJwtSecret } from './security'
import { readMaintenance } from './maintenance'

function verifyToken(event: any) {
  const token = getCookie(event, 'meta_bi_token')
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as jwt.JwtPayload
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Sessão expirada' })
  }
}

// Exige sessão válida. Em manutenção, só sessões com role "admin" passam.
export async function requireAuth(event: any) {
  const payload = verifyToken(event)
  if (payload.role !== 'admin' && (await readMaintenance()).active) {
    throw createError({ statusCode: 503, statusMessage: 'Sistema em manutenção' })
  }
  return payload
}

export async function requireAdmin(event: any) {
  const payload = verifyToken(event)
  if (payload.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Acesso restrito a administradores' })
  return payload
}
