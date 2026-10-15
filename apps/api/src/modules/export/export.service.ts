import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AnaliseFaturamentoImpressao,
  AnaliseNotasQuery,
  ExportXlsxQuery,
  ExportXlsxTipo,
  FaturamentoImpressao,
  FaturamentoPdfQuery,
  Filtros,
  SolicitacaoImpressao,
  RelatorioImpressao,
} from '@meta-bi/shared';
import { exigirEscopoTodos } from '../../common/auth/privilegios.js';
import type { ContextoRequisicao, UsuarioAutenticado } from '../../common/auth/types.js';
import { ApiException, Erros } from '../../common/errors.js';
import { ENV, type Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { FaturamentoService } from '../faturamento/faturamento.service.js';
import { NotasFiscaisService } from '../notas-fiscais/notas-fiscais.service.js';
import { PdfRenderer } from './pdf-renderer.service.js';
import { type InfoExportacao, planilhaClientes, planilhaPedidos, planilhaRanking } from './planilhas.js';
import { PrintTokenService } from './print-token.service.js';

// Map (e não objeto literal) porque a regra de escopo do ESLint trata qualquer chave "pedidos" como relação.
const TITULOS = new Map<ExportXlsxTipo, string>([
  ['pedidos', 'Pedidos'],
  ['gestores', 'Ranking de representantes'],
  ['estados', 'Ranking de estados'],
  ['regioes', 'Ranking de regiões'],
  ['clientes', 'Clientes'],
]);
const COLUNA: Record<'gestores' | 'estados' | 'regioes', string> = {
  gestores: 'Representante',
  estados: 'UF',
  regioes: 'Região',
};

export interface Arquivo {
  conteudo: Buffer;
  nome: string;
  tipo: string;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly dashboard: DashboardService,
    private readonly faturamento: FaturamentoService,
    private readonly notas: NotasFiscaisService,
    private readonly tokens: PrintTokenService,
    private readonly renderer: PdfRenderer,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Nomes dos representantes filtrados — só os que o usuário pode ver. */
  private async rotulosGestor(u: UsuarioAutenticado, f: Filtros) {
    const ids =
      u.escopo.tipo === 'representantes'
        ? f.gestor.filter((g) => u.escopo.representanteIds.includes(g))
        : f.gestor;
    if (!ids.length) return new Map<string, string>();
    const reps = await this.prisma.representante.findMany({
      where: { id: { in: ids } },
      select: { id: true, nomeExibicao: true },
    });
    return new Map(reps.map((r) => [r.id, r.nomeExibicao]));
  }

  async xlsx(
    u: UsuarioAutenticado,
    tipo: ExportXlsxTipo,
    q: ExportXlsxQuery,
    ctx: ContextoRequisicao,
  ): Promise<Arquivo> {
    const rotulos = await this.rotulosGestor(u, q);
    const info = (
      periodo: { de: string; ate: string },
      linhas: number,
      truncado = false,
    ): InfoExportacao => ({
      titulo: TITULOS.get(tipo)!,
      periodo,
      filtros: q,
      geradoPor: u.nome,
      geradoEm: new Date(),
      linhas,
      truncado,
    });

    let conteudo: Buffer;
    let periodo: { de: string; ate: string };
    let linhas: number;
    if (tipo === 'pedidos') {
      const r = await this.dashboard.pedidosParaExportar(u, q, this.env.EXPORT_MAX_LINHAS);
      periodo = r.periodo;
      linhas = r.data.length;
      conteudo = planilhaPedidos(r.data, info(periodo, linhas, r.total > linhas), rotulos);
    } else if (tipo === 'clientes') {
      const r = await this.dashboard.clientes(u, q);
      periodo = r.periodo;
      linhas = r.ranking.length;
      conteudo = planilhaClientes(r, info(periodo, linhas), rotulos);
    } else {
      const r = await this.dashboard.ranking(u, q, tipo);
      periodo = r.periodo;
      linhas = r.linhas.length;
      conteudo = planilhaRanking(r, COLUNA[tipo], info(periodo, linhas), rotulos);
    }

    await this.audit.registrar({
      acao: 'export.xlsx',
      usuarioId: u.id,
      detalhes: { tipo, linhas, filtros: filtrosParaAuditoria({ ...q, ...periodo }) },
      ctx,
    });
    return {
      conteudo,
      nome: `meta-bi-${tipo}-${periodo.de}_${periodo.ate}.xlsx`,
      tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Gera o PDF de uma página /print/* da SPA (ADR 0004): cria o token de uso único com o solicitacao,
   * abre a página no Chromium e descarta o token se ela não chegou a consumi-lo.
   */
  private async gerarPdf(u: UsuarioAutenticado, solicitacao: SolicitacaoImpressao, pagina: string): Promise<Buffer> {
    const token = await this.tokens.criar(u, solicitacao);
    const base = (this.env.PRINT_BASE_URL ?? this.env.WEB_ORIGIN).replace(/\/$/, '');
    const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    try {
      return await this.renderer.renderizar(
        `${base}/print/${pagina}?token=${token}`,
        `Metahospitalar · BI Executivo — gerado por ${u.nome} em ${quando} · uso interno`,
      );
    } catch (e) {
      this.logger.error(`Falha ao gerar PDF (${pagina}): ${(e as Error).message}`);
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'INTERNAL',
        'Não foi possível gerar o PDF agora. Tente de novo em instantes.',
      );
    } finally {
      // Se a página não chegou a consumir o token, ele morre aqui.
      await this.tokens.descartar(token);
    }
  }

  async pdf(u: UsuarioAutenticado, f: Filtros, ctx: ContextoRequisicao): Promise<Arquivo> {
    const periodo = await this.dashboard.periodo(u, f);
    const conteudo = await this.gerarPdf(u, { tipo: 'vendas', filtros: f }, 'relatorio');
    await this.audit.registrar({
      acao: 'export.pdf',
      usuarioId: u.id,
      detalhes: { filtros: filtrosParaAuditoria({ ...f, ...periodo }) },
      ctx,
    });
    return {
      conteudo,
      nome: `meta-bi-relatorio-${periodo.de}_${periodo.ate}.pdf`,
      tipo: 'application/pdf',
    };
  }

  /** PDF da página de Faturamento: número da empresa inteira — exige a permissão e escopo "todos". */
  async pdfFaturamento(
    u: UsuarioAutenticado,
    p: FaturamentoPdfQuery,
    ctx: ContextoRequisicao,
  ): Promise<Arquivo> {
    exigirFaturamento(u);
    const { periodo } = await this.faturamento.resumo({ de: p.de, ate: p.ate });
    const conteudo = await this.gerarPdf(u, { tipo: 'faturamento', params: p }, 'faturamento');
    await this.audit.registrar({
      acao: 'export.pdf',
      usuarioId: u.id,
      detalhes: { relatorio: 'faturamento', ...periodo, ...p },
      ctx,
    });
    return {
      conteudo,
      nome: `meta-bi-faturamento-${periodo.de}_${periodo.ate}.pdf`,
      tipo: 'application/pdf',
    };
  }

  /** PDF da Análise de faturamento (notas fiscais): empresa inteira — exige a permissão e escopo "todos". */
  async pdfAnaliseFaturamento(
    u: UsuarioAutenticado,
    p: AnaliseNotasQuery,
    ctx: ContextoRequisicao,
  ): Promise<Arquivo> {
    exigirAnaliseFaturamento(u);
    const { periodo } = await this.notas.analise(p);
    const conteudo = await this.gerarPdf(u, { tipo: 'analise-faturamento', params: p }, 'analise-faturamento');
    await this.audit.registrar({
      acao: 'export.pdf',
      usuarioId: u.id,
      detalhes: { relatorio: 'analise-faturamento', ...periodo },
      ctx,
    });
    return {
      conteudo,
      nome: `meta-bi-analise-faturamento-${periodo.de}_${periodo.ate}.pdf`,
      tipo: 'application/pdf',
    };
  }

  /** Dados da página de impressão: consome o token (uso único) e aplica o escopo de quem pediu o PDF. */
  async relatorio(token: string): Promise<RelatorioImpressao> {
    const e = await this.tokens.consumir(token, 'vendas');
    if (!e) throw Erros.naoAutenticado();
    const { usuario: u } = e;
    const f = e.solicitacao.filtros;
    const [visaoGeral, gestores, estados, regioes] = await Promise.all([
      this.dashboard.visaoGeral(u, f),
      this.dashboard.ranking(u, f, 'gestores'),
      this.dashboard.ranking(u, f, 'estados'),
      this.dashboard.ranking(u, f, 'regioes'),
    ]);
    return {
      geradoPor: u.nome,
      geradoEm: new Date().toISOString(),
      paletaGraficos: u.paletaGraficos,
      filtros: f,
      visaoGeral,
      rankings: { gestores, estados, regioes },
    };
  }

  /** Dados do PDF de faturamento. Revalida permissão e escopo com o usuário atual (recarregado pelo token). */
  async faturamentoImpressao(token: string): Promise<FaturamentoImpressao> {
    const e = await this.tokens.consumir(token, 'faturamento');
    if (!e) throw Erros.naoAutenticado();
    const { usuario: u, solicitacao } = e;
    exigirFaturamento(u);
    const p = solicitacao.params;
    const resumo = await this.faturamento.resumo({ de: p.de, ate: p.ate });
    const [mensal, comparativo] = await Promise.all([
      this.faturamento.mensal(p.ano ?? resumo.mensal.ano),
      p.anoA !== undefined && p.anoB !== undefined
        ? this.faturamento.comparativo(p.anoA, p.anoB, p.meses)
        : Promise.resolve(null),
    ]);
    return {
      geradoPor: u.nome,
      geradoEm: new Date().toISOString(),
      paletaGraficos: u.paletaGraficos,
      params: p,
      resumo,
      mensal,
      comparativo,
    };
  }

  /** Dados do PDF da Análise de faturamento. Revalida permissão e escopo com o usuário atual. */
  async analiseFaturamentoImpressao(token: string): Promise<AnaliseFaturamentoImpressao> {
    const e = await this.tokens.consumir(token, 'analise-faturamento');
    if (!e) throw Erros.naoAutenticado();
    const { usuario: u, solicitacao } = e;
    exigirAnaliseFaturamento(u);
    return {
      geradoPor: u.nome,
      geradoEm: new Date().toISOString(),
      paletaGraficos: u.paletaGraficos,
      params: solicitacao.params,
      analise: await this.notas.analise(solicitacao.params),
    };
  }
}

/** Só os filtros preenchidos (sem ordenação), para o log de auditoria. */
function filtrosParaAuditoria(f: Filtros): Record<string, string | string[]> {
  const r: Record<string, string | string[]> = {};
  for (const k of ['de', 'ate', 'regiao', 'uf', 'gestor', 'segmento', 'status', 'q'] as const) {
    const v = f[k];
    if (Array.isArray(v) ? v.length : v) r[k] = v as string | string[];
  }
  return r;
}

/** Análise de faturamento (notas fiscais): além do PDF, exige a permissão da tela e escopo "todos". */
function exigirAnaliseFaturamento(u: UsuarioAutenticado): void {
  if (!u.permissoes.includes('faturamento-analise.view')) {
    throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Sem permissão para ver a análise de faturamento.');
  }
  exigirEscopoTodos(u);
}

/** Faturamento é da empresa inteira: além do PDF, exige ver faturamento e escopo "todos". */
function exigirFaturamento(u: UsuarioAutenticado): void {
  if (!u.permissoes.includes('faturamento.view')) {
    throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Sem permissão para ver o faturamento.');
  }
  exigirEscopoTodos(u);
}
