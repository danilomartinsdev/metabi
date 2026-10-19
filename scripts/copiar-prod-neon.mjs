#!/usr/bin/env node
// Copia o banco da produção (Docker meta-bi-prod, só leitura) para o Neon da Vercel. Ver docs/operacao/deploy-vercel.md.
//
//   pnpm vercel:copiar-prod
//
// A URL DIRETA do Neon (sem "-pooler") fica num arquivo só seu, fora do repositório:
//   C:/Users/Danilo/meta-bi-segredos/neon-url-direta.txt   (ou o caminho em NEON_URL_ARQUIVO)
// O script nunca imprime a URL. Ele SUBSTITUI tudo o que houver no Neon pela cópia da produção.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PROD_POSTGRES = 'meta-bi-prod-postgres-1';
const BACKUPS = 'C:/Users/Danilo/meta-bi-backups';
const ARQUIVO_URL = process.env.NEON_URL_ARQUIVO ?? 'C:/Users/Danilo/meta-bi-segredos/neon-url-direta.txt';
// Cliente 17: restaura dumps do Postgres 16 (produção) num Neon 16 ou 17.
const IMAGEM_CLIENTE = 'postgres:17-alpine';

function falhar(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

function rodar(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) falhar(`Falhou: ${cmd} ${args[0]} (detalhes acima).`);
}

if (!fs.existsSync(ARQUIVO_URL)) {
  falhar(
    `Crie ${ARQUIVO_URL} com a URL DIRETA do Neon (Vercel › Storage › Neon › .env.local: DATABASE_URL_UNPOOLED).`,
  );
}
// Aceita o valor puro, entre aspas ou como NOME=valor (como aparece no .env.local da Vercel).
const url = fs
  .readFileSync(ARQUIVO_URL, 'utf8')
  .trim()
  .replace(/^[A-Z_]+\s*=\s*/, '')
  .replace(/^(["'])(.*)\1$/s, '$2')
  .trim();
if (!/^postgres(ql)?:\/\//.test(url)) falhar(`${ARQUIVO_URL} não contém uma URL postgresql://.`);
if (url.includes('-pooler')) falhar('Use a URL DIRETA do Neon (sem "-pooler" no host).');
if (/localhost|127\.0\.0\.1|meta-bi-prod/.test(url)) falhar('A URL não parece ser do Neon. Nada foi feito.');

const rodando = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', PROD_POSTGRES], {
  encoding: 'utf8',
});
if (rodando.stdout?.trim() !== 'true') falhar(`${PROD_POSTGRES} não está rodando.`);

// 1. Produção: só leitura.
fs.mkdirSync(BACKUPS, { recursive: true });
const carimbo = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const arquivo = path.posix.join(BACKUPS, `prod-para-neon-${carimbo}.dump`);
const fd = fs.openSync(arquivo, 'w', 0o600);
rodar(
  'docker',
  [
    'exec',
    PROD_POSTGRES,
    'sh',
    '-c',
    'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl',
  ],
  { stdio: ['ignore', fd, 'inherit'] },
);
fs.closeSync(fd);
console.log(`Cópia da produção salva em ${arquivo} (${(fs.statSync(arquivo).size / 1e6).toFixed(1)} MB).`);

// 2. Neon: a URL vai por variável de ambiente do container (não aparece na linha de comando).
const env = { ...process.env, NEON_URL: url };
const noNeon = (script, entrada = 'ignore') =>
  rodar('docker', ['run', '--rm', '-i', '-e', 'NEON_URL', IMAGEM_CLIENTE, 'sh', '-c', script], {
    env,
    stdio: [entrada, 'inherit', 'inherit'],
  });

noNeon(
  'psql "$NEON_URL" -v ON_ERROR_STOP=1 -q -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"',
);
const entrada = fs.openSync(arquivo, 'r');
noNeon('pg_restore --no-owner --no-acl -d "$NEON_URL"', entrada);
fs.closeSync(entrada);
// Sessões, links de senha, tokens de impressão e prévias da produção não valem no novo endereço.
noNeon(
  'psql "$NEON_URL" -v ON_ERROR_STOP=1 -q -c \'DELETE FROM "Sessao"; DELETE FROM "TokenRedefinicaoSenha"; DELETE FROM "TokenImpressao"; DELETE FROM "ArquivoTemporario";\'',
);
noNeon(
  `psql "$NEON_URL" -c 'SELECT (SELECT count(*) FROM "Pedido") AS pedidos, (SELECT count(*) FROM "Usuario") AS usuarios'`,
);

console.log('\n✔ Neon com a cópia da produção. Usuários entram com a mesma senha.');
