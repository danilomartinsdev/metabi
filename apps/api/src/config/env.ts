import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

/** Variáveis de ambiente validadas no boot — a API não sobe com configuração inválida. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4318),
  API_HOST: z.string().default('127.0.0.1'),
  WEB_ORIGIN: z.url(),
  APP_URL: z.url(),
  DATABASE_URL: z.string().startsWith('postgresql://'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET precisa de pelo menos 32 caracteres'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  SESSION_IDLE_TIMEOUT_MIN: z.coerce.number().int().positive().default(30),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  COOKIE_SECURE: bool,
  // Produção só aceita HTTP (cookie sem Secure) com esta confirmação explícita — ex.: rede interna sem domínio.
  PERMITIR_HTTP: bool,

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().min(3),

  UPLOAD_DIR: z.string().default('./storage/uploads'),
  // 4 MB: cabe no limite de 4,5 MB por requisição da Vercel (planilhas reais têm < 1 MB).
  IMPORT_MAX_FILE_MB: z.coerce.number().positive().max(50).default(4),

  // PDF executivo (ADR 0004): URL da SPA que o Chromium da API abre (padrão: WEB_ORIGIN) e,
  // em produção (Alpine), o Chromium do sistema.
  PRINT_BASE_URL: z.url().optional(),
  PDF_CHROMIUM_PATH: z.string().optional(),
  // Segredo do Vercel Cron (limpeza diária). Sem ele a rota /api/manutencao/limpeza fica desativada.
  CRON_SECRET: z.string().min(16).optional(),
  EXPORT_MAX_LINHAS: z.coerce.number().int().positive().max(200_000).default(50_000),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const r = envSchema.safeParse(source);
  if (!r.success) {
    // Só nomes de variáveis e motivos — nunca os valores.
    const detalhes = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuração inválida (.env):\n${detalhes}`);
  }
  if (r.data.NODE_ENV === 'production' && !r.data.COOKIE_SECURE && !r.data.PERMITIR_HTTP) {
    throw new Error(
      'Configuração inválida: COOKIE_SECURE deve ser true em produção (para rodar só com HTTP, defina PERMITIR_HTTP=true).',
    );
  }
  return r.data;
}

export const ENV = Symbol('ENV');
