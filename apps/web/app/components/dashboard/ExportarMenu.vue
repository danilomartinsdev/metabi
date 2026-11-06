<script setup lang="ts">
import {
  type AbcProdutosModo,
  type ExportFormato,
  type ExportXlsxTipo,
  type RelatorioExport,
  SECOES_EXPORT,
} from '@metabi/shared';
import { useApi } from '~/composables/api/useApi';

/**
 * Botão "Exportar": abre sempre o diálogo onde se escolhe o formato (PDF, Excel ou CSV) e o que entra no
 * arquivo. Só aparece para quem tem permissão de exportar (Admin e Diretoria — ver Papéis).
 *
 * - `relatorio`: qual relatório de PDF/seções ('vendas' = executivo de vendas, o padrão).
 * - `xlsx`: planilha da tabela desta tela; sem ele, Excel/CSV exportam a Visão geral (por seção).
 * - `consulta`: parâmetros próprios da tela (faturamento); sem ele usa os filtros globais.
 */
const props = withDefaults(
  defineProps<{
    relatorio?: RelatorioExport;
    xlsx?: ExportXlsxTipo;
    ordenacao?: { sort: string; dir: string };
    consulta?: string;
    desabilitado?: boolean;
  }>(),
  { relatorio: 'vendas' },
);

const { baixar } = useApi();
const { query } = useFiltros();
const can = useCan();
const aviso = useAviso();

const aberto = ref(false);
const gerando = ref(false);

const secoes = computed(() => SECOES_EXPORT[props.relatorio]);
const formatos = computed(() => {
  const l: { label: string; value: ExportFormato; description: string }[] = [];
  if (can('export.pdf')) l.push({ label: 'PDF', value: 'pdf', description: 'Relatório para imprimir' });
  if (props.relatorio === 'vendas' && can('export.xlsx')) {
    l.push({ label: 'Excel', value: 'xlsx', description: 'Planilha .xlsx' });
    l.push({ label: 'CSV', value: 'csv', description: 'Texto separado por ;' });
  }
  return l;
});
const formato = ref<ExportFormato>('pdf');
const marcadas = ref<string[]>([]);
/** Curva ABC de produtos (só na Análise de faturamento): pelo valor, pela quantidade ou as duas. */
const abcProdutos = ref<AbcProdutosModo>('valor');
const MODOS_ABC: { label: string; value: AbcProdutosModo }[] = [
  { label: 'Por valor', value: 'valor' },
  { label: 'Por quantidade', value: 'quantidade' },
  { label: 'Os dois', value: 'ambos' },
];
const escolheAbc = computed(
  () =>
    props.relatorio === 'analise-faturamento' && formato.value === 'pdf' && marcadas.value.includes('abcProdutos'),
);

// Última escolha (formato + seções) lembrada neste navegador, por pessoa e por relatório. É só
// conveniência: se o armazenamento falhar ou estiver vazio, vale o padrão (primeiro formato, tudo marcado).
const auth = useAuthStore();
const chaveEscolha = computed(() => `metabi-exportar:${auth.usuario?.id ?? 'anon'}:${props.relatorio}`);

function lerEscolha(): { formato?: ExportFormato; secoes?: string[]; abcProdutos?: AbcProdutosModo } {
  try {
    const bruto = localStorage.getItem(chaveEscolha.value);
    return bruto
      ? (JSON.parse(bruto) as { formato?: ExportFormato; secoes?: string[]; abcProdutos?: AbcProdutosModo })
      : {};
  } catch {
    return {};
  }
}
function guardarEscolha() {
  try {
    localStorage.setItem(chaveEscolha.value, JSON.stringify({ formato: formato.value, secoes: marcadas.value, abcProdutos: abcProdutos.value }));
  } catch {
    // Sem armazenamento (janela privada etc.): a escolha só vale desta vez.
  }
}

function abrir() {
  const salva = lerEscolha();
  const ids = secoes.value.map((s) => s.id);
  formato.value = formatos.value.some((f) => f.value === salva.formato)
    ? salva.formato!
    : (formatos.value[0]?.value ?? 'pdf');
  // Só as seções que ainda existem; se nada sobrou (ou nunca houve escolha), tudo marcado.
  const validas = Array.isArray(salva.secoes) ? ids.filter((id) => salva.secoes!.includes(id)) : [];
  marcadas.value = validas.length ? validas : ids;
  abcProdutos.value = MODOS_ABC.some((m) => m.value === salva.abcProdutos) ? salva.abcProdutos! : 'valor';
  aberto.value = true;
}

