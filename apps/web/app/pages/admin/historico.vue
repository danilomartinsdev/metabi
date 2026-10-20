<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui';
import {
  useHistoricoFaturamentoQuery,
  useHistoricoQuery,
  useSalvarHistorico,
  useSalvarHistoricoFaturamento,
} from '~/composables/api/useCadastros';

definePageMeta({ titulo: 'Histórico', permissao: 'metas.edit' });
useHead({ title: 'Histórico — MetaBI' });

const route = useRoute();
const router = useRouter();
const aviso = useAviso();
const can = useCan();
const anoAtual = new Date().getFullYear();
const ANOS = Array.from({ length: 6 }, (_, i) => anoAtual - i);
const ano = ref(anoAtual - 1);

const podeFaturamento = computed(() => can('faturamento.import'));
const abas = computed<TabsItem[]>(() => [
  { label: 'Pedidos', value: 'pedidos', icon: 'i-lucide-shopping-cart' },
  ...(podeFaturamento.value
    ? [{ label: 'Faturamento', value: 'faturamento', icon: 'i-lucide-banknote' }]
    : []),
]);
const aba = computed({
  get: () => (route.query.aba === 'faturamento' && podeFaturamento.value ? 'faturamento' : 'pedidos'),
  set: (v: string) => void router.replace({ query: { ...route.query, aba: v } }),
});

const pedidosQ = useHistoricoQuery(ano);
const salvarPedidos = useSalvarHistorico();
const dadosPedidos = computed(() =>
  pedidosQ.data.value?.map((m) => ({ mes: m.mes, valor: m.valor, ignorado: m.temPedidos })),
);

const faturamentoQ = useHistoricoFaturamentoQuery(ano, podeFaturamento);
const salvarFaturamento = useSalvarHistoricoFaturamento();
const dadosFaturamento = computed(() =>
  faturamentoQ.data.value?.map((m) => ({ mes: m.mes, valor: m.valor, ignorado: m.temImportado })),
);

type Meses = { mes: number; valor: string | null }[];
function salvarCom(
  mut: { mutateAsync: (p: { ano: number; meses: Meses }) => Promise<unknown> },
  nome: string,
) {
  return async (meses: Meses) => {
    try {
      await mut.mutateAsync({ ano: ano.value, meses });
      aviso.sucesso(`${nome} de ${ano.value} salvo.`);
    } catch (e) {
      aviso.erro(e, 'Verifique os valores digitados.');
    }
  };
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <UiExtraPageHeader
      titulo="Histórico"
      descricao="Valores mensais de anos anteriores, digitados à mão, para os comparativos com o ano anterior."
    >
      <USelect v-model="ano" :items="ANOS" class="w-28" aria-label="Ano" />
    </UiExtraPageHeader>

    <UTabs v-model="aba" :items="abas" :content="false" aria-label="Tipo de histórico" />

    <template v-if="aba === 'pedidos'">
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        description="Total vendido pela empresa no mês. O valor digitado só é usado em meses sem pedidos importados do Focco — havendo pedidos, valem os pedidos. Entra no total vendido, na evolução mensal, no acumulado e no PDF, para quem vê a empresa inteira sem filtros."
      />
      <AdminGradeHistorico
        :ano="ano"
        :dados="dadosPedidos"
        :carregando="pedidosQ.isPending.value"
        :erro="pedidosQ.error.value"
        rotulo="Vendas (R$)"
        texto-ignorado="Tem pedidos importados — valor ignorado"
        :salvar="salvarCom(salvarPedidos, 'Histórico de pedidos')"
        @tentar-de-novo="pedidosQ.refetch()"
      />
    </template>

    <template v-else>
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        description="Faturamento (Fatura DRE) da empresa no mês. O valor digitado só é usado em meses sem faturamento importado do Focco — havendo importação, vale a importação. Entra na tela Faturamento: cards, evolução mensal, tabela do ano, comparativo entre anos e PDF."
      />
      <AdminGradeHistorico
        :ano="ano"
        :dados="dadosFaturamento"
        :carregando="faturamentoQ.isPending.value"
        :erro="faturamentoQ.error.value"
        rotulo="Faturamento (R$)"
        texto-ignorado="Tem faturamento importado — valor ignorado"
        :salvar="salvarCom(salvarFaturamento, 'Histórico de faturamento')"
        @tentar-de-novo="faturamentoQ.refetch()"
      />
    </template>
  </div>
</template>
