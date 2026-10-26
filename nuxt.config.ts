export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  devServer: { port: 3789 },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'meta-bi-development-secret',
    dataFile: process.env.DATA_FILE || 'data/orders.json',
    // Em produção, sobrescreva em runtime com NUXT_JWT_SECRET, NUXT_DATA_FILE e NUXT_COOKIE_SECURE
    cookieSecure: false,
    public: {
      appName: 'Meta Hospitalar BI',
      logoUrl: 'https://metahospitalar.com.br/wp-content/uploads/2022/06/META-HOSPITALAR-curva-icone-copiar.webp'
    }
  },
  typescript: { strict: true, typeCheck: false }
})
