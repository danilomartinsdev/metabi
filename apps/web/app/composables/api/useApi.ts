import type { ErroApi } from '@metabi/shared';
import { useAuthStore } from '~/stores/auth';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: Partial<ErroApi>,
  ) {
    super(body.message ?? `Erro ${status}`);
  }
  get code() {
    return this.body.code;
  }
}

type Opcoes = Parameters<typeof $fetch>[1];

/**
 * Cliente HTTP da API: injeta o access token (em memória) e, num 401,
 * tenta um refresh silencioso uma única vez antes de desistir.
 */
export function useApi() {
  const auth = useAuthStore();

  async function request<T>(url: string, opts: Opcoes = {}, retry = true): Promise<T> {
    try {
      return (await $fetch<T>(`/api${url}`, {
        ...opts,
        credentials: 'include',
        headers: {
          ...(opts?.headers as Record<string, string> | undefined),
          ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
        },
      })) as T;
    } catch (e: unknown) {
      const err = e as { status?: number; statusCode?: number; data?: Partial<ErroApi> };
      const status = err.status ?? err.statusCode ?? 0;
      if (status === 401 && retry && !url.startsWith('/auth/')) {
        const ok = await auth.refresh();
        if (ok) return request<T>(url, opts, false);
        await auth.expirarSessao();
      }
      throw new ApiError(status, err.data ?? { message: 'Não foi possível falar com o servidor.' });
    }
  }

  /**
   * Baixa um arquivo da API (Excel/PDF) com o mesmo token e refresh do request,
   * e dispara o download no navegador com o nome sugerido pela API.
   */
  async function baixar(url: string, retry = true): Promise<void> {
    const r = await fetch(`/api${url}`, {
      credentials: 'include',
      headers: auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {},
    });
    if (r.status === 401 && retry) {
      if (await auth.refresh()) return baixar(url, false);
      await auth.expirarSessao();
    }
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as Partial<ErroApi>;
      throw new ApiError(r.status, body);
    }
    const nome = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? 'metabi';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(await r.blob());
    link.download = nome;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  }

  return { request, baixar };
}

/** Texto para o usuário a partir de um erro: detalhes de validação da API, a mensagem dela ou o padrão. */
export function mensagemErro(e: unknown, padrao = 'Não foi possível concluir a ação.'): string {
  if (e instanceof ApiError) {
    const detalhes = e.body.details?.map((d) => d.message).filter(Boolean);
    if (detalhes?.length) return detalhes.join(' ');
    return e.body.message ?? padrao;
  }
  return padrao;
}
