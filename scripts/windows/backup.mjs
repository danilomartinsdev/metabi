#!/usr/bin/env node
// Backup do banco do servidor Windows (pg_dump) com retenção de 30 dias.
// Agendado pelo instalador para 02:00 (Agendador de Tarefas › MetaBI › BackupDiario). Manual: pnpm windows:backup
import fs from 'node:fs';
import path from 'node:path';
import { PASTAS, backupLocal, lerEnv } from './lib.mjs';

const RETENCAO_DIAS = 30;

const arquivo = backupLocal(lerEnv(), 'metabi');
console.log(`Backup: ${arquivo} (${(fs.statSync(arquivo).size / 1e6).toFixed(1)} MB)`);

const limite = Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000;
for (const nome of fs.readdirSync(PASTAS.backups)) {
  const caminho = path.join(PASTAS.backups, nome);
  if (nome.endsWith('.dump') && fs.statSync(caminho).mtimeMs < limite) {
    fs.rmSync(caminho);
    console.log(`Removido (mais de ${RETENCAO_DIAS} dias): ${nome}`);
  }
}
