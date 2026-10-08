<script setup lang="ts">
import { valorMetaSchema } from '@meta-bi/shared';
import { useHistoricoQuery, useSalvarHistorico } from '~/composables/api/useCadastros';
import { useLotesFaturamentoQuery } from '~/composables/api/useFaturamento';

definePageMeta({ titulo: 'Histórico', permissao: 'metas.edit' });
useHead({ title: 'Histórico de faturamento — BI Metahospitalar' });

const aviso = useAviso();
const can = useCan();
const podeImportar = computed(() => can('faturamento.import'));
const importando = ref(false);
const lotesQ = useLotesFaturamentoQuery(podeImportar);
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const anoAtual = new Date().getFullYear();
const ANOS = Array.from({ length: 6 }, (_, i) => anoAtual - i);
const ano = ref(anoAtual - 1);

const q = useHistoricoQuery(ano);
const salvarMut = useSalvarHistorico();

const fmt = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const grade = ref<string[]>(Array(12).fill(''));
const original = ref<string[]>(Array(12).fill(''));
watch(
  () => q.data.value,
  (d) => {
    const g = Array.from({ length: 12 }, (_, i) => {
      const v = d?.find((m) => m.mes === i + 1)?.valor;
      return v ? fmt(v) : '';
    });
    grade.value = [...g];
    original.value = [...g];
  },
  { immediate: true },
);

const alterado = computed(() => grade.value.some((v, i) => v.trim() !== original.value[i]!.trim()));
const invalida = (v: string) => !!v.trim() && !valorMetaSchema.safeParse(v).success;
const temPedidos = (i: number) => !!q.data.value?.find((m) => m.mes === i + 1)?.temPedidos;

/** Soma do ano só para conferência visual (o cálculo oficial é feito na API, em Decimal). */
const somaAno = computed(() =>
  grade.value.reduce((s, v) => {
    const r = valorMetaSchema.safeParse(v);
    return v.trim() && r.success ? s + Number(r.data) : s;
  }, 0),
);

async function salvar() {
  if (grade.value.some(invalida)) {
    aviso.erro('Há valores inválidos (em vermelho). Use o formato 1.234.567,89.');
    return;
  }
  const meses = grade.value
    .map((v, i) => ({ mes: i + 1, valor: v.trim() || null, antes: original.value[i]!.trim() || null }))
    .filter((m) => m.valor !== m.antes)
    .map(({ mes, valor }) => ({ mes, valor }));
  try {
    await salvarMut.mutateAsync({ ano: ano.value, meses });
    aviso.sucesso(`Faturamento de ${ano.value} salvo.`);
  } catch (e) {
    aviso.erro(e, 'Verifique os valores digitados.');
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <UiExtraPageHeader
      titulo="Histórico de faturamento"
      descricao="Total faturado pela empresa em cada mês de anos anteriores, para os comparativos com o ano anterior."
    >
      <USelect v-model="ano" :items="ANOS" class="w-28" aria-label="Ano" />
      <UBadge v-if="alterado" color="warning" variant="soft" label="Alterações não salvas" />
      <UButton icon="i-lucide-save" label="Salvar" :loading="salvarMut.isPending.value" @click="salvar" />
    </UiExtraPageHeader>

    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      description="O valor digitado só é usado em meses sem pedidos importados do Focco — havendo pedidos, valem os pedidos. Entra no total vendido, na evolução mensal, no acumulado e no PDF, para quem vê a empresa inteira sem filtros."
    />

    <section class="rounded-xl border bg-card">
      <UiExtraEstadoBloco
        :carregando="q.isPending.value"
        :erro="q.error.value"
        :linhas="12"
        @tentar-de-novo="q.refetch()"
      >
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th class="px-5 py-3 font-medium">Mês</th>
              <th class="px-5 py-3 text-right font-medium">Faturamento (R$)</th>
              <th class="px-5 py-3 font-medium"><span class="sr-only">Situação</span></th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="(m, i) in MESES" :key="m">
              <th scope="row" class="px-5 py-2 text-left font-medium">{{ m }}/{{ ano }}</th>
              <td class="px-5 py-2 text-right">
                <UInput
                  v-model="grade[i]"
                  inputmode="decimal"
                  placeholder="—"
                  size="sm"
                  class="ml-auto w-48"
                  :ui="{ base: 'num text-right' }"
                  :color="invalida(grade[i]!) ? 'error' : undefined"
                  :highlight="invalida(grade[i]!)"
                  :aria-invalid="invalida(grade[i]!) || undefined"
                  :aria-label="`Faturamento de ${m}/${ano}`"
                />
              </td>
              <td class="px-5 py-2 text-xs">
                <UBadge
                  v-if="temPedidos(i)"
                  color="neutral"
                  variant="soft"
                  label="Tem pedidos importados — valor ignorado"
                />
              </td>
            </tr>
          </tbody>
          <tfoot class="border-t-2">
            <tr>
              <th scope="row" class="px-5 py-3 text-left font-semibold">Total digitado</th>
              <td class="num px-5 py-3 text-right font-semibold">{{ formatBRL(somaAno) }}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </UiExtraEstadoBloco>
    </section>
    <section v-if="podeImportar" class="rounded-xl border bg-card" aria-labelledby="titulo-importacoes">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h3 id="titulo-importacoes" class="font-semibold">Importações de faturamento</h3>
          <p class="text-sm text-muted-foreground">
            Relatório diário de faturamento do Focco — alimenta a tela Faturamento.
          </p>
        </div>
        <UButton icon="i-lucide-file-up" label="Importar faturamento" @click="importando = true" />
      </div>
      <UiExtraEstadoBloco
        :carregando="lotesQ.isPending.value"
        :erro="lotesQ.error.value"
        :linhas="3"
        @tentar-de-novo="lotesQ.refetch()"
      >
        <p v-if="!lotesQ.data.value?.length" class="px-5 py-6 text-sm text-muted-foreground">
          Nenhuma importação de faturamento ainda.
        </p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-5 py-3 font-medium">Quando</th>
                <th class="px-5 py-3 font-medium">Arquivo</th>
                <th class="px-5 py-3 text-right font-medium">Ano</th>
                <th class="px-5 py-3 text-right font-medium">Dias</th>
                <th class="px-5 py-3 text-right font-medium">Fatura DRE</th>
                <th class="px-5 py-3 font-medium">Por</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="l in lotesQ.data.value.slice(0, 10)" :key="l.id">
                <td class="num px-5 py-2 whitespace-nowrap">{{ formatDateTime(l.createdAt) }}</td>
                <td class="max-w-56 truncate px-5 py-2" :title="l.arquivoNome">{{ l.arquivoNome }}</td>
                <td class="num px-5 py-2 text-right">{{ l.ano }}</td>
                <td class="num px-5 py-2 text-right">{{ formatInt(l.dias) }}</td>
                <td class="num px-5 py-2 text-right whitespace-nowrap">{{ formatBRL(l.totalDre) }}</td>
                <td class="px-5 py-2">{{ l.usuario ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiExtraEstadoBloco>
    </section>

    <FaturamentoImportarFaturamento v-if="podeImportar" v-model:aberto="importando" />
  </div>
</template>
