import { COLUNAS_FATURAMENTO, linhaFaturamentoSchema } from '@metabi/shared';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { extrairLinhas, lerMatriz } from './parser.js';

/** Relatório de faturamento reaberto e salvo no Excel: DATA vira data real e valores viram números. */
function planilhaSalvaPeloExcel(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    ['NDCOM881-AUDITORIA_Faturamento Diário'],
    [],
    Object.values(COLUNAS_FATURAMENTO),
    ['1 - META MOVEIS', 2026, 10, 40, 46296, 71639.14, '', '', '', 71639.14],
    ['1 - META MOVEIS', 2026, 10, 41, 46300, 1263399.94, '', 102600, '', 1365999.94],
  ]);
  // Formatos como o Excel em inglês grava: data m/d/aa (mês primeiro) e milhar com vírgula.
  for (const ref of ['E4', 'E5']) ws[ref]!.z = 'm/d/yy h:mm';
  for (const ref of ['F4', 'F5', 'H5', 'J4', 'J5']) ws[ref]!.z = '#,##0.00';
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Faturamento');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('lerMatriz — planilha salva pelo Excel', () => {
  it('lê datas pelo valor (não pelo formato m/d/aa) e números sem separador de milhar', () => {
    const { formato, matriz } = lerMatriz(planilhaSalvaPeloExcel());
    expect(formato).toBe('xlsx');

    const linhas = extrairLinhas(matriz, COLUNAS_FATURAMENTO).map((l) => linhaFaturamentoSchema.parse(l));
    expect(linhas.map((l) => [l.data, l.bruto, l.remessa, l.dre])).toEqual([
      ['2026-10-01', '71639.14', '0.00', '71639.14'],
      ['2026-10-05', '1263399.94', '102600.00', '1365999.94'],
    ]);
  });
});

describe('lerMatriz — CSV', () => {
  it('lê CSV com ";" e números pt-BR (milhar com ponto, decimal com vírgula)', () => {
    const csv = [
      Object.values(COLUNAS_FATURAMENTO).join(';'),
      '1 - META MOVEIS;2026;10;40;01/10/2026 00:00:00;71639,14;;;;71639,14',
      '1 - META MOVEIS;2026;10;41;05/10/2026;1.263.399,94;;102600;;1.365.999,94',
    ].join('\r\n');
    const { formato, matriz } = lerMatriz(Buffer.from(csv, 'latin1'));
    expect(formato).toBe('csv');

    const linhas = extrairLinhas(matriz, COLUNAS_FATURAMENTO).map((l) => linhaFaturamentoSchema.parse(l));
    expect(linhas.map((l) => [l.data, l.bruto, l.remessa, l.dre])).toEqual([
      ['2026-10-01', '71639.14', '0.00', '71639.14'],
      ['2026-10-05', '1263399.94', '102600.00', '1365999.94'],
    ]);
  });
});
