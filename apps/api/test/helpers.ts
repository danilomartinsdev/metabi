import { DEFAULT_ROLES, type RoleKey } from '@meta-bi/shared';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import argon2 from 'argon2';
import { prepararEnvDeTeste } from './env-test.js';

prepararEnvDeTeste();

// Imports dinâmicos: o env de teste precisa estar pronto antes de carregar a aplicação.
const { AppModule } = await import('../src/app.module.js');
const { configurarApp, criarAdapter } = await import('../src/app.factory.js');
const { loadEnv } = await import('../src/config/env.js');
const { MailService } = await import('../src/modules/mail/mail.service.js');
const { PrismaService } = await import('../src/prisma/prisma.service.js');

export type Email = { para: string; assunto: string; texto: string; html: string };

export interface Contexto {
  app: NestFastifyApplication;
  prisma: InstanceType<typeof PrismaService>;
  emails: Email[];
}

export const SENHA = 'SenhaForte123';

export async function iniciarApp(): Promise<Contexto> {
  const emails: Email[] = [];
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue({ enviar: async (e: Email) => void emails.push(e) })
    .compile();
  const env = loadEnv();
  const app = modulo.createNestApplication<NestFastifyApplication>(criarAdapter(env), { logger: false });
  await configurarApp(app, env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, prisma: app.get(PrismaService), emails };
}

/** Limpa as tabelas e recria os papéis padrão. */
export async function limparBanco(prisma: Contexto['prisma']) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE "AuditLog", "Sessao", "TokenRedefinicaoSenha", "TokenImpressao", "UsuarioRepresentante",
             "ImportLoteItem", "Pedido", "ImportLote", "Meta", "Usuario", "RolePermission", "Role",
             "Representante", "Cliente", "StatusPdv", "FaturamentoHistorico", "FaturamentoManual", "FaturamentoDia",
             "FaturamentoLote", "ArquivoTemporario" RESTART IDENTITY CASCADE`);
  for (const [chave, def] of Object.entries(DEFAULT_ROLES)) {
    await prisma.role.create({
      data: {
        chave,
        nome: def.nome,
        sistema: true,
        permissoes: { create: def.permissoes.map((permissao) => ({ permissao })) },
      },
    });
  }
}

let hashCache: string | undefined;

export async function criarUsuario(
  prisma: Contexto['prisma'],
  opts: { email: string; papel?: RoleKey; trocarSenha?: boolean; ativo?: boolean },
) {
  hashCache ??= await argon2.hash(SENHA, { type: argon2.argon2id });
  const role = await prisma.role.findUniqueOrThrow({ where: { chave: opts.papel ?? 'admin' } });
  return prisma.usuario.create({
    data: {
      email: opts.email,
      nome: 'Usuário Teste',
      roleId: role.id,
      senhaHash: hashCache,
      trocarSenha: opts.trocarSenha ?? false,
      ativo: opts.ativo ?? true,
      escopoTipo: 'TODOS',
    },
  });
}

/** Extrai o refresh token do header Set-Cookie. */
export function cookieRefresh(setCookie: string | string[] | undefined): string | undefined {
  const lista = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const c = lista.find((v) => v.startsWith('mb_rt='));
  const valor = c?.split(';')[0]?.slice('mb_rt='.length);
  return valor || undefined;
}

export async function login(app: NestFastifyApplication, email: string, senha = SENHA) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, senha } });
  return { res, body: res.json(), refresh: cookieRefresh(res.headers['set-cookie']) };
}
