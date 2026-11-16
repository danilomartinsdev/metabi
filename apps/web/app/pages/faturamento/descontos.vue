<script setup lang="ts">
import { useAnaliseDescontosQuery } from '~/composables/api/useDescontos';
import { deslocarMes, periodoPorExtenso } from '~/utils/periodo';

// Análise de descontos: preço de tabela (cadastrado em Administração › Tabela de preços) × o que foi vendido
// no período (itens de NF do Focco). Número da empresa inteira (escopo "todos"), como a Análise de faturamento.
definePageMeta({ titulo: 'Análise de descontos', permissao: 'descontos.view' });
useHead({ title: 'Análise de descontos — MetaBI' });

const route = useRoute();
const router = useRouter();
const can = useCan();

// ---- Período (de/até na URL, como na Análise de faturamento) ----
const mesValido = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : undefined;
const de = computed(() => mesValido(route.query.de));
const ate = computed(() => mesValido(route.query.ate));
const qs = computed(() =>
  new URLSearchParams(
    Object.entries({ de: de.value, ate: ate.value }).filter(([, v]) => v) as [string, string][],
  ).toString(),
);
const q = useAnaliseDescontosQuery(qs);
const r = computed(() => q.data.value);
const periodo = computed(() => r.value?.periodo);
const carregando = computed(() => q.isPending.value);

function mudar(campo: 'de' | 'ate', valor: string) {
  const p = {
    de: de.value ?? periodo.value?.de ?? valor,
    ate: ate.value ?? periodo.value?.ate ?? valor,
    [campo]: valor,
  };
  if (p.de > p.ate) {
    if (campo === 'de') p.ate = p.de;
    else p.de = p.ate;
  }
  void router.replace({ query: { ...route.query, ...p } });
}
function atalho(tipo: 'mes' | 'ano') {
  const fim = periodo.value?.ate;
  if (!fim) return;
  void router.replace({
    query: { ...route.query, de: tipo === 'mes' ? fim : `${fim.slice(0, 4)}-01`, ate: fim },
  });
}
const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const opcoesMes = computed(() => {
  const hoje = new Date().toISOString().slice(0, 7);
  const lista: { label: string; value: string }[] = [];
  for (let m = `${Number(hoje.slice(0, 4)) - 2}-01`; m <= hoje; m = deslocarMes(m, 1)) {
    lista.unshift({ label: `${NOMES[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}`, value: m });
  }
  return lista;
});
/** Período num ano só: a tabela mostra o preço de tabela; cruzando anos, cada mês usa o do seu ano. */
const umAno = computed(
  () => !!periodo.value && periodo.value.de.slice(0, 4) === periodo.value.ate.slice(0, 4),
);
const anoTabela = computed(() => periodo.value?.ate.slice(0, 4) ?? String(new Date().getFullYear()));

const cards = computed(() => {
  const s = r.value?.resumo;
  return [
    { rotulo: 'Valor de tabela', icone: 'i-lucide-book-open', valor: formatBRL(s?.valorTabela) },
    { rotulo: 'Vendido (itens com preço)', icone: 'i-lucide-banknote', valor: formatBRL(s?.vendidoComPreco) },
    {
      rotulo: 'Desconto previsto',
      icone: 'i-lucide-badge-percent',
      valor: `${formatBRL(s?.desconto)} · ${formatPct(s?.percentual)}`,
    },
    {
      rotulo: 'Cobertura da tabela',
      icone: 'i-lucide-gauge',
      valor: `${formatPct(s?.cobertura)} do faturamento`,
    },
  ];
});

