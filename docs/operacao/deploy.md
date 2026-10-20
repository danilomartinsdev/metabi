# Deploy em produção

Um servidor Linux com Docker. O `docker-compose.prod.yml` sobe quatro serviços:

| Serviço    | O que faz                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------- |
| `postgres` | Banco (volume `pgdata`), só na rede interna                                                  |
| `migrate`  | Roda `prisma migrate deploy` e termina; a API só sobe depois dele                            |
| `api`      | NestJS + Chromium para o PDF (volume `storage`), só na rede interna                          |
| `web`      | Caddy: serve a SPA, HTTPS automático e proxy de `/api`; único com portas publicadas (80/443) |

## 1. Preparar o servidor (uma vez)

```bash
# Docker + plugin compose (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # saia e entre de novo na sessão
sudo apt-get install -y git

# Acesso ao GitHub (repositório privado): chave SSH do servidor como "Deploy key" (só leitura)
ssh-keygen -t ed25519 -C "servidor-metabi" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub   # cole em GitHub › repositório › Settings › Deploy keys
```

DNS do domínio apontando para o servidor e portas 80/443 liberadas no firewall (para o HTTPS automático).

## 2. Baixar o projeto

```bash
git clone -b main git@github.com:danilomartinsdev/metabi.git
cd metabi
```

## 3. Criar o `.env` de produção

```bash
cp .env.example .env
nano .env
```

Preencha (gere segredos com `openssl rand -base64 48`):

| Variável                                                            | Valor em produção                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`               | usuário, **senha forte** e nome do banco                                 |
| `JWT_ACCESS_SECRET`                                                 | segredo aleatório com 32+ caracteres                                     |
| `WEB_ORIGIN` e `APP_URL`                                            | `https://seu-dominio.com.br`                                             |
| `SITE_ADDRESS`                                                      | `seu-dominio.com.br` (HTTPS automático) ou `:80` para testar sem domínio |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | servidor de e-mail ("esqueci minha senha")                               |

`DATABASE_URL`, `NODE_ENV`, `COOKIE_SECURE`, `API_HOST` e `PRINT_BASE_URL` já são definidos pelo
`docker-compose.prod.yml` — não precisa mexer. Nunca commite o `.env`.

### Só HTTP (rede interna, sem domínio)

Para acessar por `http://IP:porta`, acrescente ao `.env` (ex.: servidor 10.1.1.50, porta 34827):

```bash
WEB_ORIGIN=http://10.1.1.50:34827
APP_URL=http://10.1.1.50:34827
SITE_ADDRESS=:80
HTTP_PORT=34827
HTTPS_PORT=34828
COOKIE_SECURE=false
PERMITIR_HTTP=true
```

Sem `PERMITIR_HTTP=true` a API se recusa a subir sem HTTPS. **Risco:** sem HTTPS, senhas e sessões trafegam
sem criptografia na rede — use só em rede interna controlada.

## 4. Subir

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml ps        # api e web "healthy"/"running"; migrate "exited (0)"
```

## 5. Primeiro acesso (uma vez)

```bash
# Papéis padrão (em produção o seed não cria usuários)
docker compose -f docker-compose.prod.yml run --rm -e NODE_ENV=production migrate pnpm exec tsx prisma/seed.ts

# Admin inicial — a troca de senha é pedida no primeiro login
docker compose -f docker-compose.prod.yml run --rm \
  -e ADMIN_EMAIL='voce@empresa.com.br' -e ADMIN_NOME='Seu Nome' -e ADMIN_SENHA='senha-provisoria-forte' \
  migrate pnpm exec tsx prisma/criar-admin.ts
```

Depois, no navegador: entrar, trocar a senha, importar a planilha do Focco (Administração › Importações),
conferir o segmento dos representantes, cadastrar metas e o histórico de faturamento.

## Alternativa: levar a base de desenvolvimento para produção

Em vez do passo 5, dá para restaurar um backup do banco local (pedidos, cadastros, metas, histórico e usuários).
O arquivo tem dados de clientes: **nunca** coloque no GitHub; copie direto para o servidor.

```bash
# No computador de desenvolvimento (gera o backup a partir do container local)
docker exec metabi-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > metabi-base.dump
scp metabi-base.dump usuario@servidor:~/metabi/

# No servidor, com a stack já no ar (passo 4)
cd ~/metabi
docker compose -f docker-compose.prod.yml stop api
docker compose -f docker-compose.prod.yml exec -T postgres   sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < metabi-base.dump
docker compose -f docker-compose.prod.yml start api
rm metabi-base.dump
```

Depois de restaurar: os usuários de exemplo do desenvolvimento (`admin@`, `gestor@`, `representante@`,
`visualizador@metahospitalar.com.br`) vêm junto — **desative-os** em Administração › Usuários.

## Atualizar para uma versão nova

Antes, valide a branch na homologação, sobre uma cópia da base de produção: [homologacao.md](homologacao.md).

```bash
cd metabi
git pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --build   # migrations rodam sozinhas
```

## Comandos úteis

```bash
docker compose -f docker-compose.prod.yml logs -f api     # logs da API
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml down            # para tudo (os volumes/dados ficam)
```

Backup e restauração do banco: ver [backup-restore.md](backup-restore.md).

## A validar no primeiro deploy

- [ ] PDF em produção: a API usa o Chromium do Alpine (`PDF_CHROMIUM_PATH`), diferente do usado em dev. Com o disco somente leitura, o Chromium precisa de `XDG_CONFIG_HOME`/`XDG_CACHE_HOME` em `/tmp` (já no `api.Dockerfile`; sem isso ele morre ao abrir: "chrome_crashpad_handler: --database is required").
- [ ] HTTPS emitido pelo Caddy para o domínio.
- [ ] Backup diário agendado e restauração testada.
- [ ] Login, importação, exportação Excel/PDF testados em produção.
