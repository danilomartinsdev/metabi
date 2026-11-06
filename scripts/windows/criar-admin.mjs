#!/usr/bin/env node
// Cria (ou reativa e redefine a senha de) um administrador no servidor Windows.   pnpm windows:criar-admin
// Usa apps/api/prisma/criar-admin.ts; a senha vai por variável de ambiente, nunca pela linha de comando.
import { falhar, lerEnv, perguntar, pnpm } from './lib.mjs';

lerEnv();
const email = await perguntar('E-mail do administrador');
const nome = await perguntar('Nome');
const senha = await perguntar('Senha provisória (10+ caracteres; a troca é pedida no 1º acesso)', {
  oculto: true,
});
if (!email || !nome || senha.length < 10) falhar('Informe e-mail, nome e uma senha com 10+ caracteres.');

pnpm(['--filter', 'api', 'exec', 'tsx', 'prisma/criar-admin.ts'], {
  env: { NODE_ENV: 'production', ADMIN_EMAIL: email, ADMIN_NOME: nome, ADMIN_SENHA: senha },
});
