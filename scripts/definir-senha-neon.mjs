#!/usr/bin/env node
// Define a senha de um usuário no banco da Vercel (Neon). Ver docs/operacao/deploy-vercel.md.
//
//   NOVA_SENHA='...' pnpm vercel:definir-senha usuario@empresa.com.br
//
// Usa o mesmo hash da API (argon2id, parâmetros de apps/api/src/modules/auth/senha.service.ts) e a mesma
// regra de senha (packages/shared). Também desbloqueia o usuário, dispensa a troca obrigatória e encerra as
// sessões dele. A URL do Neon vem de metabi-segredos (igual ao vercel:copiar-prod) e nunca é impressa.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.resolve(import.meta.dirname, '../apps/api/package.json'));
const argon2 = require('argon2');

const ARQUIVO_URL = process.env.NEON_URL_ARQUIVO ?? 'C:/Users/Danilo/metabi-segredos/neon-url-direta.txt';
const IMAGEM_CLIENTE = 'postgres:17-alpine';
// Mesmos parâmetros do SenhaService da API.
const OPCOES = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

function falhar(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

const email = (process.argv[2] ?? '').trim().toLowerCase();
const senha = process.env.NOVA_SENHA ?? '';
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
  falhar('Uso: NOVA_SENHA=... pnpm vercel:definir-senha <e-mail>');
// Mesma regra do senhaSchema (packages/shared/src/schemas/auth.ts).
if (senha.length < 10 || senha.length > 128 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
  falhar('A senha precisa ter de 10 a 128 caracteres, com letras e números.');
}
if (!fs.existsSync(ARQUIVO_URL)) falhar(`Crie ${ARQUIVO_URL} com a URL DIRETA do Neon.`);
// Aceita o valor puro, entre aspas ou como NOME=valor (como aparece no .env.local da Vercel).
const url = fs
  .readFileSync(ARQUIVO_URL, 'utf8')
  .trim()
  .replace(/^[A-Z_]+\s*=\s*/, '')
  .replace(/^(["'])(.*)\1$/s, '$2')
  .trim();
if (!/^postgres(ql)?:\/\//.test(url)) falhar(`${ARQUIVO_URL} não contém uma URL postgresql://.`);

const hash = await argon2.hash(senha, OPCOES);
// Valores vão como variáveis do psql (-v), nunca concatenados no SQL.
const sql = `WITH u AS (
  UPDATE "Usuario" SET "senhaHash" = :'hash', "trocarSenha" = false, "tentativasFalhas" = 0, "bloqueadoAte" = NULL
  WHERE lower(email) = :'email' RETURNING id, nome, ativo)
, s AS (DELETE FROM "Sessao" WHERE "usuarioId" IN (SELECT id FROM u))
SELECT nome, ativo FROM u;`;
// Hash e e-mail entram como variáveis de ambiente do container e viram variáveis do psql.
const r = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '-i',
    '-e',
    'NEON_URL',
    '-e',
    'H',
    '-e',
    'E',
    IMAGEM_CLIENTE,
    'sh',
    '-c',
    'psql "$NEON_URL" -v ON_ERROR_STOP=1 -At -v hash="$H" -v email="$E"',
  ],
  { input: sql, encoding: 'utf8', env: { ...process.env, NEON_URL: url, H: hash, E: email } },
);
if (r.status !== 0) falhar(`Falhou ao gravar no Neon: ${(r.stderr ?? '').trim()}`);
const linha = r.stdout.trim();
if (!linha)
  falhar(
    `Nenhum usuário com o e-mail ${email} no banco da Vercel (copiou os dados com vercel:copiar-prod?).`,
  );
const [nome, ativo] = linha.split('|');
console.log(`✔ Senha definida para ${nome} <${email}>${ativo === 't' ? '' : ' — atenção: usuário INATIVO'}.`);
