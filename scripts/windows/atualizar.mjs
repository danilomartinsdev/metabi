#!/usr/bin/env node
// Atualiza o MetaBI no servidor Windows para a versão mais nova da main (ou aplica mudanças do .env).
//
//   pnpm windows:atualizar              (Prompt de Comando como Administrador)
//   pnpm windows:atualizar --sem-git    (não baixa código novo; só recompila e reinicia)
//
// O sistema fica fora do ar por alguns minutos (a API para durante o build). Antes de migrar, faz backup.
import {
  PASTAS,
  REPO,
  SERVICO_API,
  SERVICO_WEB,
  backupLocal,
  exigirNode24,
  exigirWindowsAdmin,
  falhar,
  lerEnv,
  passo,
  rodar,
  servico,
} from './lib.mjs';
import { compilar, gerarCaddyfile, instalarDependencias, migrar, publicarSite } from './etapas.mjs';

exigirWindowsAdmin();
exigirNode24();
const env = lerEnv();
const git = (args, opts) => rodar('git', args, { cwd: REPO, ...opts });
const versaoAnterior = git(['rev-parse', '--short', 'HEAD'], { silencioso: true }).stdout.trim();

if (!process.argv.includes('--sem-git')) {
  passo('Baixando a versão nova (git pull)');
  if (git(['status', '--porcelain', '--untracked-files=no'], { silencioso: true }).stdout.trim()) {
    falhar('Há arquivos do projeto alterados neste servidor (git status). Desfaça-os antes de atualizar.');
  }
  git(['pull', '--ff-only']);
}
const versaoNova = git(['rev-parse', '--short', 'HEAD'], { silencioso: true }).stdout.trim();
console.log(`Versão: ${versaoAnterior} -> ${versaoNova}`);

passo('Backup do banco antes de atualizar');
console.log(`Backup em ${backupLocal(env, 'antes-de-atualizar')}`);

passo('Parando a API');
servico(SERVICO_API, 'stop', { permitirFalha: true });

process.on('exit', (codigo) => {
  if (codigo !== 0) {
    console.error(`
A atualização falhou e a API está parada. Para voltar à versão anterior:
  git checkout ${versaoAnterior}
  pnpm windows:atualizar --sem-git
(depois, para voltar a seguir a main: git checkout main)`);
  }
});

instalarDependencias();
compilar();
migrar();

passo('Iniciando a API');
servico(SERVICO_API, 'start');
publicarSite();
if (gerarCaddyfile(env)) {
  passo('Caddyfile mudou: reiniciando o site');
  servico(SERVICO_WEB, 'restart');
}

console.log(`\nAtualizado para ${versaoNova}. Confira com: pnpm windows:status\nLogs em ${PASTAS.logs}`);
