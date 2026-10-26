#!/usr/bin/env node
// Instala (ou reinstala) o MetaBI num Windows Server sem Docker. Ver TUTORIAL-SERVIDOR-WINDOWS.md.
//
//   pnpm windows:instalar      (Prompt de Comando como Administrador, na pasta do projeto)
//
// Pré-requisitos instalados à mão: Node 24, PostgreSQL e Google Chrome. O script cuida do resto:
// .env de produção, banco e usuário, Caddy + WinSW, build, migrations, serviços do Windows, firewall
// e backup diário. Pode rodar de novo: o que já existe é mantido (o .env nunca é sobrescrito).
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ARQUIVO_ENV,
  DADOS,
  FERRAMENTAS,
  PASTAS,
  PORTA_API,
  PORTA_IMPRESSAO,
  SERVICO_API,
  SERVICO_WEB,
  baixar,
  caminhoChrome,
  envPostgres,
  exigirWindowsAdmin,
  falhar,
  lerEnv,
  passo,
  pastaPostgres,
  perguntar,
  pg,
  portaLivre,
  portasPublicas,
  restringirAcesso,
  rodar,
  servico,
  servicoExiste,
  servicoPostgres,
} from './lib.mjs';
import {
  compilar,
  gerarCaddyfile,
  instalarDependencias,
  migrar,
  publicarSite,
  seedPapeis,
} from './etapas.mjs';

exigirWindowsAdmin();
if (Number(process.versions.node.split('.')[0]) < 24) falhar('Instale o Node 24 (LTS).');

passo('Conferindo pré-requisitos');
const pgBin = pastaPostgres();
if (!pgBin) falhar('PostgreSQL não encontrado em C:\\Program Files\\PostgreSQL. Instale-o antes.');
const pgServico = servicoPostgres();
if (!pgServico) falhar('Serviço do PostgreSQL não encontrado (sc query). A instalação do Postgres terminou?');
const chrome = caminhoChrome();
if (!chrome) falhar('Google Chrome não encontrado (usado para gerar os PDFs). Instale-o antes.');
console.log(`PostgreSQL: ${pgBin} (serviço ${pgServico})\nChrome: ${chrome}\nDados: ${DADOS}`);

for (const pasta of Object.values(PASTAS)) fs.mkdirSync(pasta, { recursive: true });
restringirAcesso(PASTAS.segredos);

// 1. .env de produção
if (fs.existsSync(ARQUIVO_ENV)) {
  console.log('\n.env já existe: mantido como está.');
} else {
  passo('Criando o .env de produção');
  console.log('Endereço que os usuários vão abrir no navegador. Exemplos:');
  console.log('  https://bi.metahospitalar.com.br   (HTTPS automático; o domínio precisa apontar para');
  console.log('                                      este servidor e as portas 80/443 estarem livres)');
  console.log('  http://desenvmeta.ddns.com.br:34827  (só HTTP, numa porta própria)');
  const endereco = await perguntar('Endereço');
  let u;
  try {
    u = new URL(endereco);
  } catch {
    falhar(`Endereço inválido: ${endereco}`);
  }
  let site;
  const https = u.protocol === 'https:';
  if (https) {
    if (u.port)
      falhar('Para HTTPS automático use o endereço sem porta (o certificado precisa das portas 80/443).');
    site = u.hostname;
  } else if (u.protocol === 'http:') {
    site = `:${u.port || 80}`;
  } else {
    falhar('O endereço deve começar com http:// ou https://');
  }
  const pgPorta = await perguntar('Porta do PostgreSQL', { padrao: '5432' });
  const senhaBanco = randomBytes(24).toString('base64url');
  const conteudo = `# .env de produção do servidor Windows, gerado por pnpm windows:instalar em ${new Date().toISOString()}.
# Nunca commite este arquivo. Depois de alterar, rode: pnpm windows:atualizar
NODE_ENV=production
TZ=America/Sao_Paulo

# Endereço público
WEB_ORIGIN=${u.origin}
APP_URL=${u.origin}
SITE_ADDRESS=${site}
COOKIE_SECURE=${https}
# Só HTTP: senhas e sessões trafegam sem criptografia. Prefira HTTPS com domínio.
PERMITIR_HTTP=${!https}

# Banco (PostgreSQL instalado no Windows)
POSTGRES_USER=metabi
POSTGRES_PASSWORD=${senhaBanco}
POSTGRES_DB=metabi
DATABASE_URL=postgresql://metabi:${senhaBanco}@127.0.0.1:${pgPorta}/metabi?schema=public

# API (só escuta nesta máquina; o Caddy publica /api)
API_HOST=127.0.0.1
API_PORT=${PORTA_API}
JWT_ACCESS_SECRET=${randomBytes(48).toString('base64url')}

# E-mail ("esqueci minha senha"): copie os valores usados na Vercel.
SMTP_HOST=127.0.0.1
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="BI Metahospitalar <no-reply@metahospitalar.com.br>"

# Arquivos e PDF
UPLOAD_DIR=${PASTAS.uploads.replaceAll('\\', '/')}
PRINT_BASE_URL=http://127.0.0.1:${PORTA_IMPRESSAO}
PDF_CHROMIUM_PATH=${chrome}

# Usado só pelos scripts do Windows
METABI_PG_BIN=${pgBin.replaceAll('\\', '/')}
`;
  fs.writeFileSync(ARQUIVO_ENV, conteudo);
  console.log(`.env criado com senhas aleatórias em ${ARQUIVO_ENV}`);
}
restringirAcesso(ARQUIVO_ENV);
const env = lerEnv();

