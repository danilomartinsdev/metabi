<script setup lang="ts">
import type { AnaliseFaturamentoImpressao, ClasseAbc, PaletaGrafico } from '@metabi/shared';
import { corDaDivisao, divisoesOptions } from '~/utils/charts/notas-fiscais';
import { coresFatias } from '~/utils/charts/palette';
import { periodoPorExtenso } from '~/utils/periodo';

// PDF da Análise de faturamento, aberto pelo Chromium da API (ADR 0004). Sem sessão: o token de uso
// único na URL é a credencial; a API confere permissão e escopo "todos" de quem pediu o PDF.
definePageMeta({ layout: 'print' });
useHead({ title: 'Análise de faturamento — MetaBI' });

type Janela = Window & { __relatorio?: 'pronto' | 'erro' };
const route = useRoute();
const dados = ref<AnaliseFaturamentoImpressao | null>(null);
const erro = ref(false);
const paletaImpressao = useState<PaletaGrafico | null | undefined>('paleta-impressao', () => undefined);

onMounted(async () => {
  try {
    dados.value = await $fetch<AnaliseFaturamentoImpressao>('/api/print/analise-faturamento', {
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

const a = computed(() => dados.value?.analise);
const cores = computed(() => coresFatias(dados.value?.paletaGraficos));

/** Nas curvas ABC o PDF traz o resumo por classe e só os maiores (a lista inteira pode ter centenas). */
const TOP_ABC = 30;
const CLASSES: ClasseAbc[] = ['A', 'B', 'C'];
const DESCRICAO: Record<ClasseAbc, string> = { A: 'até 80%', B: 'de 80% a 95%', C: 'últimos 5%' };
function resumoAbc(linhas: { classe: ClasseAbc; total: string; participacao: number }[]) {
  return CLASSES.map((c) => {
    const ls = linhas.filter((l) => l.classe === c);
    return {
      classe: c,
      qtd: ls.length,
      total: ls.reduce((s, l) => s + Number(l.total), 0),
      participacao: ls.reduce((s, l) => s + l.participacao, 0),
    };
  });
}
const resumoClientes = computed(() => resumoAbc(a.value?.abcClientes ?? []));
const resumoProdutos = computed(() => resumoAbc(a.value?.abcProdutos ?? []));
</script>

<template>
  <div v-if="erro" class="py-24 text-center text-sm text-muted-foreground">
    Link de impressão inválido ou expirado.
  </div>
  <div v-else-if="!dados || !a" class="py-24 text-center text-sm text-muted-foreground">Carregando…</div>
  <article v-else class="space-y-5 text-sm">
    <header class="flex items-end justify-between border-b pb-3">
      <div>
        <img src="/brand/logo-meta-hospitalar.webp" alt="Metahospitalar" class="h-9 w-auto" />
        <h1 class="mt-2 text-xl font-semibold">Análise de faturamento</h1>
        <p class="text-muted-foreground">
          {{ periodoPorExtenso(a.periodo.de, a.periodo.ate) }} · notas fiscais do Focco
        </p>
      </div>
      <div class="text-right text-xs text-muted-foreground">
        <p>Gerado por {{ dados.geradoPor }}</p>
        <p>{{ formatDateTime(dados.geradoEm) }}</p>
      </div>
    </header>

    <p v-if="!a.temDados" class="py-16 text-center text-muted-foreground">Nenhuma nota fiscal importada.</p>
    <template v-else>
      <section class="grid grid-cols-4 gap-3" aria-label="Indicadores de faturamento">
        <DashboardKpiCard
          rotulo="Faturamento no período"
          icone="i-lucide-dollar-sign"
          :valor="formatBRL(a.total)"
          compacto
        />
        <DashboardKpiCard
          rotulo="Notas fiscais"
          icone="i-lucide-receipt"
          :valor="formatInt(a.notas)"
          compacto
        />
        <DashboardKpiCard
          rotulo="Clientes faturados"
          icone="i-lucide-building-complex"
          :valor="formatInt(a.clientes)"
          compacto
        />
        <DashboardKpiCard
          rotulo="Representantes"
          icone="i-lucide-square-user-round"
          :valor="formatInt(a.representantes.length)"
          compacto
        />
      </section>

      <section class="break-inside-avoid rounded-xl border p-4">
        <h2 class="text-sm font-medium text-muted-foreground">Faturamento por divisão de venda</h2>
        <div class="mt-2 flex items-center gap-6">
          <ChartsBaseChart
            class="w-56 shrink-0"
            altura="220px"
            rotulo="Faturamento por divisão de venda"
            :opcoes="(t) => divisoesOptions(a!.divisoes, t)"
          />
          <table class="w-full text-xs">
            <tbody class="divide-y">
              <tr v-for="(d, i) in a.divisoes" :key="d.divisao">
                <td class="py-1 pr-2">
                  <span class="flex items-center gap-2">
                    <span
                      class="size-2.5 shrink-0 rounded-full"
                      :style="{ backgroundColor: corDaDivisao(i, cores) }"
                      aria-hidden="true"
                    />
                    {{ d.divisao }}
                  </span>
                </td>
                <td class="num py-1 text-right whitespace-nowrap">{{ formatBRL(d.total) }}</td>
                <td class="num w-14 py-1 text-right text-muted-foreground">
                  {{ formatPct(d.participacao) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-xl border">
        <h2 class="px-4 pt-4 pb-2 text-sm font-medium text-muted-foreground">Ranking por representante</h2>
        <table class="w-full text-xs">
          <thead class="bg-muted/50 text-muted-foreground">
            <tr>
              <th class="w-8 px-3 py-1.5 text-left font-medium">#</th>
              <th class="px-3 py-1.5 text-left font-medium">Representante</th>
              <th class="px-3 py-1.5 text-right font-medium">Notas</th>
              <th class="px-3 py-1.5 text-right font-medium">Clientes</th>
              <th class="px-3 py-1.5 text-right font-medium">Valor</th>
              <th class="px-3 py-1.5 text-right font-medium">% Part.</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="(l, i) in a.representantes" :key="l.codigo" class="break-inside-avoid">
              <td class="num px-3 py-1.5 text-muted-foreground">{{ i + 1 }}</td>
              <td class="px-3 py-1.5 font-medium">{{ l.nome }}</td>
              <td class="num px-3 py-1.5 text-right">{{ formatInt(l.notas) }}</td>
              <td class="num px-3 py-1.5 text-right">{{ formatInt(l.clientes) }}</td>
              <td class="num px-3 py-1.5 text-right whitespace-nowrap">{{ formatBRL(l.total) }}</td>
              <td class="num px-3 py-1.5 text-right">{{ formatPct(l.participacao) }}</td>
            </tr>
          </tbody>
          <tfoot class="border-t-2 font-semibold">
            <tr>
              <td class="px-3 py-1.5" />
              <td class="px-3 py-1.5">Total</td>
              <td class="num px-3 py-1.5 text-right">{{ formatInt(a.notas) }}</td>
              <td class="num px-3 py-1.5 text-right">{{ formatInt(a.clientes) }}</td>
              <td class="num px-3 py-1.5 text-right whitespace-nowrap">{{ formatBRL(a.total) }}</td>
              <td class="num px-3 py-1.5 text-right">100,0%</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section
        v-for="curva in [
          { titulo: 'Curva ABC de faturamento por cliente', resumo: resumoClientes, rotulo: 'clientes' },
          { titulo: 'Curva ABC por produto (valor vendido)', resumo: resumoProdutos, rotulo: 'produtos' },
        ]"
        :key="curva.rotulo"
        class="rounded-xl border"
      >
        <div class="px-4 pt-4 pb-2">
          <h2 class="text-sm font-medium text-muted-foreground">{{ curva.titulo }}</h2>
          <p class="text-xs text-muted-foreground">
            Resumo por classe e os {{ TOP_ABC }} maiores {{ curva.rotulo }}
          </p>
        </div>
        <div class="grid grid-cols-3 gap-3 px-4 pb-3">
          <div v-for="c in curva.resumo" :key="c.classe" class="rounded-lg border px-3 py-2">
            <p class="text-xs text-muted-foreground">Classe {{ c.classe }} · {{ DESCRICAO[c.classe] }}</p>
            <p class="num font-semibold">{{ formatBRL(c.total) }}</p>
            <p class="num text-xs text-muted-foreground">
              {{ formatInt(c.qtd) }} {{ curva.rotulo }} · {{ formatPct(c.participacao) }}
            </p>
          </div>
        </div>
        <table class="w-full text-xs">
          <thead class="bg-muted/50 text-muted-foreground">
            <tr>
              <th class="w-8 px-3 py-1.5 text-left font-medium">#</th>
              <th class="px-3 py-1.5 text-left font-medium">Código</th>
              <th class="px-3 py-1.5 text-left font-medium">
                {{ curva.rotulo === 'clientes' ? 'Cliente' : 'Descrição' }}
              </th>
              <th class="px-3 py-1.5 text-right font-medium">Valor</th>
              <th class="px-3 py-1.5 text-right font-medium">% Part.</th>
              <th class="px-3 py-1.5 text-right font-medium">% Acum.</th>
              <th class="px-3 py-1.5 text-center font-medium">Classe</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <template v-if="curva.rotulo === 'clientes'">
              <tr
                v-for="(l, i) in a.abcClientes.slice(0, TOP_ABC)"
                :key="l.codigo"
                class="break-inside-avoid"
              >
                <td class="num px-3 py-1.5 text-muted-foreground">{{ i + 1 }}</td>
                <td class="num px-3 py-1.5">{{ l.codigo }}</td>
                <td class="px-3 py-1.5">{{ l.nomeFantasia || l.razaoSocial }} · {{ l.uf }}</td>
                <td class="num px-3 py-1.5 text-right whitespace-nowrap">{{ formatBRL(l.total) }}</td>
                <td class="num px-3 py-1.5 text-right">{{ formatPct(l.participacao) }}</td>
                <td class="num px-3 py-1.5 text-right">{{ formatPct(l.acumulado) }}</td>
                <td class="px-3 py-1.5 text-center font-semibold">{{ l.classe }}</td>
              </tr>
            </template>
            <template v-else>
              <tr
                v-for="(l, i) in a.abcProdutos.slice(0, TOP_ABC)"
                :key="l.codigo"
                class="break-inside-avoid"
              >
                <td class="num px-3 py-1.5 text-muted-foreground">{{ i + 1 }}</td>
                <td class="num px-3 py-1.5">{{ l.codigo }}</td>
                <td class="px-3 py-1.5">{{ l.descricao }}</td>
                <td class="num px-3 py-1.5 text-right whitespace-nowrap">{{ formatBRL(l.total) }}</td>
                <td class="num px-3 py-1.5 text-right">{{ formatPct(l.participacao) }}</td>
                <td class="num px-3 py-1.5 text-right">{{ formatPct(l.acumulado) }}</td>
                <td class="px-3 py-1.5 text-center font-semibold">{{ l.classe }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>
    </template>
  </article>
</template>
