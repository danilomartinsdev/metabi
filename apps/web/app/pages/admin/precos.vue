<script setup lang="ts">
import { precoTabelaSchema, type ProdutoPreco, produtoNovoSchema } from '@metabi/shared';
import {
  useExcluirProduto,
  useIncluirProduto,
  usePrecosQuery,
  useSalvarPrecos,
} from '~/composables/api/useDescontos';

// Tabela de preços por ano: base da Análise de descontos. Lista os produtos que já saíram em nota (qualquer
// ano) e os incluídos à mão; cada ano tem a sua tabela, então mexer num ano não muda os outros.
definePageMeta({ titulo: 'Tabela de preços', permissao: 'precos.edit' });
useHead({ title: 'Tabela de preços — MetaBI' });

const route = useRoute();
const router = useRouter();
const aviso = useAviso();
const confirmar = useConfirmacao();
const anoAtual = new Date().getFullYear();

const ano = computed(() => {
  const n = Number(route.query.ano);
  return Number.isInteger(n) && n >= 2020 && n <= 2100 ? n : anoAtual;
});
const q = usePrecosQuery(ano);
const t = computed(() => q.data.value);
const anos = computed(() =>
  [...new Set([anoAtual + 1, anoAtual, ...(t.value?.anos ?? [])])]
    .sort((a, b) => b - a)
    .map((a) => ({ label: String(a), value: a })),
);

const descartar = () =>
  confirmar({
    titulo: 'Descartar alterações?',
    descricao: 'Há preços digitados que ainda não foram salvos.',
    rotuloConfirmar: 'Descartar',
    perigo: true,
  });
async function trocarAno(v: number) {
  if (alterado.value && !(await descartar())) return;
  edicoes.value = {};
  void router.replace({ query: { ...route.query, ano: String(v) } });
}

// ---- Edição ----
const chave = (p: Pick<ProdutoPreco, 'codigo' | 'unidade'>) => `${p.codigo}\u0000${p.unidade}`;
const fmtPreco = (v: string | null) =>
  v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '';
/** Texto digitado por produto (só o que mudou em relação ao gravado). */
const edicoes = ref<Record<string, string>>({});
const valorCampo = (p: ProdutoPreco) => edicoes.value[chave(p)] ?? fmtPreco(p.preco);
function editar(p: ProdutoPreco, v: string) {
  const k = chave(p);
  if (v.trim() === fmtPreco(p.preco).trim()) {
    const { [k]: _, ...resto } = edicoes.value;
    edicoes.value = resto;
  } else edicoes.value = { ...edicoes.value, [k]: v };
}
const invalido = (v: string) => !!v.trim() && !precoTabelaSchema.safeParse(v).success;
const alterado = computed(() => Object.keys(edicoes.value).length > 0);
const anterioresDisponiveis = computed(
  () => t.value?.produtos.filter((p) => !p.preco && p.precoAnoAnterior && !(chave(p) in edicoes.value)) ?? [],
);
function preencherDoAnoAnterior() {
  const n = anterioresDisponiveis.value.length;
  const novos = { ...edicoes.value };
  for (const p of anterioresDisponiveis.value) novos[chave(p)] = fmtPreco(p.precoAnoAnterior);
  edicoes.value = novos;
  aviso.sucesso(`${n} preços de ${ano.value - 1} copiados. Confira e clique em Salvar.`);
}

const salvarM = useSalvarPrecos();
async function salvar() {
  const mudancas = (t.value?.produtos ?? []).filter((p) => chave(p) in edicoes.value);
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
        preco: edicoes.value[chave(p)]!.trim() ? precoTabelaSchema.parse(edicoes.value[chave(p)]) : null,
      })),
    });
    edicoes.value = {};
    aviso.sucesso(`Tabela de preços de ${ano.value} salva.`);
  } catch (e) {
    aviso.erro(e, 'Verifique os preços digitados.');
  }
}