// 2. Usuário e banco no PostgreSQL
passo('Conferindo o banco');
const conecta = rodar(pg(env, 'psql'), ['-tAc', 'SELECT 1'], {
  env: envPostgres(env.DATABASE_URL),
  permitirFalha: true,
  silencioso: true,
});
if (conecta.status === 0) {
  console.log('Banco metabi acessível.');
} else {
  console.log('Vou criar o usuário e o banco "metabi" no PostgreSQL.');
  const senhaPostgres = await perguntar('Senha do usuário "postgres" (definida na instalação do Postgres)', {
    oculto: true,
  });
  const alvo = new URL(env.DATABASE_URL);
  const usuario = decodeURIComponent(alvo.username);
  const banco = alvo.pathname.slice(1);
  const senha = decodeURIComponent(alvo.password);
  if (!/^[a-z_][a-z0-9_]*$/.test(usuario) || !/^[a-z_][a-z0-9_]*$/.test(banco)) {
    falhar('Usuário e banco do DATABASE_URL devem ter só letras minúsculas, números e _.');
  }
  const superEnv = {
    ...envPostgres(env.DATABASE_URL),
    PGUSER: 'postgres',
    PGPASSWORD: senhaPostgres,
    PGDATABASE: 'postgres',
  };
  // SQL pela entrada padrão: a senha não aparece na lista de processos.
  const sqlArquivo = path.join(PASTAS.segredos, 'criar-banco.sql');
  const literal = `'${senha.replaceAll("'", "''")}'`;
  fs.writeFileSync(
    sqlArquivo,
    `DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = '${usuario}') THEN
    ALTER ROLE ${usuario} LOGIN PASSWORD ${literal};
  ELSE
    CREATE ROLE ${usuario} LOGIN PASSWORD ${literal};
  END IF;
END $$;
SELECT 'CREATE DATABASE ${banco} OWNER ${usuario} ENCODING ''UTF8'' TEMPLATE template0'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${banco}')\\gexec
`,
  );
  try {
    rodar(pg(env, 'psql'), ['-v', 'ON_ERROR_STOP=1', '-q', '-f', sqlArquivo], { env: superEnv });
  } finally {
    fs.rmSync(sqlArquivo, { force: true });
  }
  rodar(pg(env, 'psql'), ['-v', 'ON_ERROR_STOP=1', '-q', '-c', `GRANT ALL ON SCHEMA public TO ${usuario}`], {
    env: { ...superEnv, PGDATABASE: banco },
  });
  console.log(`Usuário e banco "${banco}" prontos.`);
}

// 3. Caddy (site + HTTPS) e WinSW (serviços do Windows)
passo('Baixando Caddy e WinSW (versões fixas, hash conferido)');
const caddyZip = path.join(PASTAS.bin, 'caddy.zip');
await baixar(FERRAMENTAS.caddy, caddyZip);
const winsw = path.join(PASTAS.bin, 'WinSW-x64.exe');
await baixar(FERRAMENTAS.winsw, winsw);

// 4. Reinstalação: para os serviços antes de trocar caddy.exe e node_modules (o Windows trava arquivos em uso)
const reinstalacao = servicoExiste(SERVICO_WEB);
for (const id of [SERVICO_API, SERVICO_WEB]) {
  if (servicoExiste(id)) servico(id, 'stop', { permitirFalha: true });
}
// tar do Windows (bsdtar), que abre .zip — o do Git não abre.
const tar = path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'tar.exe');
rodar(tar, ['-xf', caddyZip, '-C', PASTAS.bin, 'caddy.exe']);

if (!reinstalacao) {
  passo('Conferindo portas livres');
  const portas = [
    ...portasPublicas(env).map((p) => [p, '0.0.0.0']),
    [PORTA_IMPRESSAO, '127.0.0.1'],
    [PORTA_API, '127.0.0.1'],
  ];
  for (const [porta, host] of portas) {
    if (!(await portaLivre(porta, host))) {
      falhar(
        `A porta ${porta} já está em uso por outro programa (veja com: netstat -ano | findstr :${porta}). ` +
          'Escolha outro endereço/porta no .env (SITE_ADDRESS, WEB_ORIGIN e APP_URL) ou libere a porta.',
      );
    }
  }
}

