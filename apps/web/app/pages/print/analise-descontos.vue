<script setup lang="ts">
import type { AnaliseDescontosImpressao } from '@metabi/shared';
import { periodoPorExtenso } from '~/utils/periodo';

// PDF da Análise de descontos, aberto pelo Chromium da API (ADR 0004). Sem sessão: o token de uso único
// na URL é a credencial; a API confere permissão e escopo "todos" de quem pediu o PDF.
definePageMeta({ layout: 'print' });
useHead({ title: 'Análise de descontos — MetaBI' });

type Janela = Window & { __relatorio?: 'pronto' | 'erro' };
const route = useRoute();
const dados = ref<AnaliseDescontosImpressao | null>(null);
const erro = ref(false);

onMounted(async () => {
  try {
    dados.value = await $fetch<AnaliseDescontosImpressao>('/api/print/analise-descontos', {
      query: { token: String(route.query.token ?? '') },
    });
    await nextTick();
    setTimeout(() => ((window as Janela).__relatorio = 'pronto'), 300);
  } catch {
    erro.value = true;
    (window as Janela).__relatorio = 'erro';
  }
});

const a = computed(() => dados.value?.analise);
/** Seções marcadas no diálogo de exportação (sem lista = relatório completo). */
const mostra = (id: string) => !dados.value?.secoes || dados.value.secoes.includes(id);
const umAno = computed(() => !!a.value && a.value.periodo.de.slice(0, 4) === a.value.periodo.ate.slice(0, 4));
const fmtPreco = (v: string | null) =>
  v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '—';
</script>

