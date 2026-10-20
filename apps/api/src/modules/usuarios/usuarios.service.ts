import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { EscopoTipo, UsuarioAdmin, UsuarioAtualizar, UsuarioCriar } from '@metabi/shared';
import { ApiException, Erros } from '../../common/errors.js';
import { exigirAdmin } from '../../common/auth/privilegios.js';
import type { ContextoRequisicao, UsuarioAutenticado } from '../../common/auth/types.js';
import type { EscopoTipo as EscopoEnum, Prisma, Regiao } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SenhaService } from '../auth/senha.service.js';
import { SessaoService } from '../auth/sessao.service.js';

const ESCOPO_DB: Record<EscopoTipo, EscopoEnum> = {
  todos: 'TODOS',
  regiao: 'REGIAO',
  representantes: 'REPRESENTANTES',
};
const ESCOPO_API: Record<EscopoEnum, EscopoTipo> = {
  TODOS: 'todos',
  REGIAO: 'regiao',
  REPRESENTANTES: 'representantes',
};

const SELECT = {
  id: true,
  nome: true,
  email: true,
  ativo: true,
  trocarSenha: true,
  bloqueadoAte: true,
  ultimoAcessoEm: true,
  escopoTipo: true,
  escopoRegioes: true,
  role: { select: { id: true, chave: true, nome: true } },
  representantes: { select: { representante: { select: { id: true, nomeExibicao: true } } } },
} satisfies Prisma.UsuarioSelect;

type Linha = Prisma.UsuarioGetPayload<{ select: typeof SELECT }>;

