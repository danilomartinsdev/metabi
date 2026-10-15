import { describe, expect, it } from 'vitest';
import { itemAtivo, paginaInicial } from './navegacao';

const rep = { chave: 'representante' };

describe('paginaInicial', () => {
  it('com a permissão vai para Minhas vendas, qualquer que seja o escopo', () => {
    expect(paginaInicial({ papel: rep, permissoes: ['minhas-vendas.view'] })).toBe('/minhas-vendas');
    expect(paginaInicial({ papel: { chave: 'visualizador' }, permissoes: ['minhas-vendas.view'] })).toBe(
      '/minhas-vendas',
    );
  });

  it('sem a permissão vai para a Visão geral, mesmo sendo representante', () => {
    expect(paginaInicial({ papel: rep, permissoes: ['dashboard.view'] })).toBe('/dashboard');
    expect(paginaInicial(null)).toBe('/dashboard');
  });

  it('Admin (tem todas as permissões por regra) continua na Visão geral', () => {
    expect(paginaInicial({ papel: { chave: 'admin' }, permissoes: ['minhas-vendas.view'] })).toBe(
      '/dashboard',
    );
  });
});

describe('itemAtivo', () => {
  const destinos = ['/dashboard', '/dashboard/gestores', '/faturamento', '/faturamento/analise', '/pedidos'];

  it('só o item mais específico fica ativo', () => {
    expect(itemAtivo('/faturamento/analise', destinos)).toBe('/faturamento/analise');
    expect(itemAtivo('/faturamento', destinos)).toBe('/faturamento');
    expect(itemAtivo('/dashboard/gestores', destinos)).toBe('/dashboard/gestores');
    expect(itemAtivo('/dashboard', destinos)).toBe('/dashboard');
  });

  it('subpáginas acendem o item pai; prefixo sem barra não conta', () => {
    expect(itemAtivo('/pedidos/123', destinos)).toBe('/pedidos');
    expect(itemAtivo('/pedidos-antigos', destinos)).toBeUndefined();
    expect(itemAtivo('/admin/usuarios', destinos)).toBeUndefined();
  });
});