// ---- Filtros ----
const busca = ref('');
const filtro = ref<'todos' | 'sem' | 'com' | 'manuais'>('todos');
const FILTROS = [
  { label: 'Todos', value: 'todos' },
  { label: 'Sem preço', value: 'sem' },
  { label: 'Com preço', value: 'com' },
  { label: 'Incluídos à mão', value: 'manuais' },
];
const limite = ref(100);
const filtrados = computed(() => {
  const b = busca.value.trim().toLowerCase();
  return (t.value?.produtos ?? []).filter((p) => {
    if (b && !p.codigo.toLowerCase().includes(b) && !p.descricao.toLowerCase().includes(b)) return false;
    if (filtro.value === 'sem') return !p.preco;
    if (filtro.value === 'com') return !!p.preco;
    if (filtro.value === 'manuais') return p.manual;
    return true;
  });
});
watch([busca, filtro, ano], () => (limite.value = 100));
const visiveis = computed(() => filtrados.value.slice(0, limite.value));
const comPreco = computed(() => t.value?.produtos.filter((p) => p.preco).length ?? 0);

// ---- Incluir / excluir produto ----
const incluindo = ref(false);
const novo = reactive({ codigo: '', descricao: '', unidade: 'UN', preco: '' });
const erroNovo = ref('');
const incluirM = useIncluirProduto();
function abrirInclusao() {
  Object.assign(novo, { codigo: '', descricao: '', unidade: 'UN', preco: '' });
  erroNovo.value = '';
  incluindo.value = true;
}
async function incluir() {
  const p = produtoNovoSchema.safeParse(novo);
  if (!p.success) {
    erroNovo.value = p.error.issues[0]?.message ?? 'Dados inválidos.';
    return;
  }
  if (invalido(novo.preco)) {
    erroNovo.value = 'Preço inválido. Use o formato 1.234,5678.';
    return;
  }
  try {
    const criado = await incluirM.mutateAsync(p.data);
    if (novo.preco.trim()) {
      await salvarM.mutateAsync({
        ano: ano.value,
        precos: [
          {
            ...{ produtoCodigo: criado.codigo, unidade: criado.unidade },
            preco: precoTabelaSchema.parse(novo.preco),
          },
        ],
      });
    }
    incluindo.value = false;
    busca.value = criado.codigo;
    aviso.sucesso(`Produto ${criado.codigo} incluído.`);
  } catch (e) {
    erroNovo.value = e instanceof Error ? e.message : 'Não foi possível incluir o produto.';
  }
}
const excluirM = useExcluirProduto();
async function excluir(p: ProdutoPreco) {
  await confirmar({
    titulo: `Excluir ${p.codigo}?`,
    descricao: `O produto incluído à mão sai da tabela, junto com os preços dele em todos os anos.`,
    rotuloConfirmar: 'Excluir',
    perigo: true,
    acao: async () => {
      await excluirM.mutateAsync({ codigo: p.codigo, unidade: p.unidade });
      const { [chave(p)]: _, ...resto } = edicoes.value;
      edicoes.value = resto;
      aviso.sucesso(`Produto ${p.codigo} excluído.`);
    },
  });
}

