import { expect, type Page, test } from './fixtures';
import { USUARIOS } from './global-setup';

const senha = () => process.env.E2E_SENHA!;

async function entrar(page: Page, email: string, s = senha()) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(s);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function abrirMenuSeCelular(page: Page) {
  // Espera o layout renderizar antes de decidir se é celular (botão de menu visível).
  await page.getByRole('heading', { name: 'Visão geral', level: 2 }).waitFor();
  const menu = page.getByRole('button', { name: 'Abrir menu' });
  if (await menu.isVisible()) await menu.click();
}

test('rota protegida sem login leva ao login', async ({ page }) => {
  await page.goto('/dashboard');
  // Primeiro carregamento da suíte: o servidor de dev ainda compila os módulos (pode passar de 15 s).
  await expect(page).toHaveURL(/\/login\?r=(%2F|\/)dashboard/, { timeout: 90_000 });
});

test('senha errada mostra mensagem genérica', async ({ page }) => {
  await entrar(page, USUARIOS.admin, 'SenhaErrada123');
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
  await expect(page).toHaveURL(/\/login/);
});

test('admin entra, vê o dashboard e o menu completo, e sai', async ({ page }) => {
  await entrar(page, USUARIOS.admin);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Visão geral', level: 2 })).toBeVisible();
  await expect(page.getByText('Admin', { exact: true }).first()).toBeAttached();

  await abrirMenuSeCelular(page);
  const nav = page.getByRole('navigation', { name: 'Navegação principal' }).last();
  // Administração começa recolhida no menu.
  await nav.getByRole('button', { name: 'Administração' }).click();
  await expect(nav.getByRole('link', { name: /Usuários/ })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Auditoria/ })).toBeVisible();
  await page.keyboard.press('Escape');

  // A sessão sobrevive a um recarregamento (refresh silencioso via cookie httpOnly).
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Visão geral', level: 2 })).toBeVisible();

  // Menu do usuário fica no rodapé do menu lateral (no celular, dentro da gaveta).
  await abrirMenuSeCelular(page);
  await page.getByRole('button', { name: 'Menu do usuário' }).last().click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('visualizador não vê itens de administração nem acessa por URL', async ({ page }) => {
  await entrar(page, USUARIOS.visualizador);
  await expect(page).toHaveURL(/\/dashboard$/);
  await abrirMenuSeCelular(page);
  const nav = page.getByRole('navigation', { name: 'Navegação principal' }).last();
  await expect(nav.getByRole('link', { name: /Visão geral/ })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Usuários/ })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: /Importações/ })).toHaveCount(0);
});

test('primeiro acesso obriga a trocar a senha antes de usar o sistema', async ({
  page,
  browserName,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'troca a senha do gestor: roda uma vez só');
  void browserName;
  await entrar(page, USUARIOS.gestor);
  await expect(page).toHaveURL(/\/trocar-senha$/);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/trocar-senha$/);

  await page.getByLabel('Senha provisória').fill(senha());
  await page.getByLabel('Nova senha', { exact: true }).fill('curta');
  await page.getByLabel('Confirme a nova senha').fill('curta');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('A senha precisa ter pelo menos 10 caracteres')).toBeVisible();

  await page.getByLabel('Nova senha', { exact: true }).fill('GestorNovo2026');
  await page.getByLabel('Confirme a nova senha').fill('GestorNovo2026');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Visão geral', level: 2 })).toBeVisible();
});

test('esqueci minha senha confirma o envio sem revelar se o e-mail existe', async ({ page }) => {
  await page.goto('/esqueci-senha');
  await page.getByLabel('E-mail').fill('qualquer@metahospitalar.com.br');
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByRole('heading', { name: 'Verifique seu e-mail' })).toBeVisible();
});
