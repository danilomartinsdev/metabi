<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui';
import type { AuditoriaLinha } from '@meta-bi/shared';
import { useAcoesAuditoriaQuery, useAuditoriaQuery, useUsuariosQuery } from '~/composables/api/useAdmin';

definePageMeta({ titulo: 'Auditoria', permissao: 'audit.view' });
useHead({ title: 'Auditoria — BI Metahospitalar' });

const route = useRoute();
const router = useRouter();
const filtro = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : '');
const page = computed(() => Number(filtro('page')) || 1);
const pageSize = computed(() => Number(filtro('pageSize')) || 50);
const qs = computed(() => {
  const p = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize.value) });
  for (const k of ['acao', 'usuarioId', 'de', 'ate']) if (filtro(k)) p.set(k, filtro(k));
  return p.toString();
});
const ABAS: TabsItem[] = [
  { label: 'Registros', value: 'registros', icon: 'i-lucide-scroll-text' },
  { label: 'Online', value: 'online', icon: 'i-lucide-radio' },
];
const aba = computed({
  get: () => (filtro('aba') === 'online' ? 'online' : 'registros'),
  set: (v: string) => void router.replace({ query: { aba: v === 'online' ? v : undefined } }),
});
const q = useAuditoriaQuery(qs);
const acoes = useAcoesAuditoriaQuery();

function definir(k: string, v: string | number) {
  const nova = { ...route.query, [k]: v ? String(v) : undefined };
  if (k !== 'page') nova.page = undefined;
  void router.replace({ query: nova });
}

/** O USelect não aceita '' como valor: "todas" é o item sem filtro. */
const TODAS = 'todas';
const itensAcao = computed(() => [
  { label: 'Todas', value: TODAS },
  ...(acoes.data.value ?? []).map((a) => ({ label: ROTULOS[a] ?? a, value: a })),
]);

