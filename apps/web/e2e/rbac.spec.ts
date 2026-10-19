import { expect, type Page, test } from './fixtures';
import { USUARIOS } from './global-setup';

async function entrar(page: Page, email: string, titulo: string | RegExp = 'Visão geral') {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(process.env.E2E_SENHA!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
}

async function itensDoMenu(page: Page) {
  const menu = page.getByRole('button', { name: 'Abrir menu' });
  if (await menu.isVisible()) await menu.click();
  const nav = page.getByRole('navigation', { name: 'Navegação principal' }).last();
  await nav.getByRole('link', { name: /Visão geral/ }).waitFor();
  // Administração começa recolhida: abre para listar os itens (se o papel tiver o grupo).
  const admin = nav.getByRole('button', { name: 'Administração' });
  if ((await admin.count()) && (await admin.getAttribute('aria-expanded')) === 'false') await admin.click();
  const textos = await nav.getByRole('link').allInnerTexts();
  await page.keyboard.press('Escape');
  return textos.map((t) => t.trim());
}

test.describe('cada papel vê só o que pode', () => {
  test('representante: cai em Minhas vendas; administração não; URL direta leva ao 403', async ({ page }) => {
    await entrar(page, USUARIOS.representante, /^Olá/);
    await expect(page).toHaveURL(/\/minhas-vendas$/);
    const itens = await itensDoMenu(page);
    expect(itens).toEqual(expect.arrayContaining(['Minhas vendas', 'Visão geral', 'Pedidos']));
    for (const proibido of ['Importações', 'Usuários', 'Papéis', 'Auditoria', 'Metas']) {
      expect(itens).not.toContain(proibido);
    }
    await page.goto('/admin/usuarios');
    await expect(page).toHaveURL(/\/403$/);
    await expect(page.getByRole('heading', { name: 'Você não tem acesso a esta página' })).toBeVisible();
  });

  test('admin vê administração completa', async ({ page }) => {
    await entrar(page, USUARIOS.admin);
    const itens = await itensDoMenu(page);
    expect(itens).toEqual(
      expect.arrayContaining(['Importações', 'Metas', 'Usuários', 'Papéis', 'Auditoria']),
    );
    // Minhas vendas é só de quem tem o checkbox (padrão: papel Representante); o Admin não recebe.
    expect(itens).not.toContain('Minhas vendas');
    await page.goto('/minhas-vendas');
    await expect(page).toHaveURL(/\/403$/);
  });
});

test('admin cria usuário e recebe a senha provisória uma única vez', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'cria dados: roda uma vez só');
  await entrar(page, USUARIOS.admin);
  await page.goto('/admin/usuarios');
  await page.getByRole('button', { name: 'Novo usuário' }).click();

  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Nome').fill('Pessoa E2E');
  await dialogo.getByLabel('E-mail').fill(`e2e-${Date.now()}@metahospitalar.com.br`);
  // USelect é um combobox (listbox em portal), não um <select> nativo.
  // Papel Representante: em vez do escopo, pergunta qual representante é o usuário.
  await dialogo.getByLabel('Papel').click();
  await page.getByRole('option', { name: 'Representante' }).click();
  await expect(dialogo.getByText('Qual representante é este usuário?')).toBeVisible();
  await expect(dialogo.getByText('Escopo de dados')).toHaveCount(0);

  await dialogo.getByLabel('Papel').click();
  await page.getByRole('option', { name: 'Visualizador' }).click();
  await expect(dialogo.getByText('Qual representante é este usuário?')).toHaveCount(0);
  await expect(dialogo.getByText('Por representante')).toHaveCount(0);
  await dialogo.getByText('Todos os pedidos').click();
  await dialogo.getByRole('button', { name: 'Salvar' }).click();

  const credencial = page.getByRole('dialog', { name: 'Senha provisória' });
  await expect(credencial).toBeVisible();
  await expect(credencial.locator('code')).toHaveText(/^Meta.{10,}\d$/);
  await credencial.getByRole('button', { name: 'Entendi' }).click();
  await expect(page.getByRole('cell', { name: /Pessoa E2E/ }).first()).toBeVisible();

  await page.goto('/admin/auditoria');
  await expect(page.getByRole('cell', { name: 'Usuário criado' }).first()).toBeVisible();
});
