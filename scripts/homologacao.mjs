#!/usr/bin/env node
// Ambiente de homologação: segunda stack Docker (projeto metabi-homolog), isolada da produção.
// Ver docs/operacao/homologacao.md.
//
//   pnpm homolog:preparar [--rede [--ip x]]  1ª vez: clone + .env da homologação (segredos novos);
//                                            padrão http://localhost:4337, --rede = rede local
//   pnpm homolog:copiar-prod                 copia o banco (pg_dump) e as planilhas importadas da produção
//                                            (só leitura) para a homologação
//   pnpm homolog:subir <branch>              põe a branch no ar na homologação (migrations rodam sozinhas)
//   pnpm homolog:status | homolog:parar
//
// Travas: todo comando docker compose daqui usa o projeto metabi-homolog e o clone da homologação;
// da produção só se lê (pg_dump). Nunca imprime segredos.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_DEV = path.resolve(import.meta.dirname, '..').replaceAll('\\', '/');
const CLONE = 'C:/Users/Danilo/metabi-homolog';
const BACKUPS = 'C:/Users/Danilo/metabi-backups';
const PROJETO = 'metabi-homolog';
const PROD_POSTGRES = 'metabi-prod-postgres-1';
// Planilhas das importações (volume storage). Da produção só se lê (montado :ro).
const PROD_STORAGE = 'metabi-prod_storage';
const HOMOLOG_STORAGE = 'metabi-homolog_storage';
const IMAGEM_COPIA = 'postgres:16-alpine'; // já baixada (é a do banco); só usa sh/cp
const MARCADOR = 'AMBIENTE=homologacao';
const HTTP_PORT = 4337;
const MAILPIT_PORT = 4339;
const ENV = path.posix.join(CLONE, '.env');

function falhar(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

function rodar(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) falhar(`Falhou: ${cmd} ${args.join(' ')}`);
  return r;
}

function saida(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** Garante que o clone existe e que o .env dele é o da homologação (nunca o da produção). */
function exigirClone() {
  if (!fs.existsSync(path.posix.join(CLONE, '.git')))
    falhar(`Clone não encontrado. Rode: pnpm homolog:preparar`);
  if (!fs.existsSync(ENV) || !fs.readFileSync(ENV, 'utf8').split(/\r?\n/).includes(MARCADOR)) {
    falhar(`${ENV} não é um .env de homologação (falta a linha ${MARCADOR}). Nada foi feito.`);
  }
}

/** docker compose SEMPRE com o projeto e os arquivos da homologação, rodando no clone. */
function compose(args, opts = {}) {
  exigirClone();
  if (!fs.existsSync(path.posix.join(CLONE, 'docker-compose.homolog.yml'))) {
    falhar(
      'A versão no clone não tem docker-compose.homolog.yml: faça merge da main na branch e suba de novo.',
    );
  }
  const base = ['compose', '-p', PROJETO, '--env-file', '.env', '-f', 'docker-compose.prod.yml'];
  return rodar('docker', [...base, '-f', 'docker-compose.homolog.yml', ...args], { cwd: CLONE, ...opts });
}

/** Endereço da homologação (WEB_ORIGIN do .env dela; não é segredo). */
function endereco() {
  const linha = fs
    .readFileSync(ENV, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('WEB_ORIGIN='));
  return linha?.slice('WEB_ORIGIN='.length) ?? `http://localhost:${HTTP_PORT}`;
}

function ipDaRede() {
  const i = process.argv.indexOf('--ip');
  if (i > 0 && process.argv[i + 1]) return process.argv[i + 1];
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address)
    // 169.254 = sem DHCP; 192.168.137.1 = hotspot do Windows.
    .filter((a) => !a.startsWith('169.254.') && a !== '192.168.137.1');
  const privado = ips.find((a) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a));
  if (!privado) falhar(`Não achei o IP da rede local. Informe: pnpm homolog:preparar --ip <ip>`);
  return privado;
}

function preparar() {
  if (!fs.existsSync(path.posix.join(CLONE, '.git'))) {
    rodar('git', ['clone', REPO_DEV, CLONE]);
  } else {
    console.log(`Clone já existe em ${CLONE}.`);
  }
  if (fs.existsSync(ENV)) {
    console.log('.env da homologação já existe — não foi alterado. Apague-o para regerar.');
  } else {
    // Padrão: só nesta máquina. --rede publica na rede local (exige liberar a porta no firewall).
    const rede = process.argv.includes('--rede');
    const url = `http://${rede ? ipDaRede() : 'localhost'}:${HTTP_PORT}`;
    const segredo = (n) => crypto.randomBytes(n).toString('base64url');
    const valores = {
      POSTGRES_PASSWORD: segredo(24),
      JWT_ACCESS_SECRET: segredo(48),
      NODE_ENV: 'production',
      WEB_ORIGIN: url,
      APP_URL: url,
    };
    let env = fs.readFileSync(path.posix.join(CLONE, '.env.example'), 'utf8');
    for (const [k, v] of Object.entries(valores))
      env = env.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`);
    env = env.replaceAll('__POSTGRES_PASSWORD__', encodeURIComponent(valores.POSTGRES_PASSWORD));
    env += `\n# Homologação (gerado por scripts/homologacao.mjs)\n${MARCADOR}\nHTTP_BIND=${rede ? '0.0.0.0' : '127.0.0.1'}\nHTTP_PORT=${HTTP_PORT}\nMAILPIT_PORT=${MAILPIT_PORT}\n`;
    fs.writeFileSync(ENV, env, { mode: 0o600 });
    console.log(`.env da homologação criado (segredos novos; endereço ${url}).`);
  }
  console.log(`
Próximos passos:
  1. pnpm homolog:subir main
  2. pnpm homolog:copiar-prod
  (Só com --rede: liberar a porta no firewall, no PowerShell como administrador, uma vez:
   netsh advfirewall firewall add rule name="metabi-homolog" dir=in action=allow protocol=TCP localport=${HTTP_PORT})`);
}

