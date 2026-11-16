<script setup lang="ts">
import { precoTabelaSchema, type DescontoProduto } from '@metabi/shared';
import type { TabsItem } from '@nuxt/ui';
import { useDescontosQuery, useSalvarPrecos } from '~/composables/api/useDescontos';

// Previsão de descontos: preço de tabela (por ano) × o que foi vendido no ano (itens de NF do Focco).
// Número da empresa inteira (escopo "todos"), como a Análise de faturamento.
definePageMeta({ titulo: 'Previsão de descontos', permissao: 'descontos.view' });
useHead({ title: 'Previsão de descontos — MetaBI' });

const route = useRoute();
const router = useRouter();
const aviso = useAviso();
const can = useCan();
const podeEditar = computed(() => can('precos.edit'));
const anoAtual = new Date().getFullYear();

const ano = computed(() => {
  const n = Number(route.query.ano);
  return Number.isInteger(n) && n >= 2020 && n <= 2100 ? n : anoAtual;
});
const q = useDescontosQuery(ano);
const r = computed(() => q.data.value);
const anos = computed(() =>
  [...new Set([anoAtual + 1, anoAtual, ...(r.value?.anos ?? [])])]
    .sort((a, b) => b - a)
    .map((a) => ({ label: String(a), value: a })),
);
const anoSel = computed({
  get: () => ano.value,
  set: (v: number) => {
    if (alterado.value && !confirm('Há preços não salvos. Trocar de ano e descartar as alterações?')) return;
    edicoes.value = {};
    void router.replace({ query: { ...route.query, ano: String(v) } });
  },
});

const aba = computed({
  get: () => (route.query.aba === 'representantes' ? 'representantes' : 'produtos'),
  set: (v: string) => void router.replace({ query: { ...route.query, aba: v } }),
});
const abas: TabsItem[] = [
  { label: 'Tabela de preços', value: 'produtos', icon: 'i-lucide-list' },
  { label: 'Por representante', value: 'representantes', icon: 'i-lucide-square-user-round' },
];

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

// ---- Tabela de preços (edição) ----
const chave = (p: Pick<DescontoProduto, 'codigo' | 'unidade'>) => `${p.codigo}\u0000${p.unidade}`;
const fmtPreco = (v: string | null) =>
  v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '';
/** Texto digitado por produto (só o que mudou em relação ao gravado). */
const edicoes = ref<Record<string, string>>({});
const valorCampo = (p: DescontoProduto) => edicoes.value[chave(p)] ?? fmtPreco(p.preco);
function editar(p: DescontoProduto, v: string) {
  const k = chave(p);
  if (v.trim() === fmtPreco(p.preco).trim()) {
    const { [k]: _, ...resto } = edicoes.value;
    edicoes.value = resto;
  } else edicoes.value = { ...edicoes.value, [k]: v };
}
const invalido = (v: string) => !!v.trim() && !precoTabelaSchema.safeParse(v).success;
const alterado = computed(() => Object.keys(edicoes.value).length > 0);
const anterioresDisponiveis = computed(
  () => r.value?.produtos.filter((p) => !p.preco && p.precoAnoAnterior && !(chave(p) in edicoes.value)) ?? [],
);
function preencherDoAnoAnterior() {
  const novos = { ...edicoes.value };
  for (const p of anterioresDisponiveis.value) novos[chave(p)] = fmtPreco(p.precoAnoAnterior);
  edicoes.value = novos;
  aviso.sucesso(
    `${anterioresDisponiveis.value.length} preços de ${ano.value - 1} copiados. Confira e clique em Salvar.`,
  );
}

