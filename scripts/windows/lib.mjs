// Funções comuns aos scripts de produção no Windows Server (sem Docker). Ver docs/operacao/deploy-windows.md.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline';
import { parseEnv } from 'node:util';

export const REPO = path.resolve(import.meta.dirname, '../..');
export const ARQUIVO_ENV = path.join(REPO, '.env');
/** Tudo o que não é código fica fora do repositório: binários, logs, backups, uploads e o site publicado. */
export const DADOS = path.resolve(process.env.METABI_DADOS ?? 'C:/metabi-dados');
export const PASTAS = {
  bin: path.join(DADOS, 'bin'),
  servicos: path.join(DADOS, 'servicos'),
  caddy: path.join(DADOS, 'caddy'),
  logs: path.join(DADOS, 'logs'),
  backups: path.join(DADOS, 'backups'),
  uploads: path.join(DADOS, 'uploads'),
  segredos: path.join(DADOS, 'segredos'),
  site: path.join(DADOS, 'site'),
};

/**
 * node.exe real (sem atalhos). Com gerenciador de versões (nvm-windows), process.execPath aponta para um atalho
 * que muda ao trocar de versão; o serviço e o backup ficam presos à versão usada na instalação.
 */
export const NODE_EXE = fs.realpathSync(process.execPath);

export function exigirNode24() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 24) falhar(`Este projeto usa Node 24 (agora: ${process.version}). Com nvm-windows: nvm use 24`);
}

export const SERVICO_API = 'metabi-api';
export const SERVICO_WEB = 'metabi-web';
export const PORTA_API = 4318;
export const PORTA_IMPRESSAO = 34829;

// Versões fixas e conferidas (Caddy: sha512 do checksums.txt oficial; WinSW: sha256 do binário do release).
export const FERRAMENTAS = {
  caddy: {
    url: 'https://github.com/caddyserver/caddy/releases/download/v2.11.7/caddy_2.11.7_windows_amd64.zip',
    algoritmo: 'sha512',
    hash: 'c308154504e53755958ffc62d8a2657ab17eefd6dd25c45dbb2c3d93d29519971f77ca652f7d0f2bcb7f980b9ba3822478865e29969d0272d7613550a43152b1',
  },
  winsw: {
    url: 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe',
    algoritmo: 'sha256',
    hash: '05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da',
  },
};

export function falhar(msg) {
  console.error(`\nERRO: ${msg}`);
  process.exit(1);
}

export function passo(msg) {
  console.log(`\n==> ${msg}`);
}

/** Roda um programa mostrando a saída. `pnpm` é um .cmd no Windows e precisa de shell. */
export function rodar(
  cmd,
  args,
  { cwd = REPO, env, entrada, permitirFalha = false, silencioso = false } = {},
) {
  const r = spawnSync(cmd, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    stdio: [entrada ?? 'inherit', silencioso ? 'pipe' : 'inherit', silencioso ? 'pipe' : 'inherit'],
    shell: cmd === 'pnpm',
    encoding: 'utf8',
  });
  if (r.status !== 0 && !permitirFalha) falhar(`Falhou: ${cmd} ${args.join(' ')} (detalhes acima).`);
  return r;
}

export function pnpm(args, opts) {
  return rodar('pnpm', args, opts);
}

export function exigirWindowsAdmin() {
  if (process.platform !== 'win32') falhar('Este script é para o servidor Windows.');
  const r = spawnSync('net', ['session'], { stdio: 'ignore' });
  if (r.status !== 0) falhar('Abra o Prompt de Comando como Administrador e rode de novo.');
}

export function lerEnv() {
  if (!fs.existsSync(ARQUIVO_ENV)) falhar(`Não achei ${ARQUIVO_ENV}. Rode antes: pnpm windows:instalar`);
  return parseEnv(fs.readFileSync(ARQUIVO_ENV, 'utf8'));
}

/** Variáveis libpq (PGHOST, PGPASSWORD...) a partir de uma URL: a senha não aparece na linha de comando. */
export function envPostgres(url) {
  const u = new URL(url);
  const env = {
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
  };
  const sslmode = u.searchParams.get('sslmode');
  if (sslmode) env.PGSSLMODE = sslmode;
  const channel = u.searchParams.get('channel_binding');
  if (channel) env.PGCHANNELBINDING = channel;
  const options = u.searchParams.get('options');
  if (options) env.PGOPTIONS = options;
  return env;
}

