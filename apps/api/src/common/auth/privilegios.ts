import { HttpStatus } from '@nestjs/common';
import type { Permission } from '@metabi/shared';
import { ApiException } from '../errors.js';
import type { UsuarioAutenticado } from './types.js';

/** Permissões que dão poder administrativo: só um Admin pode concedê-las a um papel. */
export const PERMISSOES_ADMINISTRATIVAS: readonly Permission[] = ['users.manage', 'audit.view'];

export const ehAdmin = (u: UsuarioAutenticado) => u.papel.chave === 'admin';

export function exigirAdmin(u: UsuarioAutenticado, motivo: string): void {
  if (!ehAdmin(u)) throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', motivo);
}

/** Ações que valem para a base inteira (importação, metas) exigem escopo "todos". */
export function exigirEscopoTodos(u: UsuarioAutenticado): void {
  if (u.escopo.tipo !== 'todos') {
    throw new ApiException(
      HttpStatus.FORBIDDEN,
      'FORBIDDEN',
      'Esta ação exige acesso a todos os dados (escopo "todos").',
    );
  }
}
