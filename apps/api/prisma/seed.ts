// Seed idempotente: papéis padrão + um usuário de cada papel (só fora de produção).
// Senha inicial: SEED_SENHA_INICIAL ou aleatória (exibida uma vez). Troca obrigatória no 1º acesso,
// exceto com SEED_TROCAR_SENHA=false (usado pelos testes E2E).
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { DEFAULT_ROLES, ROLE_KEYS, type RoleKey } from '@metabi/shared';
import { PrismaClient, type EscopoTipo } from '../src/generated/prisma/client.js';

const envFile = path.resolve(import.meta.dirname, '../../../.env');
if (fs.existsSync(envFile) && !process.env.DATABASE_URL) process.loadEnvFile(envFile);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const USUARIOS: { email: string; nome: string; papel: RoleKey; escopo: EscopoTipo }[] = [
  { email: 'admin@metahospitalar.com.br', nome: 'Administrador', papel: 'admin', escopo: 'TODOS' },
  {
    email: 'gestor@metahospitalar.com.br',
    nome: 'Gestor Comercial',
    papel: 'gestor-comercial',
    escopo: 'TODOS',
  },
  {
    email: 'representante@metahospitalar.com.br',
    nome: 'Representante Teste',
    papel: 'representante',
    escopo: 'REPRESENTANTES',
  },
  {
    email: 'visualizador@metahospitalar.com.br',
    nome: 'Visualizador',
    papel: 'visualizador',
    escopo: 'TODOS',
  },
];

async function main() {
  for (const chave of ROLE_KEYS) {
    const def = DEFAULT_ROLES[chave];
    const role = await prisma.role.upsert({
      where: { chave },
      update: {},
      create: { chave, nome: def.nome, sistema: true },
    });
    // Só cria as permissões padrão de papéis recém-criados: edições feitas na UI são preservadas.
    const existentes = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (existentes === 0) {
      await prisma.rolePermission.createMany({
        data: def.permissoes.map((permissao) => ({ roleId: role.id, permissao })),
      });
    }
  }

  if (process.env.NODE_ENV === 'production') {
    console.log('Produção: papéis criados; usuários de exemplo não são criados.');
    return;
  }

  const informada = process.env.SEED_SENHA_INICIAL;
  const senha = informada ?? `Meta${randomBytes(9).toString('base64url')}1`;
  // SEED_TROCAR_SENHA: "true" (padrão), "false" ou lista de e-mails que devem trocar a senha (E2E).
  const cfgTroca = process.env.SEED_TROCAR_SENHA ?? 'true';
  const precisaTrocar = (email: string) =>
    cfgTroca.includes('@')
      ? cfgTroca
          .split(',')
          .map((e) => e.trim())
          .includes(email)
      : cfgTroca !== 'false';
  const senhaHash = await argon2.hash(senha, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  let criados = 0;
  for (const u of USUARIOS) {
    const role = await prisma.role.findUniqueOrThrow({ where: { chave: u.papel } });
    const existe = await prisma.usuario.findUnique({ where: { email: u.email } });
    if (existe) continue;
    await prisma.usuario.create({
      data: {
        email: u.email,
        nome: u.nome,
        roleId: role.id,
        senhaHash,
        trocarSenha: precisaTrocar(u.email),
        escopoTipo: u.escopo,
      },
    });
    criados++;
  }

  if (criados === 0) {
    console.log('Usuários de exemplo já existiam — nada alterado.');
  } else if (informada) {
    console.log(`${criados} usuário(s) criado(s) com a senha de SEED_SENHA_INICIAL.`);
  } else {
    console.log(`${criados} usuário(s) criado(s): ${USUARIOS.map((u) => u.email).join(', ')}`);
    console.log(`Senha provisória (exibida só agora; troca obrigatória no 1º acesso): ${senha}`);
  }
}

await main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
