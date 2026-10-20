const ANTIGO = 'meta-bi';
const NOVO = 'metabi';

/**
 * Copia cada chave "meta-bi…" para "metabi…" (sem sobrescrever uma chave nova que já exista) e apaga
 * a antiga. Devolve as chaves novas que receberam valor.
 */
export function migrarChavesAntigas(armazenamento: Storage): string[] {
  const antigas: string[] = [];
  for (let i = 0; i < armazenamento.length; i++) {
    const chave = armazenamento.key(i);
    if (chave?.startsWith(ANTIGO)) antigas.push(chave);
  }
  const migradas: string[] = [];
  for (const chave of antigas) {
    const nova = NOVO + chave.slice(ANTIGO.length);
    const valor = armazenamento.getItem(chave);
    if (valor !== null && armazenamento.getItem(nova) === null) {
      armazenamento.setItem(nova, valor);
      migradas.push(nova);
    }
    armazenamento.removeItem(chave);
  }
  return migradas;
}
