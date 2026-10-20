<script setup lang="ts">
import { type PaletaGrafico, REGIAO_ENUM_ROTULO, type RelatorioImpressao } from '@metabi/shared';
import { barrasRankingOptions, donutOptions, evolucaoOptions } from '~/utils/charts/options';
import { periodoPorExtenso, variacoesKpi } from '~/utils/periodo';

// Relatório executivo em A4, aberto pelo Chromium da API (ADR 0004). Sem sessão: o token de uso
// único na URL é a credencial; a API aplica o escopo de quem pediu o PDF.
definePageMeta({ layout: 'print' });
useHead({ title: 'Relatório executivo — MetaBI' });

type Janela = Window & { __relatorio?: 'pronto' | 'erro' };
const route = useRoute();
const dados = ref<RelatorioImpressao | null>(null);
const erro = ref(false);
const paletaImpressao = useState<PaletaGrafico | null | undefined>('paleta-impressao', () => undefined);

onMounted(async () => {
  try {
    dados.value = await $fetch<RelatorioImpressao>('/api/print/relatorio', {
      query: { token: String(route.query.token ?? '') },
    });
    // O PDF sai com a paleta de cores de quem pediu o relatório.
    paletaImpressao.value = dados.value.paletaGraficos;
    // Espera o Vue desenhar e as animações curtas do ECharts terminarem antes de liberar o PDF.
    await nextTick();
    setTimeout(() => ((window as Janela).__relatorio = 'pronto'), 1200);
  } catch {
    erro.value = true;
    (window as Janela).__relatorio = 'erro';
  }
});

const v = computed(() => dados.value?.visaoGeral);
const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (m: string) => `${NOMES_MES[Number(m.slice(5)) - 1]}/${m.slice(0, 4)}`;
const periodo = computed(() => {
  const p = v.value?.periodo;
  if (!p) return '';
  return p.de === p.ate ? rotuloMes(p.de) : `${rotuloMes(p.de)} a ${rotuloMes(p.ate)}`;
});

const SEGMENTO: Record<string, string> = { PUBLICO: 'Público', PRIVADO: 'Privado', SEM: 'Sem segmento' };
/** Filtros aplicados em texto (representantes saem com o nome do ranking quando presentes). */
const filtrosTexto = computed(() => {
  const f = dados.value?.filtros;
  if (!f) return [];
  const nomes = new Map(dados.value!.rankings.gestores.linhas.map((l) => [l.chave, l.rotulo]));
  return [
    f.regiao.length && `Região: ${f.regiao.map((r) => REGIAO_ENUM_ROTULO[r]).join(', ')}`,
    f.uf.length && `UF: ${f.uf.join(', ')}`,
    f.gestor.length && `Representante: ${f.gestor.map((g) => nomes.get(g) ?? '—').join(', ')}`,
    f.segmento.length && `Segmento: ${f.segmento.map((s) => SEGMENTO[s]).join(', ')}`,
    f.status.length && `Status: ${f.status.join(', ')}`,
    f.q && `Busca: “${f.q}”`,
  ].filter(Boolean) as string[];
});

const variacoes = (k: 'total' | 'qtd' | 'ticket') =>
  v.value ? variacoesKpi(v.value.kpis[k], v.value.periodo) : [];
const serie = (k: 'total' | 'qtd' | 'ticket') => v.value?.kpis[k].serie.map((s) => Number(s.valor)) ?? [];

const TABELAS = computed(() =>
  dados.value
    ? [
        { titulo: 'Ranking de representantes', coluna: 'Representante', r: dados.value.rankings.gestores },
        { titulo: 'Ranking de estados', coluna: 'UF', r: dados.value.rankings.estados },
        { titulo: 'Ranking de regiões', coluna: 'Região', r: dados.value.rankings.regioes },
      ]
    : [],
);
</script>

