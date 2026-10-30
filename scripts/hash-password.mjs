// Gera o hash bcrypt para NUXT_ADMIN_PASSWORD_HASH.
// Uso: npm run hash-password -- "senha-forte"
import bcrypt from 'bcryptjs'

const password = process.argv[2]
if (!password || password.length < 12) {
  console.error('Informe uma senha com pelo menos 12 caracteres: npm run hash-password -- "senha-forte"')
  process.exit(1)
}
console.log(bcrypt.hashSync(password, 12))