const salvarM = useSalvarPrecos();
async function salvar() {
  const produtos = r.value?.produtos ?? [];
  const mudancas = produtos.filter((p) => chave(p) in edicoes.value);
  if (mudancas.some((p) => invalido(edicoes.value[chave(p)]!))) {
    aviso.erro('Há preços inválidos (em vermelho). Use o formato 1.234,5678.');
    return;
  }
  try {
    await salvarM.mutateAsync({
      ano: ano.value,
      precos: mudancas.map((p) => ({
        produtoCodigo: p.codigo,
        unidade: p.unidade,
        preco: edicoes.value[chave(p)]!.trim() || null,
      })),
    });
    edicoes.value = {};
    aviso.sucesso(`Tabela de preços de ${ano.value} salva.`);
  } catch (e) {
    aviso.erro(e, 'Verifique os preços digitados.');
  }
}

// ---- Filtros da lista ----
const busca = ref('');
const soSemPreco = ref(false);
const limite = ref(100);
const filtrados = computed(() => {
  const t = busca.value.trim().toLowerCase();
  return (r.value?.produtos ?? []).filter(
    (p) =>
      (!t || p.codigo.toLowerCase().includes(t) || p.descricao.toLowerCase().includes(t)) &&
      (!soSemPreco.value || !p.preco),
  );
});
watch([busca, soSemPreco, ano], () => (limite.value = 100));
const visiveis = computed(() => filtrados.value.slice(0, limite.value));

