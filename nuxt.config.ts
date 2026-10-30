export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  devServer: { port: 3789 },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // Valores sensíveis vêm só de variáveis de ambiente em runtime (nunca ficam no build):
    // NUXT_JWT_SECRET, NUXT_ADMIN_EMAIL, NUXT_ADMIN_PASSWORD_HASH, NUXT_DATA_FILE e NUXT_COOKIE_SECURE
    jwtSecret: '',
    adminEmail: '',
    adminPasswordHash: '',
    dataFile: 'data/orders.json',
    cookieSecure: false,
    public: {
      appName: 'Meta Hospitalar BI',
      logoUrl: 'https://metahospitalar.com.br/wp-content/uploads/2022/06/META-HOSPITALAR-curva-icone-copiar.webp'
    }
  },
  typescript: { strict: true, typeCheck: false }
})
