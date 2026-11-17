import { z } from 'zod';
import { regiaoDaUf, type Regiao } from '../constants/regioes.js';

/** Colunas do relatório "DASHBOARD_Extrator PDV" (docs/dados/importacao-focco.md). */
export const COLUNAS_FOCCO = {
  id: 'ID',
  numPedido: 'NUM PEDIDO',
  ordemCpr: 'ORDEM CPR',
  dtEmissao: 'DT EMIS',
  dtEntrega: 'DT ENTREGA',
  status: 'POS PDV',
  cliente: 'CLIENTE',
  uf: 'UF',
  representante: 'REPRESENTANTE',
  valor: 'VALOR',
} as const;

/**
 * Colunas que só os relatórios mais novos trazem. Ausentes no arquivo, o campo fica undefined e a
 * importação mantém o valor que o pedido já tinha (relatório antigo não apaga a divisão).
 */
export const COLUNAS_FOCCO_OPCIONAIS = {
  divisao: 'DIVISAO VENDA',
} as const;

/** Maiúsculas, sem acento, espaços colapsados. "  São  Camilo " → "SAO CAMILO". */
export function normalizarNome(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Converte número pt-BR para string decimal com 2 casas, arredondando half-up,
 * SEM passar por float. "83575,74920002" → "83575.75"; "1.234,5" → "1234.50".
 * Retorna null se inválido.
 */
export function decimalBR(entrada: string): string | null {
  let s = entrada.trim().replace(/\s/g, '');
  if (!s) return null;
  const negativo = s.startsWith('-');
  if (negativo) s = s.slice(1);
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;

  const [inteiro = '0', frac = ''] = s.split('.');
  let centavos = BigInt(inteiro + (frac + '00').slice(0, 2));
  if ((frac[2] ?? '0') >= '5') centavos += 1n;
  if (negativo) centavos = -centavos;

  const abs = centavos < 0n ? -centavos : centavos;
  const txt = abs.toString().padStart(3, '0');
  return `${centavos < 0n ? '-' : ''}${txt.slice(0, -2)}.${txt.slice(-2)}`;
}

/** "05/01/26" ou "05/01/2026" → "2026-01-05" (data civil, sem fuso). Valida o calendário. */
export function dataBR(entrada: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(entrada.trim());
  if (!m) return null;
  const [, d, mes, a] = m;
  const ano = a!.length === 2 ? 2000 + Number(a) : Number(a);
  const dia = Number(d);
  const mm = Number(mes);
  const dt = new Date(Date.UTC(ano, mm - 1, dia));
  if (dt.getUTCFullYear() !== ano || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dia) return null;
  return `${ano}-${String(mm).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

const texto = (campo: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, { error: `${campo} vazio` })
    .max(max, { error: `${campo} muito longo` });

/** Valida e normaliza uma linha bruta (strings) do relatório. */
export const linhaFoccoSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^\d{1,10}$/, { error: 'ID inválido' })
      .transform(Number),
    numPedido: texto('NUM PEDIDO', 30),
    ordemCpr: z
      .string()
      .trim()
      .max(60)
      .transform((v) => v || null),
    dtEmissao: z
      .string()
      .transform(
        (v, c) => dataBR(v) ?? (c.addIssue({ code: 'custom', message: 'DT EMIS inválida' }), z.NEVER),
      ),
    dtEntrega: z.string().transform((v, c) => {
      if (!v.trim()) return null;
      return dataBR(v) ?? (c.addIssue({ code: 'custom', message: 'DT ENTREGA inválida' }), z.NEVER);
    }),
    status: texto('POS PDV', 10).transform((v) => v.toUpperCase()),
    cliente: texto('CLIENTE'),
    uf: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => !!regiaoDaUf(v), { error: 'UF desconhecida' }),
    representante: texto('REPRESENTANTE', 80).transform((v) => v.replace(/\s+/g, ' ').toUpperCase()),
    valor: z
      .string()
      .transform(
        (v, c) => decimalBR(v) ?? (c.addIssue({ code: 'custom', message: 'VALOR inválido' }), z.NEVER),
      ),
    // undefined = coluna ausente no arquivo; null = célula vazia.
    divisao: z
      .string()
      .max(120, { error: 'DIVISAO VENDA muito longa' })
      .optional()
      .transform((v) => (v === undefined ? undefined : v.replace(/\s+/g, ' ').trim().toUpperCase() || null)),
  })
  .transform((l) => ({
    ...l,
    clienteNormalizado: normalizarNome(l.cliente),
    regiao: regiaoDaUf(l.uf) as Regiao,
    competencia: `${l.dtEmissao.slice(0, 7)}-01`,
  }));

export type LinhaFocco = z.output<typeof linhaFoccoSchema>;

export interface ErroLinha {
  linha: number;
  mensagens: string[];
}

export interface PreviaImportacao {
  hash: string;
  arquivoNome: string;
  formato: 'html' | 'xls' | 'xlsx' | 'csv';
  totalLinhas: number;
  novos: number;
  atualizados: number;
  inalterados: number;
  ignorados: number;
  erros: ErroLinha[];
  representantesNovos: string[];
  clientesNovos: number;
  statusNovos: string[];
  periodo: { de: string; ate: string } | null;
  valorTotal: string;
  jaImportado: boolean;
}