// 5. Build, banco e site
instalarDependencias();
compilar();
migrar();
seedPapeis();
publicarSite();
gerarCaddyfile(env);

// 6. Serviços do Windows
passo('Registrando os serviços do Windows');
const xml = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const log = `<logpath>${xml(PASTAS.logs)}</logpath>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>8</keepFiles></log>
  <onfailure action="restart" delay="10 sec"/>
  <onfailure action="restart" delay="30 sec"/>
  <startmode>Automatic</startmode>`;
const definicoes = {
  [SERVICO_API]: `<service>
  <id>${SERVICO_API}</id>
  <name>MetaBI API</name>
  <description>API do MetaBI (NestJS). Instalado por pnpm windows:instalar.</description>
  <executable>${xml(process.execPath)}</executable>
  <arguments>--env-file="${xml(ARQUIVO_ENV)}" dist\\main.js</arguments>
  <workingdirectory>${xml(path.join(path.dirname(ARQUIVO_ENV), 'apps', 'api'))}</workingdirectory>
  <depend>${xml(pgServico)}</depend>
  ${log}
</service>
`,
  [SERVICO_WEB]: `<service>
  <id>${SERVICO_WEB}</id>
  <name>MetaBI Web (Caddy)</name>
  <description>Site do MetaBI, HTTPS e proxy de /api. Instalado por pnpm windows:instalar.</description>
  <executable>${xml(path.join(PASTAS.bin, 'caddy.exe'))}</executable>
  <arguments>run --config "${xml(path.join(PASTAS.caddy, 'Caddyfile'))}" --adapter caddyfile</arguments>
  <workingdirectory>${xml(PASTAS.caddy)}</workingdirectory>
  <env name="XDG_DATA_HOME" value="${xml(path.join(PASTAS.caddy, 'data'))}"/>
  <env name="XDG_CONFIG_HOME" value="${xml(path.join(PASTAS.caddy, 'config'))}"/>
  ${log}
</service>
`,
};
for (const [id, def] of Object.entries(definicoes)) {
  if (servicoExiste(id)) {
    servico(id, 'stop', { permitirFalha: true });
    servico(id, 'uninstall');
  }
  fs.copyFileSync(winsw, path.join(PASTAS.servicos, `${id}.exe`));
  fs.writeFileSync(path.join(PASTAS.servicos, `${id}.xml`), def);
  servico(id, 'install');
}
servico(SERVICO_API, 'start');
servico(SERVICO_WEB, 'start');

// 7. Firewall do Windows (o Security Group da AWS é liberado no console)
passo('Liberando portas no firewall do Windows');
for (const porta of portasPublicas(env)) {
  const nome = `MetaBI-${porta}`;
  const existe = rodar('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${nome}`], {
    permitirFalha: true,
    silencioso: true,
  });
  if (existe.status !== 0) {
    rodar(
      'netsh',
      [
        'advfirewall',
        'firewall',
        'add',
        'rule',
        `name=${nome}`,
        'dir=in',
        'action=allow',
        'protocol=TCP',
        `localport=${porta}`,
      ],
      { silencioso: true },
    );
  }
  console.log(`Porta ${porta} liberada.`);
}

// 8. Backup diário às 02:00
passo('Agendando backup diário do banco (02:00)');
rodar(
  'schtasks',
  [
    '/Create',
    '/F',
    '/TN',
    'MetaBI\\BackupDiario',
    '/SC',
    'DAILY',
    '/ST',
    '02:00',
    '/RU',
    'SYSTEM',
    '/TR',
    `"${process.execPath}" "${path.join(import.meta.dirname, 'backup.mjs')}"`,
  ],
  { silencioso: true },
);

// 9. Conferência
passo('Conferindo a API');
let saude = false;
for (let i = 0; i < 30 && !saude; i++) {
  await new Promise((ok) => setTimeout(ok, 2000));
  saude = await fetch(`http://127.0.0.1:${PORTA_API}/api/health`)
    .then((r) => r.ok)
    .catch(() => false);
}
if (!saude) falhar(`A API não respondeu. Veja o log em ${PASTAS.logs}\\${SERVICO_API}.err.log`);

console.log(`
Pronto! O MetaBI está rodando em ${env.WEB_ORIGIN}

Próximos passos:
  - Libere no Security Group da EC2 a(s) porta(s) TCP: ${portasPublicas(env).join(', ')}
  - Trazer a base da Vercel:  pnpm windows:copiar-neon
    ou começar do zero:       pnpm windows:criar-admin
  - Preencha o SMTP no .env (e rode pnpm windows:atualizar) para o "esqueci minha senha".
  - Situação dos serviços:    pnpm windows:status
`);
