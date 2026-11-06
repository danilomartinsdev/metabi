#!/usr/bin/env node
// Situação do MetaBI no servidor Windows: serviços, API, site e último backup.   pnpm windows:status
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PASTAS, PORTA_API, SERVICO_API, SERVICO_WEB, lerEnv, servicoPostgres } from './lib.mjs';

const env = lerEnv();
const estado = (id) => {
  if (!id) return 'não encontrado';
  const r = spawnSync('sc', ['query', id], { encoding: 'utf8' });
  return /STATE\s*:\s*\d+\s+(\w+)/.exec(r.stdout ?? '')?.[1] ?? 'não instalado';
};
const responde = (url) =>
  fetch(url, { signal: AbortSignal.timeout(5000) })
    .then((r) => `HTTP ${r.status}`)
    .catch((e) => `sem resposta (${e.cause?.code ?? e.message})`);

const pgServico = servicoPostgres();
console.log(`Serviços
  ${pgServico ?? 'postgresql'}: ${estado(pgServico)}
  ${SERVICO_API}: ${estado(SERVICO_API)}
  ${SERVICO_WEB}: ${estado(SERVICO_WEB)}

Conferência
  API (${PORTA_API}/api/health): ${await responde(`http://127.0.0.1:${PORTA_API}/api/health`)}
  Site (${env.WEB_ORIGIN}): ${await responde(env.WEB_ORIGIN)}`);

const backups = fs.existsSync(PASTAS.backups)
  ? fs
      .readdirSync(PASTAS.backups)
      .filter((f) => f.startsWith('metabi-') && f.endsWith('.dump'))
      .sort()
  : [];
console.log(`\nÚltimo backup diário: ${backups.at(-1) ?? 'nenhum ainda'}`);
console.log(
  `Logs: ${path.join(PASTAS.logs, `${SERVICO_API}.err.log`)} (API) e ${SERVICO_WEB}.err.log (site)`,
);