const ROTULOS: Record<string, string> = {
  'login.sucesso': 'Login',
  'login.falha': 'Falha de login',
  'login.bloqueio': 'Bloqueio por tentativas',
  logout: 'Logout',
  'sessao.reuso-detectado': 'Reuso de sessão detectado',
  'senha.troca': 'Troca de senha',
  'senha.esqueci': 'Pedido de redefinição',
  'senha.redefinida': 'Senha redefinida',
  'import.executado': 'Importação',
  'import.revertido': 'Importação desfeita',
  'cadastro.alterado': 'Cadastro alterado',
  'metas.alteradas': 'Metas alteradas',
  'usuario.criado': 'Usuário criado',
  'usuario.alterado': 'Usuário alterado',
  'usuario.desativado': 'Usuário desativado',
  'usuario.reativado': 'Usuário reativado',
  'usuario.sessoes-derrubadas': 'Sessões encerradas',
  'usuario.senha-redefinida': 'Senha redefinida pelo admin',
  'papel.criado': 'Papel criado',
  'papel.alterado': 'Permissões alteradas',
  'papel.removido': 'Papel removido',
};
// Listar usuários exige users.manage; sem ela, o filtro por usuário não aparece.
const can = useCan();
const podeListarUsuarios = computed(() => can('users.manage'));
const usuarios = useUsuariosQuery({ enabled: podeListarUsuarios });
const itensUsuario = computed(() => [
  { label: 'Todos', value: TODAS },
  ...(usuarios.data.value ?? []).map((u) => ({ label: u.nome, value: u.id })),
]);
const detalhe = ref<AuditoriaLinha | null>(null);
const temDetalhes = (d: unknown) => !!d && typeof d === 'object' && Object.keys(d).length > 0;
const resumo = (d: unknown) => (d && typeof d === 'object' ? JSON.stringify(d).slice(0, 160) : '');
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <UiExtraPageHeader
      titulo="Auditoria"
      descricao="Registro das ações sensíveis: acessos, importações, exportações e mudanças de permissão."
    />

    <UTabs v-model="aba" :items="ABAS" :content="false" aria-label="Visão da auditoria" />

    <AdminUsuariosOnline v-if="aba === 'online'" />

    <template v-else>
      <div class="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
        <label class="space-y-1 text-xs text-muted-foreground">
          Ação
          <USelect
            :model-value="filtro('acao') || TODAS"
            :items="itensAcao"
            size="sm"
            class="block w-56"
            @update:model-value="(v) => definir('acao', v === TODAS ? '' : String(v))"
          />
        </label>
        <label v-if="podeListarUsuarios" class="space-y-1 text-xs text-muted-foreground">
          Usuário
          <USelect
            :model-value="filtro('usuarioId') || TODAS"
            :items="itensUsuario"
            size="sm"
            class="block w-56"
            :loading="usuarios.isPending.value"
            @update:model-value="(v) => definir('usuarioId', v === TODAS ? '' : String(v))"
          />
        </label>
        <label class="space-y-1 text-xs text-muted-foreground">
          De
          <UInput
            type="date"
            size="sm"
            class="block"
            :model-value="filtro('de')"
            @change="(e: Event) => definir('de', (e.target as HTMLInputElement).value)"
          />
        </label>
        <label class="space-y-1 text-xs text-muted-foreground">
          Até
          <UInput
            type="date"
            size="sm"
            class="block"
            :model-value="filtro('ate')"
            @change="(e: Event) => definir('ate', (e.target as HTMLInputElement).value)"
          />
        </label>
      </div>

      <section class="rounded-xl border bg-card">
        <UiExtraEstadoBloco
          :carregando="q.isPending.value"
          :erro="q.error.value"
          :vazio="!q.data.value?.data.length"
          texto-vazio="Nenhum registro para os filtros."
          :linhas="8"
          @tentar-de-novo="q.refetch()"
        >
          <div
            class="overflow-x-auto transition-opacity"
            :class="q.isFetching.value && 'opacity-60'"
            :aria-busy="q.isFetching.value"
          >
            <table class="w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-5 py-3 font-medium">Quando</th>
                  <th class="px-3 py-3 font-medium">Ação</th>
                  <th class="px-3 py-3 font-medium">Usuário</th>
                  <th class="px-3 py-3 font-medium">Detalhes</th>
                  <th class="px-3 py-3 font-medium">IP</th>
                  <th class="px-5 py-3"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="l in q.data.value?.data" :key="l.id">
                  <td class="num whitespace-nowrap px-5 py-2.5">{{ formatDateTime(l.createdAt) }}</td>
                  <td
                    class="whitespace-nowrap px-3 py-2.5"
                    :class="/falha|bloqueio|reuso/.test(l.acao) && 'text-danger'"
                  >
                    {{ ROTULOS[l.acao] ?? l.acao }}
                  </td>
                  <td class="px-3 py-2.5">{{ l.usuario?.nome ?? '—' }}</td>
                  <td
                    class="max-w-md truncate px-3 py-2.5 font-mono text-xs text-muted-foreground"
                    :title="resumo(l.detalhes)"
                  >
                    {{ [l.entidade, resumo(l.detalhes)].filter(Boolean).join(' · ') || '—' }}
                  </td>
                  <td class="num px-3 py-2.5 text-muted-foreground">{{ l.ip ?? '—' }}</td>
                  <td class="px-5 py-1.5 text-right">
                    <UButton
                      v-if="temDetalhes(l.detalhes)"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      label="Ver detalhes"
                      @click="detalhe = l"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <UiExtraPaginacaoBar
            :pagina="page"
            :por-pagina="pageSize"
            :total="q.data.value?.meta.total ?? 0"
            rotulo="registros"
            @update:pagina="(p) => definir('page', p)"
            @update:por-pagina="(n) => definir('pageSize', n)"
          />
        </UiExtraEstadoBloco>
      </section>
    </template>

    <UModal
      :open="!!detalhe"
      :title="detalhe ? (ROTULOS[detalhe.acao] ?? detalhe.acao) : ''"
      :description="
        detalhe ? `${formatDateTime(detalhe.createdAt)} · ${detalhe.usuario?.nome ?? 'sem usuário'}` : ''
      "
      @update:open="(v) => !v && (detalhe = null)"
    >
      <template #body>
        <dl v-if="detalhe?.entidade" class="mb-3 text-sm">
          <dt class="text-muted-foreground">Entidade</dt>
          <dd class="font-mono text-xs">{{ detalhe.entidade }} {{ detalhe.entidadeId }}</dd>
        </dl>
        <pre class="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs">{{
          JSON.stringify(detalhe?.detalhes, null, 2)
        }}</pre>
      </template>
    </UModal>
  </div>
</template>