/** Pasta bin do PostgreSQL (psql, pg_dump...): METABI_PG_BIN no .env ou a versão mais nova instalada. */
export function pastaPostgres(env = {}) {
  if (env.METABI_PG_BIN && fs.existsSync(path.join(env.METABI_PG_BIN, 'psql.exe'))) return env.METABI_PG_BIN;
  const base = 'C:/Program Files/PostgreSQL';
  const versoes = fs.existsSync(base)
    ? fs
        .readdirSync(base)
        .filter((v) => fs.existsSync(path.join(base, v, 'bin', 'psql.exe')))
        .sort((a, b) => Number.parseFloat(b) - Number.parseFloat(a))
    : [];
  return versoes.length ? path.join(base, versoes[0], 'bin') : null;
}

export function pg(env, programa) {
  const bin = pastaPostgres(env);
  if (!bin) falhar('PostgreSQL não encontrado. Instale-o (ver TUTORIAL-SERVIDOR-WINDOWS.md).');
  return path.join(bin, `${programa}.exe`);
}

/** Nome do serviço do PostgreSQL instalado (ex.: postgresql-x64-17). */
export function servicoPostgres() {
  const r = spawnSync('sc', ['query', 'state=', 'all'], { encoding: 'utf8' });
  const nomes = [...(r.stdout ?? '').matchAll(/SERVICE_NAME:\s*(postgresql\S*)/gi)].map((m) => m[1]);
  return nomes.sort().at(-1) ?? null;
}

export function caminhoChrome() {
  return (
    [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ].find((p) => fs.existsSync(p)) ?? null
  );
}

export function servicoExiste(id) {
  return spawnSync('sc', ['query', id], { stdio: 'ignore' }).status === 0;
}

/** Comandos do WinSW (install, uninstall, start, stop, restart, status) para um serviço do MetaBI. */
export function servico(id, acao, { permitirFalha = false } = {}) {
  const exe = path.join(PASTAS.servicos, `${id}.exe`);
  if (!fs.existsSync(exe)) {
    if (permitirFalha) return null;
    falhar(`Serviço ${id} não instalado. Rode: pnpm windows:instalar`);
  }
  return rodar(exe, [acao], { permitirFalha });
}

export function portaLivre(porta, host = '0.0.0.0') {
  return new Promise((ok) => {
    const s = net.createServer();
    s.once('error', () => ok(false));
    s.once('listening', () => s.close(() => ok(true)));
    s.listen(porta, host);
  });
}

export async function baixar({ url, algoritmo, hash }, destino) {
  if (fs.existsSync(destino) && hashArquivo(destino, algoritmo) === hash) return;
  console.log(`Baixando ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) falhar(`Download falhou (${resp.status}): ${url}`);
  const dados = Buffer.from(await resp.arrayBuffer());
  const obtido = createHash(algoritmo).update(dados).digest('hex');
  if (obtido !== hash) falhar(`Arquivo baixado com hash diferente do esperado: ${url}. Nada foi instalado.`);
  fs.writeFileSync(destino, dados);
}

function hashArquivo(arquivo, algoritmo) {
  return createHash(algoritmo).update(fs.readFileSync(arquivo)).digest('hex');
}

/** Pergunta no terminal. Com `oculto`, não mostra o que é digitado (senhas). */
export function perguntar(texto, { padrao = '', oculto = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const rotulo = padrao ? `${texto} [${padrao}]: ` : `${texto}: `;
  if (oculto) {
    rl._writeToOutput = (s) => {
      if (s.startsWith(rotulo)) rl.output.write(rotulo);
      else if (s.includes('\n') || s.includes('\r')) rl.output.write('\n');
    };
  }
  return new Promise((ok) =>
    rl.question(rotulo, (resp) => {
      rl.close();
      ok(resp.trim() || padrao);
    }),
  );
}

/** Portas que precisam estar abertas para fora: HTTPS por domínio usa 80 e 443; HTTP usa a porta escolhida. */
export function portasPublicas(env) {
  const m = /^:(\d+)$/.exec(env.SITE_ADDRESS ?? '');
  return m ? [Number(m[1])] : [80, 443];
}

/** Só Administradores e o sistema leem o arquivo (o .env tem as senhas). */
export function restringirAcesso(caminho) {
  rodar('icacls', [caminho, '/inheritance:r', '/grant:r', '*S-1-5-32-544:F', '*S-1-5-18:F'], {
    silencioso: true,
  });
}

export function carimbo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** pg_dump do banco local (formato custom) para a pasta de backups. Devolve o caminho do arquivo. */
export function backupLocal(env, prefixo = 'metabi') {
  fs.mkdirSync(PASTAS.backups, { recursive: true });
  const arquivo = path.join(PASTAS.backups, `${prefixo}-${carimbo()}.dump`);
  rodar(pg(env, 'pg_dump'), ['-Fc', '--no-owner', '--no-acl', '-f', arquivo], {
    env: envPostgres(env.DATABASE_URL),
  });
  return arquivo;
}
