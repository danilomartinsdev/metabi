export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'meta-bi-development-secret',
    dataFile: process.env.DATA_FILE || 'data/orders.json',
    public: {
      appName: 'Meta Hospitalar BI',
      logoUrl: 'https://metahospitalar.com.br/wp-content/uploads/2022/06/META-HOSPITALAR-curva-icone-copiar.webp'
    }
  },
  typescript: { strict: true, typeCheck: false }
})
