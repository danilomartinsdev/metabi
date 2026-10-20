<script setup lang="ts">
import type { CampoTotalFaturamento, FaturamentoImpressao, PaletaGrafico } from '@metabi/shared';
import { evolucaoFaturamentoOptions } from '~/utils/charts/faturamento';
import { anoAnterior, periodoCurto } from '~/utils/periodo';

// PDF da página de Faturamento, aberto pelo Chromium da API (ADR 0004). Sem sessão: o token de uso
// único na URL é a credencial; a API confere permissão e escopo "todos" de quem pediu o PDF.
definePageMeta({ layout: 'print' });
useHead({ title: 'Relatório de faturamento — MetaBI' });

type Janela = Window & { __relatorio?: 'pronto' | 'erro' };
const route = useRoute();
const dados = ref<FaturamentoImpressao | null>(null);
const erro = ref(false);
const paletaImpressao = useState<PaletaGrafico | null | undefined>('paleta-impressao', () => undefined);

onMounted(async () => {
  try {
    dados.value = await $fetch<FaturamentoImpressao>('/api/print/faturamento', {
      query: { token: String(route.query.token ?? '') },
    });
    paletaImpressao.value = dados.value.paletaGraficos;
    // Espera o Vue desenhar e as animações curtas do ECharts terminarem antes de liberar o PDF.
    await nextTick();
    setTimeout(() => ((window as Janela).__relatorio = 'pronto'), 1200);
  } catch {
    erro.value = true;
    (window as Janela).__relatorio = 'erro';
  }
});

const r = computed(() => dados.value?.resumo);
const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (m: string) => `${NOMES_MES[Number(m.slice(5)) - 1]}/${m.slice(0, 4)}`;
const periodo = computed(() => {
  const p = r.value?.periodo;
  if (!p) return '';
  return p.de === p.ate ? rotuloMes(p.de) : `${rotuloMes(p.de)} a ${rotuloMes(p.ate)}`;
});
const rotuloAnterior = computed(() => {
  const p = r.value?.periodo;
  if (!p) return '';
  const a = anoAnterior(p);
  return `vs. ${periodoCurto(a.de, a.ate)}`;
});

const CARDS: { k: CampoTotalFaturamento; rotulo: string; icone: string }[] = [
  { k: 'dre', rotulo: 'Fatura DRE', icone: 'i-lucide-dollar-sign' },
  { k: 'bruto', rotulo: 'Faturamento bruto', icone: 'i-lucide-receipt' },
  { k: 'devolucao', rotulo: 'Devoluções', icone: 'i-lucide-arrow-down-left' },
  { k: 'antecipado', rotulo: 'Antecipações', icone: 'i-lucide-calendar-clock' },
  { k: 'remessa', rotulo: 'Remessas', icone: 'i-lucide-truck' },
];
const INDICADOR: Record<CampoTotalFaturamento, string> = {
  dre: 'Fatura DRE',
  bruto: 'Faturamento bruto',
  antecipado: 'Antecipações',
  remessa: 'Remessas',
  devolucao: 'Devoluções',
};
const MESES_EXTENSO = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const mesesEscolhidos = computed(() => dados.value?.params.meses ?? []);
</script>

<template>
  <div v-if="erro" class="py-24 text-center text-sm text-muted-foreground">
    Link de impressão inválido ou expirado.
  </div>
  <div v-else-if="!dados || !r" class="py-24 text-center text-sm text-muted-foreground">Carregando…</div>
  <article v-else class="space-y-5 text-sm">
    <header class="flex items-end justify-between border-b pb-3">
      <div>
        <img src="/brand/logo-meta-hospitalar.webp" alt="Metahospitalar" class="h-9 w-auto" />
        <h1 class="mt-2 text-xl font-semibold">Relatório de faturamento</h1>
        <p class="text-muted-foreground">{{ periodo }} · relatório diário de faturamento do Focco</p>
      </div>
      <div class="text-right text-xs text-muted-foreground">
        <p>Gerado por {{ dados.geradoPor }}</p>
        <p>{{ formatDateTime(dados.geradoEm) }}</p>
      </div>
    </header>

    <p v-if="!r.temDados" class="py-16 text-center text-muted-foreground">Nenhum faturamento importado.</p>
    <template v-else>
      <section class="grid grid-cols-2 gap-3" aria-label="Indicadores de faturamento">
        <DashboardKpiCard
          v-for="c in CARDS"
          :key="c.k"
          :rotulo="c.rotulo"
          :icone="c.icone"
          :valor="formatBRL(r.kpis[c.k].valor)"
          :variacoes="[{ rotulo: rotuloAnterior, pct: r.kpis[c.k].pct }]"
          compacto
        />
      </section>

      <section class="break-inside-avoid rounded-xl border p-4">
        <h2 class="text-sm font-medium text-muted-foreground">
          Fatura DRE mês a mês {{ r.mensal.ano }} — comparada ao ano anterior
        </h2>
        <ChartsBaseChart
          class="mt-2"
          altura="260px"
          rotulo="Fatura DRE mês a mês comparada ao ano anterior"
          :opcoes="(t) => evolucaoFaturamentoOptions(r!.mensal, t)"
        />
      </section>

      <section class="break-inside-avoid rounded-xl border">
        <h2 class="px-4 pt-4 pb-2 text-sm font-medium text-muted-foreground">
          Faturamento mês a mês — {{ dados.mensal.ano }}
        </h2>
        <p v-if="!dados.mensal.meses.length" class="px-4 pb-4 text-muted-foreground">
          Sem faturamento importado em {{ dados.mensal.ano }}.
        </p>
        <FaturamentoTabelaMensal v-else :mensal="dados.mensal" compacto />
      </section>

      <section v-if="dados.comparativo" class="break-inside-avoid rounded-xl border">
        <div class="px-4 pt-4 pb-2">
          <h2 class="text-sm font-medium text-muted-foreground">
            Comparativo entre anos — {{ INDICADOR[dados.params.indicador] }} de
            {{ dados.comparativo.anoB }} em relação a {{ dados.comparativo.anoA }}
          </h2>
          <p v-if="mesesEscolhidos.length" class="text-xs text-muted-foreground">
            Meses selecionados: {{ mesesEscolhidos.map((m) => MESES_EXTENSO[m - 1]).join(', ') }}
          </p>
        </div>
        <FaturamentoTabelaComparativo
          :comp="dados.comparativo"
          :indicador="dados.params.indicador"
          :filtrando-meses="mesesEscolhidos.length > 0"
          compacto
        />
      </section>
    </template>
  </article>
</template>
