# Deploy na Vercel (site + API) com banco no Neon e domínio no HostGator

Decisão e motivos: [ADR 0008](../arquitetura/adr/0008-hospedagem-vercel.md).
Deploy em servidor próprio com Docker continua em [deploy.md](deploy.md).

## Visão geral

| Peça         | Onde                                                        | Endereço                                                    |
| ------------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| Site (telas) | Vercel — projeto **metabi-web** (Root Directory `apps/web`) | `https://metabi-web.vercel.app` (depois, domínio próprio)   |
| API          | Vercel — projeto **metabi-api** (Root Directory `apps/api`) | `https://metabi-api.vercel.app` (o site a chama por `/api`) |
| Banco        | Neon (PostgreSQL)                                           | —                                                           |
| Domínio      | cPanel do HostGator (Editor de Zona)                        | CNAME `bi` → `cname.vercel-dns.com`                         |

## 1. Banco no Neon (pelo painel da Vercel)

Caminho escolhido: criar o Neon pela própria Vercel (cobrança e acesso na conta Vercel).
Faça depois de criar o projeto da API (passo 2, antes do primeiro deploy):

1. Vercel › projeto **metabi-api** › **Storage › Create Database › Neon** (região São Paulo, se houver) › conecte ao projeto.
2. A integração cria as variáveis de conexão. Confira em **Settings › Environment Variables**:
   - `DATABASE_URL` deve ser a URL **pooled** (host com `-pooler`);
   - `DATABASE_URL_UNPOOLED` (URL direta, sem `-pooler`) é usada pelas migrations automaticamente — não precisa
     criar `DATABASE_URL_DIRECT` (o valor é sensível e a Vercel não deixa copiá-lo).

Alternativa: conta própria em https://neon.tech, copiando as mesmas duas URLs de **Connection Details**.

## 2. Projeto da API na Vercel

Antes: no GitHub, **Settings › General › Default branch** = `main`. Ao importar, a Vercel já tenta um primeiro
deploy; se falhar por falta de banco/variáveis, tudo bem — complete os passos e use **Deployments › Redeploy**.

1. Crie a conta em https://vercel.com entrando com o GitHub.
2. **Add New › Project** › importe `danilomartinsdev/metabi`.
3. **Root Directory:** `apps/api` · Framework: _Other_ (o `apps/api/vercel.json` define o build).
4. **Environment Variables** (Production):

| Variável                                                                           | Valor                                                                                     |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                         | `production`                                                                              |
| `DATABASE_URL`                                                                     | URL **pooled** do Neon (criada pela integração)                                           |
| `DATABASE_URL_UNPOOLED`                                                            | URL **direta** do Neon (criada pela integração; ou `DATABASE_URL_DIRECT` se Neon próprio) |
| `JWT_ACCESS_SECRET`                                                                | segredo forte (arquivo `C:\Users\Danilo\metabi-segredos\metabi-vercel-api.env`)         |
| `WEB_ORIGIN`, `APP_URL`, `PRINT_BASE_URL`                                          | `https://bi.seudominio.com.br`                                                            |
| `COOKIE_SECURE`                                                                    | `true`                                                                                    |
| `IMPORT_MAX_FILE_MB`                                                               | `4`                                                                                       |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | e-mail (se ainda não tiver, valores fictícios — só o "esqueci minha senha" não funciona)  |

5. **Settings › Git › Production Branch** = `main` (o default do GitHub ainda é `fase-0-contexto`).
6. **Deploy.** O build roda as migrations no Neon. Anote o endereço do projeto (ex.: `https://metabi-api.vercel.app`).
7. Teste: `https://metabi-api.vercel.app/api/health` deve responder `{"status":"ok"...}`.

## 3. Levar a base da produção para o Neon

A produção atual roda no Docker deste PC (`metabi-prod`, exposta pelo ngrok). O script copia o banco dela
(só leitura) para o Neon, **substituindo** o que houver lá, e apaga sessões, links de senha, tokens de
impressão e prévias (não valem no novo endereço). Os usuários entram com a mesma senha.

1. Vercel › **Storage** › banco Neon › **.env.local** (ou **Show secret**): copie o valor de
   `DATABASE_URL_UNPOOLED` (URL **direta**, sem `-pooler`).
