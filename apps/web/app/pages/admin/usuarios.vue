<script setup lang="ts">
import { REGIAO_ENUM_ROTULO, type UsuarioAdmin } from '@metabi/shared';
import type { DropdownMenuItem } from '@nuxt/ui';
import { refDebounced } from '@vueuse/core';
import { useAcaoUsuario, useUsuariosQuery } from '~/composables/api/useAdmin';
import { useAuthStore } from '~/stores/auth';

const aviso = useAviso();
const confirmar = useConfirmacao();
definePageMeta({ titulo: 'Usuários', permissao: 'users.manage' });
useHead({ title: 'Usuários — MetaBI' });

const auth = useAuthStore();
const usuarios = useUsuariosQuery();

const busca = ref('');
const buscaDebounced = refDebounced(busca, 250);
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
const filtrados = computed(() => {
  const t = normalizar(buscaDebounced.value.trim());
  const lista = usuarios.data.value ?? [];
  return t ? lista.filter((u) => normalizar(`${u.nome} ${u.email} ${u.papel.nome}`).includes(t)) : lista;
});
const acao = useAcaoUsuario();

const dialogo = ref(false);
const editando = ref<UsuarioAdmin | null>(null);
const credencial = ref<{ email: string; senha: string } | null>(null);

function abrir(u: UsuarioAdmin | null) {
  editando.value = u;
  dialogo.value = true;
}

async function executar(
  u: UsuarioAdmin,
  tipo: 'desativar' | 'reativar' | 'derrubar-sessoes' | 'redefinir-senha',
) {
  const textos = {
    desativar: `Desativar ${u.nome}? Ele perde o acesso imediatamente.`,
    reativar: null,
    'derrubar-sessoes': `Encerrar todas as sessões de ${u.nome}? Ele precisará entrar de novo.`,
    'redefinir-senha': `Gerar uma nova senha provisória para ${u.nome}? As sessões dele serão encerradas.`,
  } as const;
  const rotulos = {
    desativar: 'Desativar',
    reativar: 'Reativar',
    'derrubar-sessoes': 'Encerrar sessões',
    'redefinir-senha': 'Gerar senha',
  } as const;
  let senha: string | undefined;
  const executarAcao = async () => {
    senha = (await acao.mutateAsync({ id: u.id, acao: tipo }))?.senhaProvisoria;
  };
  if (textos[tipo]) {
    const ok = await confirmar({
      titulo: textos[tipo]!,
      rotuloConfirmar: rotulos[tipo],
      perigo: tipo === 'desativar',
      acao: executarAcao,
    });
    if (!ok) return;
  } else {
    try {
      await executarAcao();
    } catch (e) {
      aviso.erro(e);
      return;
    }
  }
  if (tipo === 'redefinir-senha' && senha) credencial.value = { email: u.email, senha };
  else aviso.sucesso('Feito.');
}

function copiar() {
  if (!credencial.value) return;
  void navigator.clipboard.writeText(credencial.value.senha);
  aviso.sucesso('Senha copiada.');
}

function acoes(u: UsuarioAdmin): DropdownMenuItem[][] {
  const grupos: DropdownMenuItem[][] = [
    [
      { label: 'Editar', icon: 'i-lucide-pencil', onSelect: () => abrir(u) },
      {
        label: 'Redefinir senha',
        icon: 'i-lucide-key-round',
        onSelect: () => executar(u, 'redefinir-senha'),
      },
      {
        label: 'Encerrar sessões',
        icon: 'i-lucide-log-out',
        onSelect: () => executar(u, 'derrubar-sessoes'),
      },
    ],
  ];
  if (u.id !== auth.usuario?.id) {
    grupos.push([
      u.ativo
        ? {
            label: 'Desativar',
            icon: 'i-lucide-user-x',
            color: 'error',
            onSelect: () => executar(u, 'desativar'),
          }
        : { label: 'Reativar', icon: 'i-lucide-user-check', onSelect: () => executar(u, 'reativar') },
    ]);
  }
  return grupos;
}