function subir() {
  const branch = process.argv[3];
  if (!branch || branch.startsWith('-')) falhar('Informe a branch: pnpm homolog:subir <branch>');
  exigirClone();
  if (saida('git', ['status', '--porcelain'], { cwd: CLONE })) {
    falhar(`O clone ${CLONE} tem alterações locais; ele só deve receber branches do repositório.`);
  }
  rodar('git', ['fetch', '--prune', 'origin'], { cwd: CLONE });
  rodar('git', ['checkout', '--detach', `origin/${branch}`], { cwd: CLONE });
  compose(['up', '-d', '--build', '--wait']);
  const rev = saida('git', ['log', '-1', '--format=%h %s'], { cwd: CLONE });
  console.log(`\n✔ Homologação no ar com ${branch} (${rev}) em ${endereco()}`);
}

function copiarProd() {
  exigirClone();
  const rodando = saida('docker', ['inspect', '-f', '{{.State.Running}}', PROD_POSTGRES]);
  if (rodando !== 'true') falhar(`${PROD_POSTGRES} não está rodando.`);

  // 1. Produção: só leitura. A senha fica dentro do container (variável de ambiente dele).
  fs.mkdirSync(BACKUPS, { recursive: true });
  const carimbo = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const arquivo = path.posix.join(BACKUPS, `prod-${carimbo}.dump`);
  const fd = fs.openSync(arquivo, 'w', 0o600);
  rodar(
    'docker',
    [
      'exec',
      PROD_POSTGRES,
      'sh',
      '-c',
      'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc',
    ],
    { stdio: ['ignore', fd, 'inherit'] },
  );
  fs.closeSync(fd);
  console.log(`Cópia da produção salva em ${arquivo} (${(fs.statSync(arquivo).size / 1e6).toFixed(1)} MB).`);

  // 2. Homologação: para a API, recria o schema e restaura.
  compose(['stop', 'web', 'api']);
  compose(['up', '-d', '--wait', 'postgres']);
  const psql = (sql) =>
    compose([
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      `PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '${sql}'`,
    ]);
  psql('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const entrada = fs.openSync(arquivo, 'r');
  compose(
    [
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl',
    ],
    { stdio: [entrada, 'inherit', 'inherit'] },
  );
  fs.closeSync(entrada);
  // Nenhuma sessão, link de senha ou token de impressão da produção vale na homologação.
  psql(
    'DELETE FROM "Sessao"; DELETE FROM "TokenRedefinicaoSenha"; DELETE FROM "TokenImpressao"; DELETE FROM "ArquivoTemporario";',
  );

  // 3. Planilhas das importações: a API da homologação está parada; a produção é montada só leitura.
  copiarArquivos();

  // 4. Sobe de novo: o migrate aplica as migrations da branch atual por cima da cópia.
  compose(['up', '-d', '--wait']);
  console.log('\n✔ Homologação com a cópia da produção. Usuários entram com a mesma senha da produção.');
}

/** Substitui o volume storage da homologação por uma cópia do da produção (montado :ro). */
function copiarArquivos() {
  const volumes = (saida('docker', ['volume', 'ls', '--format', '{{.Name}}']) ?? '').split(/\r?\n/);
  if (!volumes.includes(PROD_STORAGE)) falhar(`Volume ${PROD_STORAGE} não encontrado.`);
  if (!volumes.includes(HOMOLOG_STORAGE)) rodar('docker', ['volume', 'create', HOMOLOG_STORAGE]);
  rodar('docker', [
    'run',
    '--rm',
    '--network',
    'none',
    '-v',
    `${PROD_STORAGE}:/de:ro`,
    '-v',
    `${HOMOLOG_STORAGE}:/para`,
    IMAGEM_COPIA,
    'sh',
    '-c',
    'find /para -mindepth 1 -delete && cp -a /de/. /para/ && echo "Planilhas copiadas: $(find /para -type f | wc -l) arquivo(s)."',
  ]);
}

const comandos = {
  preparar,
  subir,
  'copiar-prod': copiarProd,
  status: () => {
    exigirClone();
    console.log(`Versão: ${saida('git', ['log', '-1', '--format=%h %s'], { cwd: CLONE })}`);
    compose(['ps']);
  },
  parar: () => compose(['stop']),
};

const cmd = comandos[process.argv[2]];
if (!cmd) falhar(`Uso: node scripts/homologacao.mjs <${Object.keys(comandos).join('|')}>`);
cmd();
