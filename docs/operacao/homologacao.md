# Homologação

Segunda stack Docker, **isolada da produção**, na mesma máquina. Serve para testar uma branch sobre
uma cópia da base de produção antes do merge na `main` e do deploy.

|                | Produção                          | Homologação                                                                 |
| -------------- | --------------------------------- | --------------------------------------------------------------------------- |
| Projeto Docker | `meta-bi-prod`                    | `meta-bi-homolog`                                                           |
| Pasta (clone)  | `C:\Users\Danilo\meta-bi-publico` | `C:\Users\Danilo\meta-bi-homolog`                                           |
| `.env`         | o da pasta da produção            | o da pasta da homologação (segredos próprios, linha `AMBIENTE=homologacao`) |
| Acesso         | ngrok (HTTPS)                     | só nesta máquina: `http://localhost:4337` (opcional: rede local)            |
| E-mail         | SMTP real                         | Mailpit (`http://127.0.0.1:4339`), nada sai                                 |
| Identificação  | —                                 | faixa "Homologação" em todas as telas e `[HOMOLOG]` no título da aba        |

Volumes, rede e containers são separados (`meta-bi-homolog_*`). Tudo é feito pelo
`scripts/homologacao.mjs`, que **sempre** usa o projeto `meta-bi-homolog` e o clone da homologação, e
recusa rodar se o `.env` do clone não for o da homologação. Da produção, o script só **lê** (pg_dump).

## Primeira vez

```bash
pnpm homolog:preparar            # clone + .env da homologação, em http://localhost:4337
```

Para abrir de outros computadores da rede: apague o `.env` do clone (antes de subir pela primeira vez),
rode `pnpm homolog:preparar --rede` (detecta o IP; ou `--rede --ip 10.1.1.138`) e libere a porta
(PowerShell **como administrador**, uma vez):

```powershell
netsh advfirewall firewall add rule name="meta-bi-homolog" dir=in action=allow protocol=TCP localport=4337
```

## Testar uma branch

```bash
pnpm homolog:subir <branch>      # checkout da branch no clone + build + migrations da branch
pnpm homolog:copiar-prod         # (quando quiser dados frescos) cópia da produção → homologação
```

A branch precisa conter a infraestrutura da homologação (`docker-compose.homolog.yml`): se ela saiu
da `main` antes disso, faça merge da `main` nela.

`copiar-prod`:

1. `pg_dump` da produção para `C:\Users\Danilo\meta-bi-backups\prod-<data>.dump` (fora do git; serve
   também de backup).
2. Para a API da homologação, recria o schema e restaura a cópia.
3. Apaga sessões, links de redefinição de senha, tokens de impressão e arquivos temporários — nada
   da produção vale na homologação.
4. Substitui as planilhas importadas da homologação (volume `storage`) por uma cópia das da produção
   (volume da produção montado só leitura).
5. Sobe de novo: o `migrate` aplica as migrations da branch por cima da cópia (é aqui que uma
   migration nova é testada contra os dados reais).

Fluxo completo: `subir <branch>` → `copiar-prod` → testar → merge na `main` → deploy em produção
([deploy.md](deploy.md)).

## Outros comandos

```bash
pnpm homolog:status              # versão no ar e containers
pnpm homolog:parar               # para a homologação (a produção não é tocada)
```

## Cuidados

- A cópia tem **dados reais de clientes e usuários**. Fica só nesta máquina (ou na rede local, com `--rede`); usuários entram com a
  mesma senha da produção; e-mails ficam no Mailpit.
- O modo automático do Claude Code bloqueia esses comandos: quem roda é você, com `!` no prompt e
  caminhos `/c/Users/...` (em 2026-10-06 um `cd` com barras invertidas falhou e o compose rodou na
  pasta errada, recriando o Postgres da produção com outra senha — o script existe para evitar isso).
