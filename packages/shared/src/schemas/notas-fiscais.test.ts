import { describe, expect, it } from 'vitest';
import {
  codigoProdutoAgrupado,
  curvaAbc,
  descricaoProdutoAgrupada,
  linhaNotaSchema,
} from './notas-fiscais.js';

// Formato real do relatório: números com ponto decimal (vindos da célula numérica), data com hora.
const linha = (sobre: Partial<Record<string, string>> = {}) => ({
  itemId: '439186',
  notaId: '65316',
  numNota: '25521',
  dataEmissao: '07/04/2026 00:00:00',
  tipoNota: 'Venda',
  divisao: 'PRIVADO - MERCADO INTERNO PRIVADO',
  repCodigo: '48',
  repNome: 'REPRESENTANTE EXEMPLO LTDA',
  cliCodigo: '668',
  cliRazaoSocial: 'HOSPITAL EXEMPLO',
  cliNomeFantasia: '',
  cliCidade: 'MACEIO',
  cliUf: 'al',
  produtoCodigo: 'MT931',
  produtoDescricao: 'SUPORTE PARA SORO',
  unidade: 'un',
  quantidade: '5',
  valorTotal: '3462.005000',
  ...sobre,
});

describe('linhaNotaSchema', () => {
  it('normaliza uma linha válida (data sem hora, UF maiúscula, decimais com 2 casas)', () => {
    expect(linhaNotaSchema.parse(linha())).toMatchObject({
      itemId: 439186,
      notaId: 65316,
      dataEmissao: '2026-04-07',
      cliUf: 'AL',
      cliNomeFantasia: null,
      unidade: 'UN',
      quantidade: '5.00',
      valorTotal: '3462.01',
    });
  });

  it('rejeita data, valor e UF inválidos', () => {
    const r = linhaNotaSchema.safeParse(linha({ dataEmissao: '31/02/2026', valorTotal: 'abc', cliUf: 'X' }));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('DATA_EMISSAO inválida'),
        expect.stringContaining('ITNFS_VALOR_TOTAL inválido'),
        'CLI_UF inválida',
      ]),
    );
  });
});

describe('agrupamento de produtos', () => {
  it('variantes com ponto final são o mesmo produto', () => {
    expect(codigoProdutoAgrupado('MT169.')).toBe('MT169');
    expect(codigoProdutoAgrupado('MT169')).toBe('MT169');
    expect(descricaoProdutoAgrupada('CAMA EVOLUTION  MT169.')).toBe('CAMA EVOLUTION MT169');
  });
});

describe('curvaAbc', () => {
  it('A até 80% do acumulado (o item que cruza ainda é A), B até 95%, C o restante', () => {
    // Total 100: 50 → acum. anterior 0 (A); 30 → 0,50 (A, cruza 80%); 12 → 0,80 (B); 5 → 0,92 (B); 3 → 0,97 (C)
    const r = curvaAbc(
      ['50.00', '30.00', '12.00', '5.00', '3.00'].map((total) => ({ total })),
      '100.00',
    );
    expect(r.map((l) => l.classe)).toEqual(['A', 'A', 'B', 'B', 'C']);
    expect(r.map((l) => l.acumulado)).toEqual([0.5, 0.8, 0.92, 0.97, 1]);
    expect(r[1]!.participacao).toBe(0.3);
  });

  it('pela quantidade: a curva usa o campo pedido, não o valor', () => {
    const r = curvaAbc(
      [
        { total: '10.00', quantidade: '90.00' },
        { total: '90.00', quantidade: '10.00' },
      ],
      '100.00',
      'quantidade',
    );
    expect(r.map((l) => [l.participacao, l.acumulado, l.classe])).toEqual([
      [0.9, 0.9, 'A'],
      [0.1, 1, 'B'],
    ]);
  });

  it('total zero não divide por zero', () => {
    expect(curvaAbc([{ total: '0.00' }], '0.00')[0]).toMatchObject({
      participacao: 0,
      acumulado: 0,
      classe: 'A',
    });
  });
});
