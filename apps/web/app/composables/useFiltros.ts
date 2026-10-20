import { type Filtros, filtrosSchema } from '@metabi/shared';

type Valor = string | string[] | undefined | null;
const CHAVES = ['de', 'ate', 'regiao', 'uf', 'gestor', 'segmento', 'status', 'q'] as const;
type Chave = (typeof CHAVES)[number];

/** Serializa filtros para query string ("a,b" em listas; omite vazios). */
export function filtrosParaQuery(f: Partial<Record<Chave, Valor>>): Record<string, string> {
  const q: Record<string, string> = {};
  for (const k of CHAVES) {
    const v = f[k];
    const s = Array.isArray(v) ? v.join(',') : (v ?? '');
    if (s) q[k] = s;
  }
  return q;
}

/**
 * Filtros globais com a URL como fonte de verdade: compartilhar o link reproduz a mesma visão.
 * Valores inválidos na URL são descartados (a API valida de novo).
 */
export function useFiltros() {
  const route = useRoute();
  const router = useRouter();

  const filtros = computed<Filtros>(() => {
    const bruto = Object.fromEntries(CHAVES.map((k) => [k, route.query[k] ?? undefined]));
    const r = filtrosSchema.safeParse(bruto);
    return r.success ? r.data : filtrosSchema.parse({});
  });

  const query = computed(() => filtrosParaQuery(filtros.value));
  const qs = computed(() => new URLSearchParams(query.value).toString());
  const ativos = computed(() => CHAVES.filter((k) => k !== 'de' && k !== 'ate' && query.value[k]).length);

  function definir(patch: Partial<Record<Chave, Valor>>) {
    const atual = { ...query.value } as Record<string, Valor>;
    void router.replace({ query: { ...filtrosParaQuery({ ...atual, ...patch } as Record<Chave, Valor>) } });
  }

  function limpar() {
    const { de, ate } = query.value;
    void router.replace({ query: filtrosParaQuery({ de, ate }) });
  }

  return { filtros, query, qs, ativos, definir, limpar };
}