onBeforeRouteLeave(async () => !alterado.value || (await descartar()));
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <UiExtraPageHeader
      titulo="Tabela de preços"
      descricao="Preço de tabela de cada produto por ano. É a base da Análise de descontos."
    >
      <USelect
        :model-value="ano"
        :items="anos"
        class="w-28"
        aria-label="Ano da tabela"
        @update:model-value="(v) => trocarAno(Number(v))"
      />
      <UButton
        icon="i-lucide-plus"
        label="Incluir produto"
        color="neutral"
        variant="outline"
        @click="abrirInclusao"
      />
    </UiExtraPageHeader>

    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :description="`Os preços de ${ano} valem só para as vendas de ${ano}: mudar esta tabela não altera os outros anos. A lista traz todo produto que já saiu em nota fiscal, mais os incluídos à mão.`"
    />

    <UiExtraEstadoBloco v-if="q.error.value" :erro="q.error.value" @tentar-de-novo="q.refetch()" />
    <section v-else class="rounded-xl border bg-card">
      <div class="flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <UInput
          v-model="busca"
          icon="i-lucide-search"
          placeholder="Buscar código ou descrição"
          class="w-full sm:w-72"
          aria-label="Buscar produto"
        />
        <USelect v-model="filtro" :items="FILTROS" class="w-44" aria-label="Mostrar" />
        <span class="text-xs text-muted-foreground">
          {{ formatInt(comPreco) }} de {{ formatInt(t?.produtos.length ?? 0) }} produtos com preço em
          {{ ano }}
        </span>
        <div class="ml-auto flex flex-wrap items-center gap-2">
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
        texto-vazio="Nenhum produto encontrado. Importe as notas fiscais ou inclua um produto."
        :linhas="10"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-4 py-3 font-medium">Código</th>
                <th class="px-4 py-3 font-medium">Descrição</th>
                <th class="px-4 py-3 font-medium">Un.</th>
                <th class="px-4 py-3 font-medium">Última venda</th>
                <th class="px-4 py-3 text-right font-medium">Preço {{ ano - 1 }}</th>
                <th class="px-4 py-3 text-right font-medium">Preço {{ ano }}</th>
                <th class="w-10 px-2 py-3"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="p in visiveis" :key="chave(p)">
                <td class="num px-4 py-2 font-medium whitespace-nowrap">{{ p.codigo }}</td>
                <td class="px-4 py-2">
                  <span class="block max-w-md truncate" :title="p.descricao">{{ p.descricao }}</span>
                  <UBadge v-if="p.manual" color="neutral" variant="soft" size="sm" label="Incluído à mão" />
                </td>
                <td class="px-4 py-2 text-muted-foreground">{{ p.unidade || '—' }}</td>
                <td class="num px-4 py-2 text-muted-foreground">
                  {{ p.ultimaVenda ? formatDate(p.ultimaVenda) : '—' }}
                </td>
                <td class="num px-4 py-2 text-right text-muted-foreground">
                  {{ p.precoAnoAnterior ? `R$ ${fmtPreco(p.precoAnoAnterior)}` : '—' }}
                </td>
                <td class="px-4 py-2 text-right">
                  <UInput
                    :model-value="valorCampo(p)"
                    inputmode="decimal"
                    placeholder="—"
                    size="sm"
                    class="ml-auto w-36"
                    :ui="{ base: 'num text-right' }"
                    :color="invalido(valorCampo(p)) ? 'error' : undefined"
                    :highlight="invalido(valorCampo(p)) || chave(p) in edicoes"
                    :aria-invalid="invalido(valorCampo(p)) || undefined"
                    :aria-label="`Preço de ${p.codigo} em ${ano}`"
                    @update:model-value="editar(p, String($event ?? ''))"
                  />
                </td>
                <td class="px-2 py-2">
                  <UButton
                    v-if="p.manual"
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="sm"
                    :aria-label="`Excluir ${p.codigo}`"
                    @click="excluir(p)"
                  />
                </td>
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

    <UModal
      v-model:open="incluindo"
      title="Incluir produto"
      description="Para um produto que ainda não saiu em nota fiscal. Quando ele aparecer nas notas, os preços continuam valendo."
    >
      <template #body>
        <form id="form-produto" class="space-y-4" @submit.prevent="incluir">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_6rem]">
            <UFormField label="Código" required>
              <UInput v-model="novo.codigo" class="w-full" placeholder="Ex.: MT900" />
            </UFormField>
            <UFormField label="Unidade">
              <UInput v-model="novo.unidade" class="w-full" placeholder="UN" />
            </UFormField>
          </div>
          <UFormField label="Descrição" required>
            <UInput v-model="novo.descricao" class="w-full" />
          </UFormField>
          <UFormField :label="`Preço de tabela ${ano}`" hint="Opcional">
            <UInput
              v-model="novo.preco"
              inputmode="decimal"
              class="w-full"
              placeholder="0,00"
              :color="invalido(novo.preco) ? 'error' : undefined"
            />
          </UFormField>
          <p v-if="erroNovo" class="text-sm text-error" role="alert">{{ erroNovo }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancelar" @click="incluindo = false" />
          <UButton
            type="submit"
            form="form-produto"
            icon="i-lucide-plus"
            label="Incluir"
            :loading="incluirM.isPending.value || salvarM.isPending.value"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