2. Cole essa URL, sozinha, no arquivo `C:\Users\Danilo\metabi-segredos\neon-url-direta.txt` (fora do
   repositório, junto dos outros segredos; o script nunca a imprime).
3. Neste PC, com a produção rodando: `pnpm vercel:copiar-prod`. No fim ele mostra quantos pedidos e
   usuários foram copiados — confira com a produção.

A cópia fica também em `C:\Users\Danilo\metabi-backups\prod-para-neon-<data>.dump`.
Pode rodar de novo quantas vezes quiser até a virada (passo 6): cada vez substitui o Neon inteiro.
Se os usuários de exemplo (`admin@`, `gestor@`, `representante@`, `visualizador@metahospitalar.com.br`)
existirem na produção, desative-os em Administração › Usuários.

## 4. Projeto do site na Vercel

1. **Add New › Project** › o mesmo repositório de novo.
2. **Root Directory:** `apps/web` · Framework: _Other_.
3. **Environment Variables:** `API_ORIGIN` = endereço da API do passo 2 (ex.: `https://metabi-api.vercel.app`).
4. **Settings › Git › Production Branch** = `main`.
5. **Deploy.**

## 5. Domínio próprio (opcional, pode ficar para depois)

Sem domínio próprio o endereço é o do projeto web (ex.: `https://metabi-web.vercel.app`) — use-o em
`WEB_ORIGIN`, `APP_URL` e `PRINT_BASE_URL` da API. Ao ligar o domínio, troque essas três variáveis e faça **Redeploy** da API.

1. Vercel › projeto **metabi-web** › **Settings › Domains** › adicione `bi.seudominio.com.br`.
2. cPanel do HostGator › **Editor de Zona** › domínio › **+ CNAME**:
   - Nome: `bi` · Registro: `cname.vercel-dns.com`
3. Em alguns minutos a Vercel valida e emite o HTTPS. Acesse `https://bi.seudominio.com.br`.

## 6. Virada (sair do ngrok) — feita em 2026-10-19

Depois da virada o Neon é a produção: `pnpm vercel:copiar-prod` recusa rodar sem `--sobrescrever-producao-vercel`
(só para recuperação). Para definir a senha de alguém no banco da Vercel:
`NOVA_SENHA=... pnpm vercel:definir-senha <e-mail>`.

Passos usados na virada:

1. Avise os usuários; ninguém importa nada durante a virada.
2. Rode de novo `pnpm vercel:copiar-prod` (dados mais recentes).
3. Entre no endereço da Vercel e confira: Visão geral, Faturamento, Análise de faturamento, um PDF e o login de
   um representante (só vê os próprios dados).
4. Desligue o túnel do ngrok (feche a janela dele) e passe o novo endereço aos usuários.
5. Deixe a stack Docker `metabi-prod` parada mas guardada por alguns dias, como plano B
   (`docker compose -p metabi-prod stop`, na pasta `metabi-publico`).

A partir daqui a produção é a Vercel: o fluxo vira homologação (Docker, neste PC) → merge na `main` → push.

## Plano Hobby (grátis)

Funciona para começar, com dois cuidados: os termos da Vercel reservam o Hobby para uso **não comercial**
(para uso da empresa, o correto é o Pro) e a função tem limites menores — se o PDF falhar por tempo ou
memória, o caminho é o Pro.

## Atualizações

Cada `git push` na `main` faz a Vercel publicar os dois projetos de novo (migrations rodam no build da API).

## Problemas comuns

| Sintoma                                | O que fazer                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Build da API falha em `migrate deploy` | Confira `DATABASE_URL_UNPOOLED`/`DATABASE_URL_DIRECT` (URL sem `-pooler`)                               |
| Login não mantém a sessão              | `WEB_ORIGIN`/`APP_URL` devem ser o domínio do site, com `https://`; `COOKIE_SECURE=true`                |
| Site abre mas dados dão erro           | `API_ORIGIN` do projeto web errado; teste `/api/health` direto na API                                   |
| PDF falha                              | Vercel › metabi-api › Logs; a função precisa de 2 GB/60 s (já no `vercel.json`) — plano Pro recomendado |
| Primeira tela demora                   | Normal após um tempo sem uso (a função "acorda" em alguns segundos)                                     |
