// Etapas usadas pela instalação e pela atualização no Windows Server: compilar, migrar, publicar o site e
// gerar o Caddyfile.
import fs from 'node:fs';
import path from 'node:path';
import { hashesScriptsEmbutidos } from '../../apps/web/scripts/csp.mjs';
import { PASTAS, PORTA_API, PORTA_IMPRESSAO, REPO, passo, pnpm, falhar } from './lib.mjs';

const SAIDA_WEB = path.join(REPO, 'apps/web/.output/public');

export function instalarDependencias() {
  passo('Instalando dependências (pnpm install)');
  pnpm(['install', '--frozen-lockfile']);
}

export function compilar() {
  passo('Compilando pacote compartilhado, API e site');
  pnpm(['--filter', '@metabi/shared', 'build']);
  pnpm(['--filter', 'api', 'build']);
  // Variável vazia: sem faixa de "homologação" nas telas.
  pnpm(['--filter', 'web', 'exec', 'nuxt', 'generate'], { env: { NUXT_PUBLIC_AMBIENTE: '' } });
  if (!fs.existsSync(path.join(SAIDA_WEB, 'index.html'))) falhar('O build do site não gerou index.html.');
}

export function migrar() {
  passo('Aplicando migrations do banco');
  pnpm(['--filter', 'api', 'exec', 'prisma', 'migrate', 'deploy']);
}

/** Papéis padrão. Em produção o seed não cria usuários; é idempotente. */
export function seedPapeis() {
  passo('Criando papéis padrão (seed)');
  pnpm(['--filter', 'api', 'exec', 'tsx', 'prisma/seed.ts'], { env: { NODE_ENV: 'production' } });
}

/** Troca o site publicado pelo build novo de uma vez (o Caddy serve de PASTAS.site). */
export function publicarSite() {
  passo(`Publicando o site em ${PASTAS.site}`);
  const novo = `${PASTAS.site}-novo`;
  const antigo = `${PASTAS.site}-anterior`;
  fs.rmSync(novo, { recursive: true, force: true });
  fs.cpSync(SAIDA_WEB, novo, { recursive: true });
  fs.rmSync(antigo, { recursive: true, force: true });
  if (fs.existsSync(PASTAS.site)) fs.renameSync(PASTAS.site, antigo);
  fs.renameSync(novo, PASTAS.site);
}

/** Gera o Caddyfile a partir do modelo. Devolve true se o arquivo mudou (o serviço web precisa reiniciar). */
export function gerarCaddyfile(env) {
  if (!env.SITE_ADDRESS) falhar('SITE_ADDRESS não está no .env.');
  const modelo = fs.readFileSync(path.join(import.meta.dirname, 'Caddyfile.modelo'), 'utf8');
  const barra = (p) => p.replaceAll('\\', '/');
  const conteudo = modelo
    .replace('__SITE_ADDRESS__', env.SITE_ADDRESS)
    .replace('__CSP_SCRIPT_HASHES__', hashesScriptsEmbutidos(PASTAS.site).join(' '))
    .replaceAll('__API__', `127.0.0.1:${PORTA_API}`)
    .replaceAll('__SITE__', barra(PASTAS.site))
    .replaceAll('__PORTA_IMPRESSAO__', String(PORTA_IMPRESSAO));
  const arquivo = path.join(PASTAS.caddy, 'Caddyfile');
  fs.mkdirSync(PASTAS.caddy, { recursive: true });
  const anterior = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf8') : '';
  fs.writeFileSync(arquivo, conteudo);
  return anterior !== conteudo;
}