onBeforeRouteLeave(() => !alterado.value || confirm('Há preços não salvos. Sair e descartar as alterações?'));
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <UiExtraPageHeader
      titulo="Previsão de descontos"
      descricao="Preço de tabela × quantidade vendida, comparado com o valor faturado nas notas fiscais do ano."
    >
      <USelect v-model="anoSel" :items="anos" class="w-28" aria-label="Ano" />
    </UiExtraPageHeader>

    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :description="`Desconto = preço de tabela × quantidade − valor vendido. Cada ano tem a sua própria tabela: alterar os preços de ${ano} não muda os números dos outros anos. Só entram no cálculo os produtos com preço cadastrado.`"
    />

    <UiExtraEstadoBloco v-if="q.error.value" :erro="q.error.value" @tentar-de-novo="q.refetch()" />
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
          :carregando="q.isPending.value"
          :valor="c.valor"
          compacto
        />
      </section>
      <p v-if="r && !r.temNotas" class="text-sm text-muted-foreground">
        Não há notas fiscais importadas em {{ ano }}. Dá para cadastrar os preços agora; o desconto aparece
        quando as notas do ano forem importadas.
      </p>

      <UTabs v-model="aba" :items="abas" :content="false" aria-label="Visão dos descontos" />

      <section v-if="aba === 'produtos'" class="rounded-xl border bg-card">
        <div class="flex flex-wrap items-center gap-2 border-b px-5 py-3">
          <UInput
            v-model="busca"
            icon="i-lucide-search"
            placeholder="Buscar código ou descrição"
            class="w-full sm:w-72"
            aria-label="Buscar produto"
          />
          <USwitch v-model="soSemPreco" label="Só sem preço" />
          <span class="text-xs text-muted-foreground">
            {{ r?.resumo.produtosComPreco ?? 0 }} de {{ r?.resumo.produtos ?? 0 }} produtos com preço
          </span>
          <div v-if="podeEditar" class="ml-auto flex flex-wrap items-center gap-2">
            <UBadge v-if="alterado" color="warning" variant="soft" label="Alterações não salvas" />
            <UButton
              v-if="anterioresDisponiveis.length"
              color="neutral"
              variant="outline"
              icon="i-lucide-copy"
              :label="`Preencher vazios com ${ano - 1}`"
              @click="preencherDoAnoAnterior"
            />
            <UButton
              icon="i-lucide-save"
              label="Salvar"
              :loading="salvarM.isPending.value"
              :disabled="!alterado"
              @click="salvar"
            />
          </div>
        </div>
        <UiExtraEstadoBloco
          :carregando="q.isPending.value"
          :vazio="!filtrados.length"
          texto-vazio="Nenhum produto vendido no ano (ou nenhum corresponde à busca)."
          :linhas="10"
        >
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 font-medium">Produto</th>
                  <th class="px-4 py-3 font-medium">Un.</th>
                  <th class="px-4 py-3 text-right font-medium">Qtd. vendida</th>
                  <th class="px-4 py-3 text-right font-medium">Vendido</th>
                  <th class="px-4 py-3 text-right font-medium">Preço de tabela {{ ano }}</th>
                  <th class="px-4 py-3 text-right font-medium">Valor de tabela</th>
                  <th class="px-4 py-3 text-right font-medium">Desconto</th>
                  <th class="px-4 py-3 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="p in visiveis" :key="chave(p)">
                  <td class="px-4 py-2">
                    <span class="font-medium">{{ p.codigo }}</span>
                    <span class="block max-w-md truncate text-xs text-muted-foreground" :title="p.descricao">
                      {{ p.descricao }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-muted-foreground">{{ p.unidade || '—' }}</td>
                  <td class="num px-4 py-2 text-right">{{ formatInt(p.quantidade) }}</td>
                  <td class="num px-4 py-2 text-right">{{ formatBRL(p.vendido) }}</td>
                  <td class="px-4 py-2 text-right">
                    <UInput
                      v-if="podeEditar"
                      :model-value="valorCampo(p)"
                      inputmode="decimal"
                      :placeholder="p.precoAnoAnterior ? `${ano - 1}: ${fmtPreco(p.precoAnoAnterior)}` : '—'"
                      size="sm"
                      class="ml-auto w-36"
                      :ui="{ base: 'num text-right' }"
                      :color="invalido(valorCampo(p)) ? 'error' : undefined"
                      :highlight="invalido(valorCampo(p)) || chave(p) in edicoes"
                      :aria-invalid="invalido(valorCampo(p)) || undefined"
                      :aria-label="`Preço de tabela de ${p.codigo} em ${ano}`"
                      @update:model-value="editar(p, String($event ?? ''))"
                    />
                    <span v-else class="num">{{ p.preco ? `R$ ${fmtPreco(p.preco)}` : '—' }}</span>
                  </td>
                  <td class="num px-4 py-2 text-right">{{ formatBRL(p.valorTabela) }}</td>
                  <td class="num px-4 py-2 text-right">{{ formatBRL(p.desconto) }}</td>
                  <td class="num px-4 py-2 text-right">{{ formatPct(p.percentual) }}</td>
                </tr>
              </tbody>
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
        </UiExtraEstadoBloco>
      </section>

      <section v-else class="rounded-xl border bg-card">
        <UiExtraEstadoBloco
          :carregando="q.isPending.value"
          :vazio="!r?.representantes.length"
          texto-vazio="Nenhuma venda de produto com preço de tabela no ano."
          :linhas="8"
        >
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 font-medium">Representante</th>
                  <th class="px-4 py-3 text-right font-medium">Valor de tabela</th>
                  <th class="px-4 py-3 text-right font-medium">Vendido</th>
                  <th class="px-4 py-3 text-right font-medium">Desconto</th>
                  <th class="px-4 py-3 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="rep in r?.representantes" :key="rep.codigo">
                  <td class="px-4 py-2 font-medium">{{ rep.nome }}</td>
                  <td class="num px-4 py-2 text-right">{{ formatBRL(rep.valorTabela) }}</td>
                  <td class="num px-4 py-2 text-right">{{ formatBRL(rep.vendido) }}</td>
                  <td class="num px-4 py-2 text-right">{{ formatBRL(rep.desconto) }}</td>
                  <td class="num px-4 py-2 text-right">{{ formatPct(rep.percentual) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="border-t px-5 py-3 text-xs text-muted-foreground">
            Considera só os itens com preço de tabela em {{ ano }}.
          </p>
        </UiExtraEstadoBloco>
      </section>
    </template>
  </div>
</template>