/** Excel/CSV de uma tabela (pedidos, rankings, clientes) exporta a própria tabela: sem seções. */
const usaSecoes = computed(() => formato.value === 'pdf' || !props.xlsx);
const todas = computed(() => marcadas.value.length === secoes.value.length);
const podeExportar = computed(() => !gerando.value && (!usaSecoes.value || marcadas.value.length > 0));

function alternar(id: string, v: boolean | 'indeterminate') {
  marcadas.value = v === true ? [...new Set([...marcadas.value, id])] : marcadas.value.filter((x) => x !== id);
}
const marcarTodas = (v: boolean) => (marcadas.value = v ? secoes.value.map((s) => s.id) : []);

function montarUrl(): string {
  // Lista completa de seções = relatório inteiro (não manda nada).
  const sel = usaSecoes.value && !todas.value ? marcadas.value.join(',') : '';
  if (props.relatorio !== 'vendas') {
    const p = new URLSearchParams(props.consulta ?? '');
    if (sel) p.set('secoes', sel);
    if (escolheAbc.value) p.set('abcProdutos', abcProdutos.value);
    return `/export/pdf/${props.relatorio}?${p}`;
  }
  const p = new URLSearchParams({ ...query.value });
  if (formato.value === 'pdf') {
    if (sel) p.set('secoes', sel);
    return `/export/pdf?${p}`;
  }
  p.set('formato', formato.value);
  if (props.xlsx) {
    if (props.ordenacao) for (const [k, v] of Object.entries(props.ordenacao)) p.set(k, v);
    return `/export/xlsx/${props.xlsx}?${p}`;
  }
  if (sel) p.set('secoes', sel);
  return `/export/visao-geral?${p}`;
}

async function exportar() {
  if (!podeExportar.value) return;
  gerando.value = true;
  try {
    await baixar(montarUrl());
    guardarEscolha();
    aviso.sucesso(formato.value === 'pdf' ? 'PDF gerado.' : 'Arquivo gerado.');
    aberto.value = false;
  } catch (e) {
    aviso.erro(e, 'Não foi possível gerar o arquivo.');
  } finally {
    gerando.value = false;
  }
}
</script>

<template>
  <template v-if="formatos.length">
    <UButton
      color="neutral"
      variant="outline"
      size="sm"
      icon="i-lucide-download"
      label="Exportar"
      :disabled="desabilitado"
      @click="abrir"
    />
    <UModal
      v-model:open="aberto"
      title="Exportar"
      description="Escolha o formato e o que entra no arquivo. Vale para os filtros e o período desta tela."
    >
      <template #body>
        <div class="space-y-5">
          <fieldset class="space-y-2">
            <legend class="text-sm font-medium">Formato</legend>
            <URadioGroup v-model="formato" :items="formatos" orientation="horizontal" variant="card" />
          </fieldset>

          <fieldset v-if="usaSecoes" class="space-y-2">
            <div class="flex items-center justify-between">
              <legend class="text-sm font-medium">O que exportar</legend>
              <div class="flex gap-3 text-xs">
                <button type="button" class="text-primary hover:underline" @click="marcarTodas(true)">
                  Marcar tudo
                </button>
                <button type="button" class="text-muted-foreground hover:underline" @click="marcarTodas(false)">
                  Limpar
                </button>
              </div>
            </div>
            <div class="space-y-2 rounded-lg border p-3">
              <UCheckbox
                v-for="s in secoes"
                :key="s.id"
                :model-value="marcadas.includes(s.id)"
                :label="s.rotulo"
                @update:model-value="(v) => alternar(s.id, v)"
              />
            </div>
            <div v-if="escolheAbc" class="space-y-1.5 rounded-lg border p-3">
              <p class="text-sm font-medium">Curva ABC de produtos</p>
              <URadioGroup v-model="abcProdutos" :items="MODOS_ABC" orientation="horizontal" size="sm" />
            </div>
            <p v-if="formato !== 'pdf'" class="text-xs text-muted-foreground">
              Em Excel/CSV os gráficos saem como tabela com os mesmos dados.
            </p>
          </fieldset>
          <p v-else class="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            Exporta a tabela desta tela, com os filtros e a ordenação atuais.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancelar" @click="aberto = false" />
          <UButton
            icon="i-lucide-download"
            :label="gerando ? 'Gerando…' : 'Exportar'"
            :loading="gerando"
            :disabled="!podeExportar"
            @click="exportar"
          />
        </div>
      </template>
    </UModal>
  </template>
</template>
