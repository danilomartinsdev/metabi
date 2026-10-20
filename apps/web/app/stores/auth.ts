import type { AuthResposta, LoginInput, Permission, UsuarioLogado } from '@metabi/shared';
import { defineStore } from 'pinia';

/**
 * Sessão do usuário. O access token fica SÓ em memória (nunca em localStorage);
 * o refresh token é um cookie httpOnly que o navegador envia para /api/auth.
 */
export const useAuthStore = defineStore('auth', () => {
  const usuario = ref<UsuarioLogado | null>(null);
  const accessToken = ref<string | null>(null);
  const inicializado = ref(false);
  let refreshEmAndamento: Promise<boolean> | null = null;

  const autenticado = computed(() => !!usuario.value && !!accessToken.value);
  const permissoes = computed(() => new Set<Permission>(usuario.value?.permissoes ?? []));

  function aplicar(r: AuthResposta) {
    accessToken.value = r.accessToken;
    usuario.value = r.usuario;
  }

  function limpar() {
    accessToken.value = null;
    usuario.value = null;
  }

  async function login(dados: LoginInput) {
    const r = await $fetch<AuthResposta>('/api/auth/login', {
      method: 'POST',
      body: dados,
      credentials: 'include',
    });
    aplicar(r);
    return r.usuario;
  }

  /** Renova o access token via cookie de refresh. Chamadas simultâneas compartilham a mesma promessa. */
  function refresh(): Promise<boolean> {
    refreshEmAndamento ??= $fetch<AuthResposta>('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => {
        aplicar(r);
        return true;
      })
      .catch(() => {
        limpar();
        return false;
      })
      .finally(() => {
        refreshEmAndamento = null;
      });
    return refreshEmAndamento;
  }

  /** Na carga da SPA: tenta restaurar a sessão a partir do cookie. */
  async function inicializar() {
    if (inicializado.value) return;
    await refresh();
    inicializado.value = true;
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {},
      });
    } finally {
      limpar();
      await navigateTo('/login');
    }
  }

  async function expirarSessao() {
    limpar();
    await navigateTo({ path: '/login', query: { motivo: 'sessao-expirada' } });
  }

  function marcarSenhaTrocada() {
    if (usuario.value) usuario.value = { ...usuario.value, trocarSenha: false };
  }

  return {
    usuario,
    accessToken,
    inicializado,
    autenticado,
    permissoes,
    login,
    refresh,
    inicializar,
    logout,
    expirarSessao,
    marcarSenhaTrocada,
    aplicar,
  };
});