// ---- Lista por produto ----
const busca = ref('');
const filtro = ref<'todos' | 'com' | 'sem'>('todos');
const FILTROS = [
  { label: 'Todos os produtos', value: 'todos' },
  { label: 'Com preço de tabela', value: 'com' },
  { label: 'Sem preço de tabela', value: 'sem' },
];
const limite = ref(100);
const filtrados = computed(() => {
  const b = busca.value.trim().toLowerCase();
  return (r.value?.produtos ?? []).filter(
    (p) =>
      (!b || p.codigo.toLowerCase().includes(b) || p.descricao.toLowerCase().includes(b)) &&
      (filtro.value === 'todos' || (filtro.value === 'com') === (p.valorTabela !== null)),
  );
});
watch([busca, filtro, qs], () => (limite.value = 100));
const visiveis = computed(() => filtrados.value.slice(0, limite.value));
const fmtPreco = (v: string | null) =>
  v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '—';
</script>

<template>
  <div class="space-y-4 lg:space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-2xl font-semibold">Análise de descontos</h2>
        <p class="text-sm text-muted-foreground">
          {{ periodo ? periodoPorExtenso(periodo.de, periodo.ate) : 'Carregando período…' }}
          <template v-if="r?.temDados"> · preço de tabela × notas fiscais do Focco</template>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <DashboardExportarMenu v-if="r?.temDados" relatorio="analise-descontos" :consulta="qs" />
        <UButton
          v-if="can('precos.edit')"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-circle-dollar-sign"
          label="Tabela de preços"
          :to="`/admin/precos?ano=${anoTabela}`"
        />
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <UIcon name="i-lucide-calendar-days" class="size-4 text-muted-foreground" />
      <USelect
        :model-value="periodo?.de"
        :items="opcoesMes"
        size="sm"
        class="w-28"
        aria-label="Mês inicial"
        @update:model-value="(v) => mudar('de', String(v))"
      />
      <span class="text-sm text-muted-foreground">até</span>
      <USelect
        :model-value="periodo?.ate"
        :items="opcoesMes"
        size="sm"
        class="w-28"
        aria-label="Mês final"
        @update:model-value="(v) => mudar('ate', String(v))"
      />
      <UButton color="neutral" variant="ghost" size="sm" label="Último mês" @click="atalho('mes')" />
      <UButton color="neutral" variant="ghost" size="sm" label="Acumulado do ano" @click="atalho('ano')" />
    </div>

    <UiExtraEstadoBloco v-if="q.error.value" :erro="q.error.value" @tentar-de-novo="q.refetch()" />
    <section
      v-else-if="r && !r.temDados"
      class="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-16 text-center"
    >
      <UIcon name="i-lucide-receipt" class="size-8 text-muted-foreground" />
      <p class="font-medium">Nenhuma nota fiscal importada ainda</p>
      <p class="text-sm text-muted-foreground">
        A análise compara as notas fiscais do Focco com a tabela de preços.
      </p>
    </section>
    <template v-else>
      <section
        aria-label="Indicadores de desconto"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <DashboardKpiCard
          v-for="c in cards"
          :key="c.rotulo"
          :rotulo="c.rotulo"
          :icone="c.icone"
          :carregando="carregando"
          :valor="c.valor"
          compacto
        />
      </section>

      <UAlert
        v-if="r && r.resumo.produtos && !r.resumo.produtosComPreco"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Nenhum produto vendido no período tem preço de tabela"
        :description="
          can('precos.edit')
            ? 'Cadastre os preços em Administração › Tabela de preços para calcular o desconto.'
            : 'Peça a um administrador para cadastrar os preços na Tabela de preços.'
        "
      />

      <section class="rounded-xl border bg-card" aria-labelledby="titulo-produtos">
        <div class="flex flex-wrap items-center gap-2 border-b px-5 py-3">
          <div class="mr-auto">
            <h3 id="titulo-produtos" class="text-sm font-medium text-muted-foreground">
              Desconto por produto
            </h3>
            <p class="text-xs text-muted-foreground">
              Desconto = preço de tabela × quantidade − valor vendido · maior desconto primeiro
              <template v-if="!umAno"> · cada mês usa a tabela do seu ano</template>
            </p>
          </div>
          <UInput
            v-model="busca"
            icon="i-lucide-search"
            placeholder="Buscar código ou descrição"
            size="sm"
            class="w-full sm:w-64"
            aria-label="Buscar produto"
          />
          <USelect v-model="filtro" :items="FILTROS" size="sm" class="w-48" aria-label="Mostrar" />
        </div>
        <UiExtraEstadoBloco
          :carregando="carregando"
          :vazio="!filtrados.length"
          texto-vazio="Nenhum produto vendido no período (ou nenhum corresponde à busca)."
          :linhas="10"
        >
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 font-medium">Produto</th>
                  <th class="px-4 py-3 font-medium">Un.</th>
                  <th class="px-4 py-3 text-right font-medium">Qtd.</th>
                  <th class="px-4 py-3 text-right font-medium">Vendido</th>
                  <th v-if="umAno" class="px-4 py-3 text-right font-medium">Preço de tabela</th>
                  <th class="px-4 py-3 text-right font-medium">Valor de tabela</th>
                  <th class="px-4 py-3 text-right font-medium">Desconto</th>
                  <th class="px-4 py-3 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="p in visiveis" :key="`${p.codigo}|${p.unidade}`">
                  <td class="px-4 py-2">
                    <span class="font-medium">{{ p.codigo }}</span>
                    <span class="block max-w-md truncate text-xs text-muted-foreground" :title="p.descricao">
                      {{ p.descricao }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-muted-foreground">{{ p.unidade || '—' }}</td>
                  <td class="num px-4 py-2 text-right">{{ formatInt(p.quantidade) }}</td>
                  <td class="num px-4 py-2 text-right">{{ formatBRL(p.vendido) }}</td>
                  <td v-if="umAno" class="num px-4 py-2 text-right">{{ fmtPreco(p.preco) }}</td>
                  <td class="num px-4 py-2 text-right">
                    <template v-if="p.valorTabela">{{ formatBRL(p.valorTabela) }}</template>
                    <span v-else class="text-xs text-muted-foreground">sem preço</span>
                    <UIcon
                      v-if="p.precoParcial"
                      name="i-lucide-circle-alert"
                      class="ml-1 size-3.5 align-[-2px] text-warning"
                      title="Parte das vendas é de um ano sem preço e ficou fora do cálculo"
                    />
                  </td>
                  <td
                    class="num px-4 py-2 text-right"
                    :class="p.desconto && Number(p.desconto) < 0 ? 'text-error' : ''"
                  >
                    {{ p.desconto ? formatBRL(p.desconto) : '—' }}
                  </td>
                  <td class="num px-4 py-2 text-right">{{ formatPct(p.percentual) }}</td>
                </tr>
              </tbody>
              <tfoot v-if="r" class="border-t bg-muted/30 font-medium">
                <tr>
                  <td class="px-4 py-2.5" colspan="3">Total do período</td>
                  <td class="num px-4 py-2.5 text-right">{{ formatBRL(r.resumo.vendidoTotal) }}</td>
                  <td v-if="umAno" />
                  <td class="num px-4 py-2.5 text-right">{{ formatBRL(r.resumo.valorTabela) }}</td>
                  <td class="num px-4 py-2.5 text-right">{{ formatBRL(r.resumo.desconto) }}</td>
                  <td class="num px-4 py-2.5 text-right">{{ formatPct(r.resumo.percentual) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div v-if="filtrados.length > limite" class="border-t px-5 py-3 text-center">
            <UButton
              color="neutral"
              variant="ghost"
              :label="`Mostrar mais (${filtrados.length - limite} restantes)`"
              @click="limite += 200"
            />
          </div>
          <p class="border-t px-5 py-3 text-xs text-muted-foreground">
            Desconto negativo (em vermelho) = vendido acima do preço de tabela. Produtos sem preço ficam fora
            do total de desconto; a cobertura mostra quanto do faturamento entrou no cálculo.
          </p>
        </UiExtraEstadoBloco>
      </section>
    </template>
  </div>
</template>
