import type { Permission } from '@metabi/shared';
import { describe, expect, it } from 'vitest';
import { type Novidade, NOVIDADES, novidadesNaoVistas, novidadesVisiveis } from './novidades';

const n = (id: string, extra: Partial<Novidade> = {}): Novidade => ({
  id,
  data: id.slice(0, 10),
  titulo: id,
  texto: '',
  ...extra,
});
const lista = [
  n('2026-10-13-1', { permissao: 'faturamento-analise.view', exigeEscopoTodos: true }),
  n('2026-10-13-2', { permissao: 'audit.view' }),
  n('2026-10-01-1'),
];
const perms = (...p: Permission[]) => new Set<Permission>(p);

describe('novidadesVisiveis', () => {
  it('sem permissão não vê a novidade daquela tela; a sem permissão aparece para todos', () => {
    const v = novidadesVisiveis(lista, { permissoes: perms('dashboard.view'), escopoTipo: 'todos' });
    expect(v.map((x) => x.id)).toEqual(['2026-10-01-1']);
  });

  it('com a permissão mas escopo parcial não vê a que exige escopo "todos"', () => {
    const v = novidadesVisiveis(lista, {
      permissoes: perms('faturamento-analise.view', 'audit.view'),
      escopoTipo: 'representantes',
    });
    expect(v.map((x) => x.id)).toEqual(['2026-10-13-2', '2026-10-01-1']);
  });
});

describe('novidadesNaoVistas', () => {
  it('sem nada visto, todas; depois, só as de id maior que a última vista', () => {
    expect(novidadesNaoVistas(lista, null)).toHaveLength(3);
    expect(novidadesNaoVistas(lista, '2026-10-01-1').map((x) => x.id)).toEqual([
      '2026-10-13-1',
      '2026-10-13-2',
    ]);
    expect(novidadesNaoVistas(lista, '2026-10-13-2')).toEqual([]);
  });
});

describe('NOVIDADES', () => {
  it('ids únicos, no formato AAAA-MM-DD-n, da mais recente para a mais antiga', () => {
    const ids = NOVIDADES.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-\d+$/);
    expect([...NOVIDADES].sort((a, b) => b.data.localeCompare(a.data)).map((x) => x.data)).toEqual(
      NOVIDADES.map((x) => x.data),
    );
  });
});
