# Tutorial — subir o BI Meta Hospitalar no servidor

Passo a passo para colocar o sistema no ar num servidor Linux (Ubuntu/Debian) com Docker,
baixando o código do GitHub e levando junto a base de dados atual.

> Referência técnica (serviços, variáveis, atualização): [docs/operacao/deploy.md](docs/operacao/deploy.md).

---

## Visão geral

| Onde               | O que fazer                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Seu computador** | 1. Enviar o código para o GitHub · 2. Gerar o backup da base · 3. Copiar o backup para o servidor                      |
| **Servidor**       | 4. Instalar Docker e git · 5. Baixar o projeto · 6. Configurar o `.env` · 7. Subir · 8. Restaurar a base · 9. Conferir |

Tempo estimado: 30–40 minutos (a primeira construção das imagens leva alguns minutos).

**Você vai precisar de:** acesso SSH ao servidor (usuário com `sudo`), o domínio que vai apontar
para ele (ex.: `bi.metahospitalar.com.br`) e os dados de um servidor de e-mail (SMTP), se tiver.

---

## No seu computador

### 1. Enviar o código para o GitHub

Na pasta do projeto:

```bash
git status                    # deve dizer "nothing to commit"
git push origin main
```

### 2. Gerar o backup da base atual

Com o Docker de desenvolvimento rodando (`pnpm db:up`):

```bash
cd ~/Documents
docker exec metabi-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > metabi-base.dump
```

> ⚠️ Esse arquivo tem dados reais de clientes e usuários. **Não coloque no GitHub**, não mande por
> e-mail/WhatsApp. Ele vai direto para o servidor e depois é apagado.

### 3. Copiar o backup para o servidor

```bash
scp ~/Documents/metabi-base.dump usuario@IP-DO-SERVIDOR:~/
```

---

## No servidor

Entre no servidor: `ssh usuario@IP-DO-SERVIDOR`

### 4. Instalar Docker e git (só na primeira vez)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo apt-get install -y git
exit
```

Entre de novo (`ssh usuario@IP-DO-SERVIDOR`) e confira: `docker --version` e `docker compose version`.

**Firewall:** libere as portas **80** e **443**. **DNS:** aponte o domínio para o IP do servidor
(registro A) — o HTTPS só é emitido depois que o DNS estiver propagado.

### 5. Baixar o projeto do GitHub

O repositório é privado. Crie uma chave para o servidor e cadastre no GitHub como **Deploy key**
(só leitura):

```bash
ssh-keygen -t ed25519 -C "servidor-metabi" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copie a linha que aparecer e cole em **GitHub › metabi › Settings › Deploy keys › Add deploy key**
(deixe "Allow write access" desmarcado). Depois:

```bash
git clone -b main git@github.com:danilomartinsdev/metabi.git
cd metabi
```

### 6. Configurar o `.env`

```bash
cp .env.example .env
nano .env
```

Para gerar senhas/segredos fortes, use (um por variável):

```bash
openssl rand -base64 48
```

Preencha principalmente:

| Variável                                                            | O que colocar                                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `POSTGRES_USER`                                                     | ex.: `metabi`                                                                                       |
| `POSTGRES_PASSWORD`                                                 | senha forte gerada                                                                                  |
| `POSTGRES_DB`                                                       | ex.: `metabi`                                                                                       |
| `JWT_ACCESS_SECRET`                                                 | segredo gerado (32+ caracteres)                                                                     |
| `WEB_ORIGIN`                                                        | `https://bi.seudominio.com.br`                                                                      |
| `APP_URL`                                                           | `https://bi.seudominio.com.br`                                                                      |
| `SITE_ADDRESS`                                                      | `bi.seudominio.com.br` — ou `:80` para testar só pelo IP, sem HTTPS                                 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | dados do e-mail. Sem e-mail ainda? Coloque qualquer valor — só o "esqueci minha senha" não funciona |

Não precisa mexer em `DATABASE_URL`, `NODE_ENV`, `COOKIE_SECURE`, `API_HOST` nem `PRINT_BASE_URL`:
o arquivo de produção já define. Salve com `Ctrl+O`, `Enter`, `Ctrl+X`.

### 7. Subir o sistema

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

A primeira vez demora (constrói as imagens). Confira:

```bash
docker compose -f docker-compose.prod.yml ps
```

Esperado: `postgres`, `api` e `web` rodando; `migrate` como **exited (0)** (ele cria as tabelas e termina).

### 8. Restaurar a base atual

```bash
docker compose -f docker-compose.prod.yml stop api

docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < ~/metabi-base.dump

docker compose -f docker-compose.prod.yml start api
rm ~/metabi-base.dump
```

Pedidos, cadastros, segmentos, metas, histórico de faturamento e usuários passam a estar em produção.

### 9. Conferir

1. Abra `https://bi.seudominio.com.br` (ou `http://IP-DO-SERVIDOR` se usou `SITE_ADDRESS=:80`).
2. Entre com o seu usuário de sempre.
3. Em **Administração › Usuários**, **desative** os usuários de exemplo do desenvolvimento:
   `admin@`, `gestor@`, `representante@` e `visualizador@metahospitalar.com.br`.
4. Teste: Visão geral, um ranking, **Exportar › Excel** e **Exportar › PDF**.

Pronto. 🎉

---

## Sem a base atual (instalação zerada)

No lugar do passo 8, crie os papéis e um administrador:

```bash
docker compose -f docker-compose.prod.yml run --rm -e NODE_ENV=production migrate pnpm exec tsx prisma/seed.ts

docker compose -f docker-compose.prod.yml run --rm \
  -e ADMIN_EMAIL='voce@empresa.com.br' -e ADMIN_NOME='Seu Nome' -e ADMIN_SENHA='senha-provisoria-forte' \
  migrate pnpm exec tsx prisma/criar-admin.ts
```

O sistema pede a troca da senha no primeiro login. Depois, importe a planilha do Focco em
**Administração › Importações**.

---

## Atualizar para uma versão nova

```bash
cd ~/metabi
git pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

As migrations do banco rodam sozinhas. Os dados não são apagados.

---

## Problemas comuns

| Sintoma                  | O que fazer                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Site não abre            | `docker compose -f docker-compose.prod.yml ps` — algum serviço parado? Veja os logs abaixo                   |
| HTTPS não funciona       | DNS ainda não propagou ou portas 80/443 fechadas. Teste com `SITE_ADDRESS=:80`                               |
| `migrate` com erro       | `docker compose -f docker-compose.prod.yml logs migrate` (geralmente `.env` do banco errado)                 |
| Erro ao gerar PDF        | `docker compose -f docker-compose.prod.yml logs api` — o PDF em produção ainda não foi validado; mande o log |
| Esqueci a senha do admin | Rode o `criar-admin.ts` (seção "Sem a base atual") com o mesmo e-mail: redefine a senha                      |

### Comandos do dia a dia

```bash
docker compose -f docker-compose.prod.yml logs -f api       # acompanhar a API (Ctrl+C para sair)
docker compose -f docker-compose.prod.yml restart api       # reiniciar a API
docker compose -f docker-compose.prod.yml down              # parar tudo (os dados ficam guardados)
docker compose -f docker-compose.prod.yml up -d             # ligar de novo
```

Backup diário do banco: ver [docs/operacao/backup-restore.md](docs/operacao/backup-restore.md).
