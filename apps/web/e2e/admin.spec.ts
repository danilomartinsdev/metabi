import { expect, type Page, test } from './fixtures';
import { USUARIOS } from './global-setup';

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(USUARIOS.admin);
  await page.getByLabel('Senha', { exact: true }).fill(process.env.E2E_SENHA!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral', level: 2 })).toBeVisible({ timeout: 30_000 });
}

const TELAS = [
  ['/admin/importacoes', 'Importações'],
  ['/admin/metas', 'Metas'],
  ['/admin/representantes', 'Representantes'],
  ['/admin/clientes', 'Segmento por cliente'],
  ['/admin/status-pdv', 'Status PDV'],
  ['/admin/usuarios', 'Usuários'],
  ['/admin/papeis', 'Papéis e permissões'],
  ['/admin/auditoria', 'Auditoria'],
] as const;

test('telas de administração abrem sem erro de JavaScript', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'cobertura de telas só no desktop');
  test.setTimeout(180_000);
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));

  await entrar(page);
  for (const [rota, titulo] of TELAS) {
    await page.goto(rota);
    await expect(page.getByRole('heading', { name: titulo, level: 2 })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Administração', { exact: true }).first()).toBeVisible();
  }
  expect(erros).toEqual([]);
});

test('metas: valor inválido é marcado e impede salvar', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'só no desktop');
  await entrar(page);
  await page.goto('/admin/metas');
  const celula = page.getByLabel('Meta de Meta total da empresa em Jan');
  await celula.fill('abc');
  await expect(celula).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Alterações não salvas')).toBeVisible();

  await page.getByRole('button', { name: 'Salvar' }).click();
  // O toast também é repetido na região aria-live; basta o primeiro.
  await expect(page.getByText(/valor\(es\) inválido\(s\)/).first()).toBeVisible();

  // Sair com alteração pendente pede confirmação; cancelar mantém na tela.
  await page.getByRole('link', { name: 'Visão geral' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Descartar alterações?' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(/\/admin\/metas/);
});