<template>
  <div v-if="erro" class="py-24 text-center text-sm text-muted-foreground">
    Link de impressão inválido ou expirado.
  </div>
  <div v-else-if="!dados || !a" class="py-24 text-center text-sm text-muted-foreground">Carregando…</div>
  <article
    v-else
    class="space-y-5 text-sm"
    :class="dados.quebra ? '[&>section:nth-of-type(n+2)]:break-before-page' : ''"
  >
    <header class="flex items-end justify-between border-b pb-3">
      <div>
        <img src="/brand/logo-meta-hospitalar.webp" alt="Metahospitalar" class="h-9 w-auto" />
        <h1 class="mt-2 text-xl font-semibold">Análise de descontos</h1>
        <p class="text-muted-foreground">
          {{ periodoPorExtenso(a.periodo.de, a.periodo.ate) }} · preço de tabela × notas fiscais do Focco
        </p>
        <p class="text-xs text-muted-foreground">
          Desconto = preço de tabela × quantidade − valor vendido<template v-if="!umAno">
            · cada mês usa a tabela do seu ano</template
          >
        </p>
      </div>
      <div class="text-right text-xs text-muted-foreground">
        <p>Gerado por {{ dados.geradoPor }}</p>
        <p>{{ formatDateTime(dados.geradoEm) }}</p>
      </div>
    </header>

    <p v-if="!a.temDados" class="py-16 text-center text-muted-foreground">Nenhuma nota fiscal importada.</p>
    <template v-else>
      <section v-if="mostra('kpis')" class="grid grid-cols-4 gap-3" aria-label="Indicadores de desconto">
        <DashboardKpiCard
          rotulo="Valor de tabela"
          icone="i-lucide-book-open"
          :valor="formatBRL(a.resumo.valorTabela)"
          compacto
        />
        <DashboardKpiCard
          rotulo="Vendido (itens com preço)"
          icone="i-lucide-banknote"
          :valor="formatBRL(a.resumo.vendidoComPreco)"
          compacto
        />
        <DashboardKpiCard
          rotulo="Desconto previsto"
          icone="i-lucide-badge-percent"
          :valor="`${formatBRL(a.resumo.desconto)} · ${formatPct(a.resumo.percentual)}`"
          compacto
        />
        <DashboardKpiCard
          rotulo="Cobertura da tabela"
          icone="i-lucide-gauge"
          :valor="`${formatPct(a.resumo.cobertura)} do faturamento`"
          compacto
        />
      </section>

      <section v-if="mostra('produtos')" class="rounded-xl border">
        <div class="px-4 pt-4 pb-2">
          <h2 class="text-sm font-medium text-muted-foreground">Desconto por produto</h2>
          <p class="text-xs text-muted-foreground">
            {{ formatInt(a.resumo.produtosComPreco) }} de {{ formatInt(a.resumo.produtos) }} produtos com
            preço de tabela · maior desconto primeiro · negativo = vendido acima da tabela
          </p>
        </div>
        <table class="w-full text-[10px] leading-tight">
          <thead class="bg-muted/50 text-muted-foreground">
            <tr>
              <th class="w-8 px-2 py-0.5 text-left font-medium">#</th>
              <th class="px-2 py-0.5 text-left font-medium">Código</th>
              <th class="px-2 py-0.5 text-left font-medium">Descrição</th>
              <th class="px-2 py-0.5 text-left font-medium">Un.</th>
              <th class="px-2 py-0.5 text-right font-medium">Qtd.</th>
              <th class="px-2 py-0.5 text-right font-medium whitespace-nowrap">Vendido</th>
              <th v-if="umAno" class="px-2 py-0.5 text-right font-medium whitespace-nowrap">Preço tabela</th>
              <th class="px-2 py-0.5 text-right font-medium whitespace-nowrap">Valor tabela</th>
              <th class="px-2 py-0.5 text-right font-medium whitespace-nowrap">Desconto</th>
              <th class="px-2 py-0.5 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="(l, i) in a.produtos" :key="`${l.codigo}|${l.unidade}`" class="break-inside-avoid">
              <td class="num px-2 py-0.5 text-muted-foreground">{{ i + 1 }}</td>
              <td class="num px-2 py-0.5 whitespace-nowrap">{{ l.codigo }}</td>
              <td class="px-2 py-0.5">{{ l.descricao }}</td>
              <td class="px-2 py-0.5">{{ l.unidade || '—' }}</td>
              <td class="num px-2 py-0.5 text-right">{{ formatInt(l.quantidade) }}</td>
              <td class="num px-2 py-0.5 text-right whitespace-nowrap">{{ formatBRL(l.vendido) }}</td>
              <td v-if="umAno" class="num px-2 py-0.5 text-right whitespace-nowrap">
                {{ fmtPreco(l.preco) }}
              </td>
              <td class="num px-2 py-0.5 text-right whitespace-nowrap">
                {{ l.valorTabela ? formatBRL(l.valorTabela) : 'sem preço' }}{{ l.precoParcial ? ' *' : '' }}
              </td>
              <td class="num px-2 py-0.5 text-right whitespace-nowrap">
                {{ l.desconto ? formatBRL(l.desconto) : '—' }}
              </td>
              <td class="num px-2 py-0.5 text-right">{{ formatPct(l.percentual) }}</td>
            </tr>
          </tbody>
          <tfoot class="border-t font-medium">
            <tr>
              <td class="px-2 py-0.5" colspan="5">Total do período</td>
              <td class="num px-2 py-0.5 text-right whitespace-nowrap">
                {{ formatBRL(a.resumo.vendidoTotal) }}
              </td>
              <td v-if="umAno" />
              <td class="num px-2 py-0.5 text-right whitespace-nowrap">
                {{ formatBRL(a.resumo.valorTabela) }}
              </td>
              <td class="num px-2 py-0.5 text-right whitespace-nowrap">{{ formatBRL(a.resumo.desconto) }}</td>
              <td class="num px-2 py-0.5 text-right">{{ formatPct(a.resumo.percentual) }}</td>
            </tr>
          </tfoot>
        </table>
        <p v-if="a.produtos.some((l) => l.precoParcial)" class="px-4 py-2 text-[10px] text-muted-foreground">
          * Parte das vendas é de um ano sem preço de tabela e ficou fora do cálculo.
        </p>
      </section>
    </template>
  </article>
</template>