<template>
  <div v-if="erro" class="py-24 text-center text-sm text-muted-foreground">
    Link de impressão inválido ou expirado.
  </div>
  <div v-else-if="!v" class="py-24 text-center text-sm text-muted-foreground">Carregando…</div>
  <article v-else class="space-y-5 text-sm">
    <header class="flex items-end justify-between border-b pb-3">
      <div>
        <img src="/brand/logo-meta-hospitalar.webp" alt="Metahospitalar" class="h-9 w-auto" />
        <h1 class="mt-2 text-xl font-semibold">Relatório executivo de vendas</h1>
        <p class="text-muted-foreground">{{ periodo }}</p>
      </div>
      <div class="text-right text-xs text-muted-foreground">
        <p>Gerado por {{ dados!.geradoPor }}</p>
        <p>{{ formatDateTime(dados!.geradoEm) }}</p>
      </div>
    </header>

    <p v-if="filtrosTexto.length" class="text-xs text-muted-foreground">
      Filtros: {{ filtrosTexto.join(' · ') }}
    </p>

    <section class="grid grid-cols-2 gap-3" aria-label="Indicadores">
      <DashboardKpiCard
        rotulo="Total vendido"
        icone="i-lucide-dollar-sign"
        :valor="formatBRL(v.kpis.total.valor)"
        :variacoes="variacoes('total')"
        :serie="serie('total')"
      />
      <DashboardKpiCard
        rotulo="Pedidos"
        icone="i-lucide-shopping-cart"
        :valor="formatInt(v.kpis.qtd.valor)"
        :variacoes="variacoes('qtd')"
        :serie="serie('qtd')"
      />
      <DashboardKpiCard
        rotulo="Ticket médio"
        icone="i-lucide-receipt"
        :valor="formatBRL(v.kpis.ticket.valor)"
        :variacoes="variacoes('ticket')"
        :serie="serie('ticket')"
      />
      <DashboardKpiCard
        rotulo="% Público"
        icone="i-lucide-landmark"
        :valor="formatPct(v.kpis.pctPublico.valor)"
        :variacoes="[{ rotulo: `no ano anterior: ${formatPct(v.kpis.pctPublico.anoAnterior)}`, pct: null }]"
        :serie="v.kpis.pctPublico.serie.map((s) => s.valor)"
      />
    </section>

    <p class="text-xs text-muted-foreground">
      {{ formatInt(v.contagens.estados) }} estados · {{ formatInt(v.contagens.regioes) }} regiões ·
      {{ formatInt(v.contagens.gestores) }} representantes · {{ formatInt(v.contagens.clientes) }} clientes
    </p>

    <section class="break-inside-avoid rounded-xl border p-4">
      <h2 class="text-sm font-medium text-muted-foreground">
        Evolução mensal {{ v.evolucao.ano }} — real × ano anterior{{
          v.evolucao.meses.some((m) => m.meta) ? ' × meta' : ''
        }}
      </h2>
      <ChartsBaseChart
        altura="230px"
        rotulo="Evolução mensal de vendas"
        :opcoes="(t) => evolucaoOptions(v!.evolucao, t)"
      />
      <p v-if="v.evolucao.atingimento" class="mt-2 text-xs text-muted-foreground">
        Meta acumulada: <b class="num text-foreground">{{ formatBRL(v.evolucao.atingimento.meta) }}</b> ·
        Realizado: <b class="num text-foreground">{{ formatBRL(v.evolucao.atingimento.real) }}</b> ·
        Atingimento: <b class="num text-foreground">{{ formatPct(v.evolucao.atingimento.pct) }}</b>
      </p>
    </section>

    <section class="grid break-inside-avoid grid-cols-2 gap-3">
      <div class="rounded-xl border p-4">
        <h2 class="text-sm font-medium text-muted-foreground">Participação por região</h2>
        <ChartsBaseChart
          altura="210px"
          rotulo="Participação por região"
          :opcoes="(t) => donutOptions(v!.porRegiao, t, { impressao: true })"
        />
      </div>
      <div class="rounded-xl border p-4">
        <h2 class="text-sm font-medium text-muted-foreground">Público × Privado</h2>
        <ChartsBaseChart
          altura="210px"
          rotulo="Participação por segmento"
          :opcoes="(t) => donutOptions(v!.porSegmento, t, { impressao: true })"
        />
      </div>
    </section>

    <section class="grid break-inside-avoid grid-cols-2 gap-3">
      <div class="rounded-xl border p-4">
        <h2 class="text-sm font-medium text-muted-foreground">Top 10 representantes</h2>
        <ChartsBaseChart
          altura="260px"
          rotulo="Top 10 representantes"
          :opcoes="(t) => barrasRankingOptions(v!.topGestores, t)"
        />
      </div>
      <div class="rounded-xl border p-4">
        <h2 class="text-sm font-medium text-muted-foreground">
          Comparativo com o ano anterior
          <span class="block text-xs font-normal">
            {{
              periodoPorExtenso(v.acumuladoSegmento.periodo.atual.de, v.acumuladoSegmento.periodo.atual.ate)
            }}
            ×
            {{
              periodoPorExtenso(
                v.acumuladoSegmento.periodo.anterior.de,
                v.acumuladoSegmento.periodo.anterior.ate,
              )
            }}
          </span>
        </h2>
        <ChartsComparativoAcumuladoChart :acumulado="v.acumuladoSegmento" />
      </div>
    </section>

    <DashboardDetalhamentoMensal
      class="break-inside-avoid"
      :detalhamento="v.detalhamentoMensal"
      :periodo="v.periodo"
    />

    <section v-for="t in TABELAS" :key="t.titulo" class="break-inside-avoid">
      <h2 class="mb-2 text-sm font-semibold">{{ t.titulo }}</h2>
      <table class="w-full border text-xs">
        <thead class="bg-muted/50 text-muted-foreground">
          <tr>
            <th class="w-8 px-2 py-1.5 text-left font-medium">#</th>
            <th class="px-2 py-1.5 text-left font-medium">{{ t.coluna }}</th>
            <th class="px-2 py-1.5 text-right font-medium">Total</th>
            <th class="px-2 py-1.5 text-right font-medium">Pedidos</th>
            <th class="px-2 py-1.5 text-right font-medium">Ticket médio</th>
            <th class="px-2 py-1.5 text-right font-medium">% Part.</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="(l, i) in t.r.linhas" :key="l.chave">
            <td class="num px-2 py-1 text-muted-foreground">{{ i + 1 }}</td>
            <td class="px-2 py-1">{{ l.rotulo }}</td>
            <td class="num px-2 py-1 text-right">{{ formatBRL(l.total) }}</td>
            <td class="num px-2 py-1 text-right">{{ formatInt(l.qtd) }}</td>
            <td class="num px-2 py-1 text-right">{{ formatBRL(l.ticket) }}</td>
            <td class="num px-2 py-1 text-right">{{ formatPct(l.participacao) }}</td>
          </tr>
        </tbody>
        <tfoot class="border-t-2 font-semibold">
          <tr>
            <td />
            <td class="px-2 py-1">Total</td>
            <td class="num px-2 py-1 text-right">{{ formatBRL(t.r.total.total) }}</td>
            <td class="num px-2 py-1 text-right">{{ formatInt(t.r.total.qtd) }}</td>
            <td class="num px-2 py-1 text-right">{{ formatBRL(t.r.total.ticket) }}</td>
            <td class="num px-2 py-1 text-right">{{ t.r.linhas.length ? '100,0%' : '—' }}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  </article>
</template>
