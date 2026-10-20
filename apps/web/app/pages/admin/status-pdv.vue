<script setup lang="ts">
import { CORES_STATUS } from '@metabi/shared';
import { type StatusPdv, useAtualizarStatus, useStatusQuery } from '~/composables/api/useCadastros';

const aviso = useAviso();
definePageMeta({ titulo: 'Status PDV', permissao: 'cadastros.edit' });
useHead({ title: 'Status PDV — MetaBI' });

const status = useStatusQuery();
const atualizar = useAtualizarStatus();
const COR_CLASSE: Record<string, string> = {
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary',
  highlight: 'bg-highlight/15 text-highlight',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
};

const ROTULO_COR: Record<Cor, string> = {
  muted: 'Cinza',
  primary: 'Azul',
  highlight: 'Verde-água',
  success: 'Verde',
  warning: 'Amarelo',
  danger: 'Vermelho',
};
type Cor = (typeof CORES_STATUS)[number];
const itensCor = CORES_STATUS.map((c) => ({ label: ROTULO_COR[c], value: c }));

async function salvar(s: StatusPdv, dados: Parameters<typeof atualizar.mutateAsync>[0]['dados']) {
  try {
    await atualizar.mutateAsync({ id: s.id, dados });
    aviso.sucesso('Salvo.');
  } catch (e) {
    aviso.erro(e, 'Não foi possível salvar.');
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <UiExtraPageHeader
      titulo="Status PDV"
      descricao="Significado de cada código da coluna POS PDV e se entra no total vendido."
    />
    <p class="flex items-start gap-2 rounded-lg border bg-primary-soft px-4 py-3 text-sm text-foreground">
      <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0 text-primary" /> Decisão pendente: o significado de A, PE
      e AC e se pedidos PE contam no total. Até lá, todos contam.
    </p>
    <section class="rounded-xl border bg-card">
      <UiExtraEstadoBloco
        :carregando="status.isPending.value"
        :erro="status.error.value"
        :vazio="!status.data.value?.length"
        texto-vazio="Nenhum status. Eles são criados automaticamente na importação."
        @tentar-de-novo="status.refetch()"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-5 py-3 font-medium">Código</th>
                <th class="px-3 py-3 font-medium">Descrição</th>
                <th class="px-3 py-3 font-medium">Cor</th>
                <th class="px-5 py-3 font-medium">Conta no total</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="s in status.data.value" :key="s.id">
                <td class="px-5 py-2">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="COR_CLASSE[s.cor]">{{
                    s.codigo
                  }}</span>
                </td>
                <td class="px-3 py-2">
                  <UInput
                    :model-value="s.descricao"
                    class="min-w-48"
                    :aria-label="`Descrição de ${s.codigo}`"
                    @blur="
                      (e: Event) => {
                        const v = (e.target as HTMLInputElement).value.trim();
                        if (v && v !== s.descricao) salvar(s, { descricao: v });
                      }
                    "
                  />
                </td>
                <td class="px-3 py-2">
                  <USelect
                    :model-value="s.cor as Cor"
                    :items="itensCor"
                    class="w-36"
                    :aria-label="`Cor de ${s.codigo}`"
                    @update:model-value="(v) => salvar(s, { cor: v })"
                  />
                </td>
                <td class="px-5 py-2">
                  <USwitch
                    :model-value="s.contaNoTotal"
                    :label="s.contaNoTotal ? 'Sim' : 'Não'"
                    :aria-label="`${s.codigo} conta no total`"
                    @update:model-value="(v) => salvar(s, { contaNoTotal: v })"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiExtraEstadoBloco>
    </section>
  </div>
</template>
