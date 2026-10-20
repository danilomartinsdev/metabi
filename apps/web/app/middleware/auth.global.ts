import { useAuthStore } from '~/stores/auth';
import { paginaInicial } from '~/utils/navegacao';

const PUBLICAS = new Set(['/login', '/esqueci-senha', '/redefinir-senha']);

export default defineNuxtRouteMiddleware(async (to) => {
  // Impressão (PDF): aberta pelo Chromium da API, sem sessão — a credencial é o token de uso único.
  if (to.path.startsWith('/print/')) return;

  const auth = useAuthStore();
  await auth.inicializar();

  const publica = PUBLICAS.has(to.path);

  if (!auth.autenticado) {
    return publica
      ? undefined
      : navigateTo({ path: '/login', query: to.fullPath !== '/' ? { r: to.fullPath } : {} });
  }

  const inicio = paginaInicial(auth.usuario);
  if (publica) return navigateTo(inicio);

  // Troca de senha obrigatória (primeiro acesso ou senha redefinida pelo admin).
  if (auth.usuario?.trocarSenha && to.path !== '/trocar-senha') return navigateTo('/trocar-senha');

  const exigida = to.meta.permissao;
  if (exigida && !auth.permissoes.has(exigida)) return navigateTo('/403');
});

declare module '#app' {
  interface PageMeta {
    permissao?: import('@metabi/shared').Permission;
    titulo?: string;
  }
}
