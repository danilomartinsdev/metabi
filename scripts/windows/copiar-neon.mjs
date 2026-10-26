#!/usr/bin/env node
// Copia a base de produção da Vercel (Neon) para o PostgreSQL deste servidor Windows, SUBSTITUINDO a local.
// O Neon só é lido. Ver TUTORIAL-SERVIDOR-WINDOWS.md.
//
//   pnpm windows:copiar-neon [arquivo-com-a-url]     (Prompt de Comando como Administrador)
//
// A URL DIRETA do Neon (sem "-pooler") fica num arquivo, por padrão C:\metabi-dados\segredos\neon-url-direta.txt.
// O script nunca a imprime nem a passa na linha de comando.
import fs from 'node:fs';
import path from 'node:path';
import {
  PASTAS,
  SERVICO_API,
  backupLocal,
  carimbo,
  envPostgres,
  exigirWindowsAdmin,
  falhar,
  lerEnv,
  passo,
  perguntar,
  pg,
  rodar,
  servico,
} from './lib.mjs';
import { migrar } from './etapas.mjs';

exigirWindowsAdmin();
const env = lerEnv();
const arquivoUrl =
  process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(PASTAS.segredos, 'neon-url-direta.txt');
if (!fs.existsSync(arquivoUrl)) {
  falhar(
    `Crie ${arquivoUrl} contendo só a URL DIRETA do Neon ` +
      '(Vercel › Storage › Neon › .env.local: DATABASE_URL_UNPOOLED).',
  );
}
// Aceita o valor puro, entre aspas ou como NOME=valor (como aparece no .env.local da Vercel).
const url = fs
  .readFileSync(arquivoUrl, 'utf8')
  .trim()
  .replace(/^[A-Z_]+\s*=\s*/, '')
  .replace(/^(["'])(.*)\1$/s, '$2')
  .trim();
if (!/^postgres(ql)?:\/\//.test(url)) falhar(`${arquivoUrl} não contém uma URL postgresql://.`);
if (url.includes('-pooler')) falhar('Use a URL DIRETA do Neon (sem "-pooler" no host).');
if (/localhost|127\.0\.0\.1/.test(url)) falhar('A URL não parece ser do Neon. Nada foi feito.');

const neon = envPostgres(url);
const local = envPostgres(env.DATABASE_URL);

passo('Conferindo versões');
const versaoNeon = Number(
  rodar(pg(env, 'psql'), ['-tAc', 'SHOW server_version_num'], { env: neon, silencioso: true }).stdout.trim(),
);
const saidaDump = rodar(pg(env, 'pg_dump'), ['--version'], { silencioso: true }).stdout;
const versaoDump = Number(/(\d+)\.\d+/.exec(saidaDump)?.[1]);
const majorNeon = Math.floor(versaoNeon / 10000);
console.log(`Neon: PostgreSQL ${majorNeon} · pg_dump deste servidor: ${versaoDump}`);
if (!majorNeon || versaoDump < majorNeon) {
  falhar(
    `O pg_dump (${versaoDump}) precisa ser da mesma versão ou mais novo que o Neon (${majorNeon}). Instale o PostgreSQL ${majorNeon} ou mais novo.`,
  );
}

if (!process.argv.includes('--sim')) {
  console.log('\nIsto SUBSTITUI toda a base deste servidor pela da Vercel (a da Vercel não é alterada).');
  if ((await perguntar('Digite SIM para continuar')) !== 'SIM') falhar('Cancelado. Nada foi feito.');
}

passo('Backup da base local atual');
console.log(`Backup em ${backupLocal(env, 'antes-de-copiar-neon')}`);

passo('Copiando a base do Neon (só leitura)');
const dump = path.join(PASTAS.backups, `neon-${carimbo()}.dump`);
rodar(pg(env, 'pg_dump'), ['-Fc', '--no-owner', '--no-acl', '-f', dump], { env: neon });
console.log(`Cópia salva em ${dump} (${(fs.statSync(dump).size / 1e6).toFixed(1)} MB)`);

passo('Restaurando no PostgreSQL deste servidor');
servico(SERVICO_API, 'stop', { permitirFalha: true });
process.on('exit', (codigo) => {
  if (codigo !== 0)
    console.error(
      '\nA cópia falhou com a API parada. Corrija e rode de novo (o backup acima tem a base anterior).',
    );
});
const psqlLocal = (sql) => rodar(pg(env, 'psql'), ['-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], { env: local });
psqlLocal(`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION "${local.PGUSER}";`);
rodar(pg(env, 'pg_restore'), ['--no-owner', '--no-acl', '-d', local.PGDATABASE, dump], { env: local });
// Sessões, links de senha, tokens de impressão e prévias não valem no novo endereço.
psqlLocal(
  'DELETE FROM "Sessao"; DELETE FROM "TokenRedefinicaoSenha"; DELETE FROM "TokenImpressao"; DELETE FROM "ArquivoTemporario";',
);
rodar(
  pg(env, 'psql'),
  ['-c', 'SELECT (SELECT count(*) FROM "Pedido") AS pedidos, (SELECT count(*) FROM "Usuario") AS usuarios'],
  { env: local },
);

// Garante as migrations da versão deste servidor (normalmente já vêm aplicadas na cópia).
migrar();

passo('Iniciando a API');
servico(SERVICO_API, 'start');
console.log('\nBase copiada. Os usuários entram com a mesma senha da Vercel.');
console.log(`Apague o arquivo com a URL do Neon quando não precisar mais: ${arquivoUrl}`);
