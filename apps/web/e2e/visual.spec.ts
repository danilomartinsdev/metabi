import { expect, type Page, test } from './fixtures';
import { USUARIOS } from './global-setup';

// Guarda de drift visual (ADR 0007): rotas âncora em light e dark.

// O app usa "padrão = sistema" — emular o colorScheme.
function definirTema(page: Page, tema: 'light' | 'dark') {
  return page.emulateMedia({ colorScheme: tema });
}

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(process.env.E2E_SENHA!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral', level: 2 })).toBeVisible({
    timeout: 30_000,
  });
}

const L = { maxDiffPixels: 2048 };
const RATIO = (r: number) => ({ maxDiffPixelRatio: r });

test('visual: rotas âncora light/dark (desktop)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'baseline visual só no desktop');
  // Baselines geradas no Windows; no Linux (CI) a renderização de fontes difere.
  test.skip(process.platform !== 'win32', 'baseline visual só no Windows');
  test.setTimeout(120_000);

  // /login — pública, sem dados dinâmicos; tolerância apertada.
  await definirTema(page, 'light');
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveScreenshot('login-light.png', L);

  await definirTema(page, 'dark');
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveScreenshot('login-dark.png', L);

  // /dashboard e /admin/usuarios — admin logado; período padrão depende da data.
  await definirTema(page, 'light');
  await entrar(page, USUARIOS.admin);
  await expect(page.getByRole('heading', { name: /Evolução mensal/ }).first()).toBeVisible({
    timeout: 20_000,
  });

  await expect(page).toHaveScreenshot('dashboard-light.png', { maxDiffPixelRatio: 0.2 });

  await definirTema(page, 'dark');
  await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5_000 });
  await expect(page).toHaveScreenshot('dashboard-dark.png', { maxDiffPixelRatio: 0.2 });

  await definirTema(page, 'light');
  await page.goto('/admin/usuarios');
  await expect(page.getByRole('cell', { name: /admin@metahospitalar.com.br/ }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page).toHaveScreenshot('usuarios-light.png', RATIO(0.1));

  await definirTema(page, 'dark');
  await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5_000 });
  await expect(page).toHaveScreenshot('usuarios-dark.png', RATIO(0.1));
});
