// Credenciais usadas só no `npm run dev`, quando as variáveis não estão definidas.
const DEV_JWT_SECRET = 'meta-bi-dev-only-secret-nao-usar-em-producao'
const DEV_ADMIN_EMAIL = 'admin@metahospitalar.com.br'
// bcrypt de "admin123"
const DEV_ADMIN_PASSWORD_HASH = '$2b$10$gVg07zxJzfFD2MAUHMe1wO0DB6eKspfgp5vJ4pmMYUamUzMncFdWm'

const MIN_SECRET_LENGTH = 32

export function getJwtSecret(): string {
  const secret = useRuntimeConfig().jwtSecret
  if (secret) return secret
  if (import.meta.dev) return DEV_JWT_SECRET
  throw new Error('NUXT_JWT_SECRET não definido')
}

export function getAdminCredentials() {
  const config = useRuntimeConfig()
  if (config.adminEmail && config.adminPasswordHash) {
    return { email: String(config.adminEmail).trim().toLowerCase(), passwordHash: String(config.adminPasswordHash) }
  }
  if (import.meta.dev) return { email: DEV_ADMIN_EMAIL, passwordHash: DEV_ADMIN_PASSWORD_HASH }
  throw new Error('NUXT_ADMIN_EMAIL e NUXT_ADMIN_PASSWORD_HASH não definidos')
}

// Validação feita na subida do servidor: em produção, falha logo se a configuração estiver insegura.
export function assertSecurityConfig() {
  if (import.meta.dev) return
  const config = useRuntimeConfig()
  const problems: string[] = []
  if (!config.jwtSecret) problems.push('NUXT_JWT_SECRET não definido')
  else if (String(config.jwtSecret).length < MIN_SECRET_LENGTH) problems.push(`NUXT_JWT_SECRET precisa ter pelo menos ${MIN_SECRET_LENGTH} caracteres`)
  if (!config.adminEmail) problems.push('NUXT_ADMIN_EMAIL não definido')
  if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(String(config.adminPasswordHash || ''))) problems.push('NUXT_ADMIN_PASSWORD_HASH ausente ou não é um hash bcrypt (gere com: npm run hash-password)')
  if (problems.length) throw new Error(`Configuração de segurança inválida:\n - ${problems.join('\n - ')}`)
}
