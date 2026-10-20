<script setup lang="ts">
import { valorMetaSchema } from '@meta-bi/shared';

/** Grade de 12 meses para digitar um valor por mês (Administração › Histórico). */
const props = defineProps<{
  ano: number;
  /** Valores gravados ("1234.56") e se o mês é ignorado por já ter dados importados. */
  dados: { mes: number; valor: string | null; ignorado: boolean }[] | undefined;
  carregando: boolean;
  erro: unknown;
  /** Cabeçalho da coluna de valores. */
  rotulo: string;
  /** Selo dos meses com dados importados. */
  textoIgnorado: string;
  salvar: (meses: { mes: number; valor: string | null }[]) => Promise<void>;
}>();
const emit = defineEmits<{ tentarDeNovo: [] }>();

const aviso = useAviso();
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmt = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const grade = ref<string[]>(Array(12).fill(''));
const original = ref<string[]>(Array(12).fill(''));
const salvando = ref(false);
watch(
  () => props.dados,
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
const ignorado = (i: number) => !!props.dados?.find((m) => m.mes === i + 1)?.ignorado;

/** Soma do ano só para conferência visual (o cálculo oficial é feito na API, em Decimal). */
const somaAno = computed(() =>
  grade.value.reduce((s, v) => {
    const r = valorMetaSchema.safeParse(v);
    return v.trim() && r.success ? s + Number(r.data) : s;
  }, 0),
);

async function onSalvar() {
  if (grade.value.some(invalida)) {
    aviso.erro('Há valores inválidos (em vermelho). Use o formato 1.234.567,89.');
    return;
  }
  const meses = grade.value
    .map((v, i) => ({ mes: i + 1, valor: v.trim() || null, antes: original.value[i]!.trim() || null }))
    .filter((m) => m.valor !== m.antes)
    .map(({ mes, valor }) => ({ mes, valor }));
  salvando.value = true;
  try {
    await props.salvar(meses);
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <section class="rounded-xl border bg-card">
    <div class="flex flex-wrap items-center justify-end gap-2 border-b px-5 py-3">
      <UBadge v-if="alterado" color="warning" variant="soft" label="Alterações não salvas" />
      <UButton icon="i-lucide-save" label="Salvar" :loading="salvando" @click="onSalvar" />
    </div>
    <UiExtraEstadoBloco
      :carregando="carregando"
      :erro="erro"
      :linhas="12"
      @tentar-de-novo="emit('tentarDeNovo')"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th class="px-5 py-3 font-medium">Mês</th>
              <th class="px-5 py-3 text-right font-medium">{{ rotulo }}</th>
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
                  :aria-label="`${rotulo} de ${m}/${ano}`"
                />
              </td>
              <td class="px-5 py-2 text-xs">
                <UBadge v-if="ignorado(i)" color="neutral" variant="soft" :label="textoIgnorado" />
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
      </div>
    </UiExtraEstadoBloco>
  </section>
</template>
