import { expect, type Page, test } from './fixtures';
import { USUARIOS } from './global-setup';

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(USUARIOS.admin);
  await page.getByLabel('Senha', { exact: true }).fill(process.env.E2E_SENHA!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral', level: 2 })).toBeVisible({
    timeout: 30_000,
  });
}

test('visão geral: atalhos de período, busca ativa e comparativo com o ano anterior', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'só no desktop');
  test.setTimeout(120_000);
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await entrar(page);

  await expect(page.getByRole('heading', { name: /Comparativo com o ano anterior/ })).toBeVisible();
  await expect(page.getByText(/Sem meta para o período|Meta acumulada/)).toBeVisible();

  // Sem pedidos no banco de teste não há meses: os atalhos de período não aparecem.
  await expect(page.getByRole('button', { name: 'Último mês' })).toHaveCount(0);

  // Busca ativa avisa que os números são parciais.
  await page.getByLabel('Buscar').fill('zzz-nada');
  await expect(page.getByText('Busca ativa: “zzz-nada”')).toBeVisible();

  // Alternar a participação por segmento.
  await page.getByRole('tab', { name: 'Público × Privado' }).click();
  await expect(page.getByRole('tab', { name: 'Público × Privado' })).toHaveAttribute('aria-selected', 'true');
  expect(erros).toEqual([]);
});

test('ranking: navegação entre tipos mantém filtros e mostra período', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'só no desktop');
  await entrar(page);
  await page.goto('/dashboard/gestores?uf=GO');
  await expect(page.getByRole('heading', { name: 'Ranking de representantes', level: 2 })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Tipo de ranking' })
    .getByRole('link', { name: 'Estados' })
    .click();
  await expect(page.getByRole('heading', { name: 'Ranking de estados', level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/uf=GO/);
});