/** Senha provisória forte (troca obrigatória no 1º acesso). Exibida uma única vez ao admin. */
const senhaProvisoria = () => `Meta${randomBytes(9).toString('base64url')}7`;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessoes: SessaoService,
    private readonly senhas: SenhaService,
    private readonly audit: AuditService,
  ) {}

  private paraApi(u: Linha): UsuarioAdmin {
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      ativo: u.ativo,
      trocarSenha: u.trocarSenha,
      bloqueado: !!u.bloqueadoAte && u.bloqueadoAte > new Date(),
      ultimoAcessoEm: u.ultimoAcessoEm?.toISOString() ?? null,
      papel: u.role,
      escopoTipo: ESCOPO_API[u.escopoTipo],
      escopoRegioes: u.escopoRegioes,
      representantes: u.representantes.map((r) => r.representante),
    };
  }

  async listar(): Promise<UsuarioAdmin[]> {
    const us = await this.prisma.usuario.findMany({ select: SELECT, orderBy: { nome: 'asc' } });
    return us.map((u) => this.paraApi(u));
  }

  private async validarReferencias(roleId: string, representanteIds: string[]) {
    if (!(await this.prisma.role.findUnique({ where: { id: roleId }, select: { id: true } }))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Papel inexistente.');
    }
    if (representanteIds.length) {
      const n = await this.prisma.representante.count({ where: { id: { in: representanteIds } } });
      if (n !== new Set(representanteIds).size) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Representante inexistente no escopo.');
      }
    }
  }

  private dadosEscopo(d: { escopoTipo: EscopoTipo; escopoRegioes?: string[]; representanteIds?: string[] }) {
    return {
      escopoTipo: ESCOPO_DB[d.escopoTipo],
      // Só guarda o que vale para o tipo escolhido.
      escopoRegioes: (d.escopoTipo === 'regiao' ? (d.escopoRegioes ?? []) : []) as Regiao[],
      representanteIds: d.escopoTipo === 'representantes' ? [...new Set(d.representanteIds ?? [])] : [],
    };
  }

  /**
   * Evita escalonamento: só um Admin cria/promove/altera Admins. Quem tem users.manage
   * sem ser Admin gerencia apenas usuários que não são Admin e não pode promover ninguém a Admin.
   */
  private async protegerAdmins(alvoId: string | null, novoRoleId: string | null, quem: UsuarioAutenticado) {
    const chaves = await this.prisma.role.findMany({
      where: {
        OR: [
          ...(novoRoleId ? [{ id: novoRoleId }] : []),
          ...(alvoId ? [{ usuarios: { some: { id: alvoId } } }] : []),
        ],
      },
      select: { chave: true },
    });
    if (chaves.some((c) => c.chave === 'admin'))
      exigirAdmin(quem, 'Só um Admin pode criar, promover ou alterar Admins.');
  }

  async criar(d: UsuarioCriar, admin: UsuarioAutenticado, ctx: ContextoRequisicao) {
    await this.protegerAdmins(null, d.roleId, admin);
    const esc = this.dadosEscopo(d);
    await this.validarReferencias(d.roleId, esc.representanteIds);
    if (await this.prisma.usuario.findUnique({ where: { email: d.email }, select: { id: true } })) {
      throw new ApiException(HttpStatus.CONFLICT, 'CONFLICT', 'Já existe um usuário com este e-mail.');
    }
    const senha = senhaProvisoria();
    const u = await this.prisma.usuario.create({
      data: {
        nome: d.nome,
        email: d.email,
        roleId: d.roleId,
        senhaHash: await this.senhas.hash(senha),
        trocarSenha: true,
        escopoTipo: esc.escopoTipo,
        escopoRegioes: esc.escopoRegioes,
        representantes: { create: esc.representanteIds.map((representanteId) => ({ representanteId })) },
      },
      select: SELECT,
    });
    await this.audit.registrar({
      acao: 'usuario.criado',
      usuarioId: admin.id,
      entidade: 'Usuario',
      entidadeId: u.id,
      detalhes: { email: u.email, papel: u.role.chave, escopo: d.escopoTipo },
      ctx,
    });
    return { usuario: this.paraApi(u), senhaProvisoria: senha };
  }

  async atualizar(id: string, d: UsuarioAtualizar, admin: UsuarioAutenticado, ctx: ContextoRequisicao) {
    const atual = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        roleId: true,
        escopoTipo: true,
        escopoRegioes: true,
        role: { select: { chave: true } },
        representantes: { select: { representanteId: true } },
      },
    });
    if (!atual) throw Erros.naoEncontrado();
    const esc = this.dadosEscopo(d);
    const mudouEscopo =
      esc.escopoTipo !== atual.escopoTipo ||
      [...esc.escopoRegioes].sort().join() !== [...atual.escopoRegioes].sort().join() ||
      [...esc.representanteIds].sort().join() !==
        atual.representantes
          .map((r) => r.representanteId)
          .sort()
          .join();
    if (id === admin.id && (d.roleId !== atual.roleId || mudouEscopo)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'Você não pode alterar o próprio papel nem o próprio escopo.',
      );
    }
    await this.protegerAdmins(id, d.roleId, admin);
    await this.validarReferencias(d.roleId, esc.representanteIds);
    const u = await this.prisma.$transaction(async (tx) => {
      await tx.usuarioRepresentante.deleteMany({ where: { usuarioId: id } });
      return tx.usuario.update({
        where: { id },
        data: {
          nome: d.nome,
          roleId: d.roleId,
          escopoTipo: esc.escopoTipo,
          escopoRegioes: esc.escopoRegioes,
          representantes: { create: esc.representanteIds.map((representanteId) => ({ representanteId })) },
        },
        select: SELECT,
      });
    });
    await this.audit.registrar({
      acao: 'usuario.alterado',
      usuarioId: admin.id,
      entidade: 'Usuario',
      entidadeId: id,
      detalhes: {
        antes: {
          papel: atual.role.chave,
          escopo: atual.escopoTipo,
          regioes: atual.escopoRegioes,
          representantes: atual.representantes.map((r) => r.representanteId),
        },
        depois: {
          papel: u.role.chave,
          escopo: esc.escopoTipo,
          regioes: esc.escopoRegioes,
          representantes: esc.representanteIds,
        },
      },
      ctx,
    });
    return this.paraApi(u);
  }

  /** Admin redefine a senha: gera provisória, exige troca e derruba as sessões do usuário. */
  async redefinirSenha(id: string, admin: UsuarioAutenticado, ctx: ContextoRequisicao) {
    await this.existe(id);
    await this.protegerAdmins(id, null, admin);
    const senha = senhaProvisoria();
    await this.prisma.usuario.update({
      where: { id },
      data: {
        senhaHash: await this.senhas.hash(senha),
        trocarSenha: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
      },
    });
    await this.sessoes.revogarTodas(id);
    await this.audit.registrar({
      acao: 'usuario.senha-redefinida',
      usuarioId: admin.id,
      entidade: 'Usuario',
      entidadeId: id,
      ctx,
    });
    return { senhaProvisoria: senha };
  }

  async desativar(id: string, admin: UsuarioAutenticado, ctx: ContextoRequisicao) {
    if (id === admin.id) {
      throw new ApiException(HttpStatus.CONFLICT, 'CONFLICT', 'Você não pode desativar o próprio usuário.');
    }
    await this.existe(id);
    await this.protegerAdmins(id, null, admin);
    await this.prisma.usuario.update({ where: { id }, data: { ativo: false } });
    const sessoes = await this.sessoes.revogarTodas(id);
    await this.audit.registrar({
      acao: 'usuario.desativado',
      usuarioId: admin.id,
      entidade: 'Usuario',
      entidadeId: id,
      detalhes: { sessoesRevogadas: sessoes },
      ctx,
    });
  }

  async reativar(id: string, admin: UsuarioAutenticado, ctx: ContextoRequisicao) {
    await this.existe(id);
    await this.protegerAdmins(id, null, admin);
    await this.prisma.usuario.update({
      where: { id },
      data: { ativo: true, tentativasFalhas: 0, bloqueadoAte: null },
    });
    await this.audit.registrar({
      acao: 'usuario.reativado',
      usuarioId: admin.id,
      entidade: 'Usuario',
      entidadeId: id,
      ctx,
    });
  }

  async derrubarSessoes(id: string, admin: UsuarioAutenticado, ctx: ContextoRequisicao) {
    await this.existe(id);
    await this.protegerAdmins(id, null, admin);
    const sessoes = await this.sessoes.revogarTodas(id);
    await this.audit.registrar({
      acao: 'usuario.sessoes-derrubadas',
      usuarioId: admin.id,
      entidade: 'Usuario',
      entidadeId: id,
      detalhes: { sessoesRevogadas: sessoes },
      ctx,
    });
  }

  private async existe(id: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!u) throw Erros.naoEncontrado();
  }
}