const escopo = (u: UsuarioAdmin) =>
  u.escopoTipo === 'todos'
    ? 'Todos'
    : u.escopoTipo === 'regiao'
      ? u.escopoRegioes.map((r) => REGIAO_ENUM_ROTULO[r]).join(', ') || '—'
      : u.representantes.map((r) => r.nomeExibicao).join(', ') || 'Nenhum representante';
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <UiExtraPageHeader titulo="Usuários" descricao="Quem acessa o BI, com qual papel e quais dados pode ver.">
      <UButton icon="i-lucide-plus" label="Novo usuário" @click="abrir(null)" />
    </UiExtraPageHeader>

    <UInput
      v-model="busca"
      icon="i-lucide-search"
      class="w-full max-w-sm"
      placeholder="Buscar por nome, e-mail ou papel"
      aria-label="Buscar usuário"
    />

    <section class="rounded-xl border bg-card">
      <UiExtraEstadoBloco
        :carregando="usuarios.isPending.value"
        :erro="usuarios.error.value"
        :vazio="!filtrados.length"
        :texto-vazio="busca ? 'Nenhum usuário encontrado.' : 'Nenhum usuário.'"
        @tentar-de-novo="usuarios.refetch()"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-5 py-3 font-medium">Usuário</th>
                <th class="px-3 py-3 font-medium">Papel</th>
                <th class="px-3 py-3 font-medium">Escopo</th>
                <th class="px-3 py-3 font-medium">Último acesso</th>
                <th class="px-3 py-3 font-medium">Situação</th>
                <th class="px-5 py-3" />
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="u in filtrados" :key="u.id" :class="!u.ativo && 'opacity-60'">
                <td class="px-5 py-3">
                  <span class="block font-medium">{{ u.nome }}</span>
                  <span class="block text-xs text-muted-foreground">{{ u.email }}</span>
                </td>
                <td class="px-3 py-3">{{ u.papel.nome }}</td>
                <td class="max-w-64 truncate px-3 py-3" :title="escopo(u)">{{ escopo(u) }}</td>
                <td class="num whitespace-nowrap px-3 py-3">{{ formatDateTime(u.ultimoAcessoEm) }}</td>
                <td class="px-3 py-3">
                  <div class="flex flex-wrap gap-1">
                    <UBadge v-if="!u.ativo" color="neutral" variant="soft" label="Desativado" />
                    <UBadge v-else-if="u.bloqueado" color="warning" variant="soft" label="Bloqueado" />
                    <UBadge v-else color="success" variant="soft" label="Ativo" />
                    <UBadge
                      v-if="u.trocarSenha && u.ativo"
                      color="neutral"
                      variant="outline"
                      label="Troca de senha"
                    />
                  </div>
                </td>
                <td class="px-5 py-3 text-right">
                  <UDropdownMenu :items="acoes(u)" :content="{ align: 'end' }">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      icon="i-lucide-ellipsis"
                      :aria-label="`Ações para ${u.nome}`"
                    />
                  </UDropdownMenu>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiExtraEstadoBloco>
    </section>

    <AdminUsuarioDialog
      v-model:aberto="dialogo"
      :usuario="editando"
      @criado="(email, senha) => (credencial = { email, senha })"
    />

    <UModal
      :open="!!credencial"
      title="Senha provisória"
      description="Envie ao usuário por um canal seguro. Ela não será mostrada de novo e precisa ser trocada no primeiro acesso."
      @update:open="(v) => !v && (credencial = null)"
    >
      <template #body>
        <div class="space-y-2 rounded-lg border bg-muted/40 p-4">
          <p class="text-sm"><span class="text-muted-foreground">E-mail:</span> {{ credencial?.email }}</p>
          <p class="flex items-center justify-between gap-2">
            <code class="num rounded bg-background px-2 py-1 text-base font-semibold">{{
              credencial?.senha
            }}</code>
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-copy"
              label="Copiar"
              @click="copiar"
            />
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end">
          <UButton label="Entendi" @click="credencial = null" />
        </div>
      </template>
    </UModal>
  </div>
</template>
