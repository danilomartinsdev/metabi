import { test as base } from '@playwright/test';

export { expect, type Page } from '@playwright/test';

/**
 * `test` dos E2E: o cartão de Novidades (abre no primeiro login após cada entrega) cobriria parte das telas.
 * A última novidade vista fica no localStorage (`meta-bi-novidades:<id do usuário>`); como o id muda a
 * cada seed, a leitura dessas chaves devolve um id maior que qualquer novidade.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const ler = Storage.prototype.getItem;
      Storage.prototype.getItem = function (chave: string) {
        return chave.startsWith('meta-bi-novidades:') ? '9999-12-31-9' : ler.call(this, chave);
      };
    });
    await use(page);
  },
});
