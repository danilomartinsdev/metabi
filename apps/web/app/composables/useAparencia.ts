import {
  CHAVE_FONTE,
  CHAVE_TEMA,
  ESCALA_PADRAO,
  type Tema,
  lerEscalaSalva,
  lerTemaSalvo,
  mudarEscala,
} from '~/utils/aparencia';

function ler(chave: string) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // Modo privado / armazenamento bloqueado: vale só nesta aba.
  }
}

/**
 * Tamanho da fonte e tema de cores escolhidos neste navegador (localStorage). O plugin
 * `aparencia.client.ts` aplica no <html>; aqui só o estado e as ações do botão flutuante.
 */
export function useAparencia() {
  const escala = useState('aparencia-escala', () =>
    import.meta.client ? lerEscalaSalva(ler(CHAVE_FONTE)) : ESCALA_PADRAO,
  );
  const tema = useState<Tema>('aparencia-tema', () =>
    import.meta.client ? lerTemaSalvo(ler(CHAVE_TEMA)) : 'padrao',
  );

  function definirEscala(v: number) {
    escala.value = v;
    gravar(CHAVE_FONTE, v === ESCALA_PADRAO ? null : String(v));
  }
  function definirTema(v: Tema) {
    tema.value = v;
    gravar(CHAVE_TEMA, v === 'padrao' ? null : v);
  }

  return {
    escala: readonly(escala),
    tema: readonly(tema),
    aumentar: () => definirEscala(mudarEscala(escala.value, 1)),
    diminuir: () => definirEscala(mudarEscala(escala.value, -1)),
    restaurarFonte: () => definirEscala(ESCALA_PADRAO),
    definirTema,
  };
}
