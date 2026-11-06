# Tutorial — subir o MetaBI num Windows Server (AWS EC2), sem Docker

Passo a passo para colocar o sistema no ar num **Windows Server 2019** (ou mais novo), trazendo a base atual
da Vercel. O Docker do Windows Server só roda containers Windows, e a stack do projeto é Linux. Por isso, aqui
tudo roda como **serviço do Windows**:

| Serviço do Windows           | O que faz                                                             |
| ---------------------------- | --------------------------------------------------------------------- |
| `postgresql-x64-NN`          | Banco PostgreSQL (instalador oficial)                                 |
| `metabi-api`                 | API (NestJS), só em `127.0.0.1:4318`; gera PDF com o Chrome instalado |
| `metabi-web`                 | Caddy: serve o site, faz HTTPS e repassa `/api` para a API            |
| Tarefa `MetaBI\BackupDiario` | Backup do banco todo dia às 02:00, guardado por 30 dias               |

Arquivos fora do código ficam em `C:\metabi-dados` (logs, backups, uploads, site publicado, Caddy).

> Servidor Linux com Docker? Use o [TUTORIAL-SERVIDOR.md](TUTORIAL-SERVIDOR.md).

---

## 1. Instalar os pré-requisitos (uma vez, à mão)

Na área de trabalho remota do servidor:

1. **Node.js 24 LTS**: baixe o instalador `.msi` (Windows x64) em https://nodejs.org e instale com as opções padrão.
2. **PostgreSQL 17**: baixe em https://www.postgresql.org/download/windows/ (instalador da EDB).
   - Defina e **anote a senha do usuário `postgres`**. O script pede essa senha uma vez.
   - Porta `5432` (padrão). Pode desmarcar o _Stack Builder_ no fim.
   - O Neon (banco da Vercel) precisa ser da mesma versão ou mais antigo. O script confere.
3. **Git** e **Google Chrome**: já estão no servidor. O Chrome é usado para gerar os PDFs.

Abra um **Prompt de Comando como Administrador** e ative o pnpm:

```bat
node -v
corepack enable
```

O `node -v` deve mostrar `v24.x`. Se o comando não for encontrado, feche e abra o prompt de novo.

## 2. Baixar o projeto do GitHub

O repositório é privado. Crie uma chave para o servidor e cadastre no GitHub como **Deploy key**, só leitura:

```bat
ssh-keygen -t ed25519 -C "servidor-metabi-ec2" -f %USERPROFILE%\.ssh\id_ed25519 -N ""
type %USERPROFILE%\.ssh\id_ed25519.pub
```

Copie a linha que aparecer e cole em **GitHub › metabi › Settings › Deploy keys › Add deploy key**.
Deixe "Allow write access" desmarcado. Depois:

```bat
cd C:\
git clone -b main git@github.com:danilomartinsdev/metabi.git
cd C:\metabi
```

## 3. Instalar

Ainda como Administrador, em `C:\metabi`:

```bat
pnpm windows:instalar
```

O script pergunta duas coisas:

- **Endereço** que os usuários vão abrir:
  - `https://bi.metahospitalar.com.br`: HTTPS automático. O domínio precisa apontar para o IP público da
    EC2 (registro A) e as portas **80 e 443** precisam estar livres no servidor.
  - `http://desenvmeta.ddns.com.br:34827`: só HTTP, numa porta própria. Funciona sem domínio, mas senhas
    trafegam sem criptografia. Use só para testar.
- **Senha do usuário `postgres`** (do passo 1), para criar o banco `metabi`.

Ele gera o `.env` com senhas aleatórias, cria o banco, baixa o Caddy e o WinSW (versões fixas, com hash
conferido), compila tudo, registra os serviços, libera as portas no firewall do Windows e agenda o backup.
Leva alguns minutos. Se uma porta já estiver em uso por outro sistema do servidor, ele avisa antes de mudar
qualquer coisa.

**AWS:** no console da EC2, em **Security Group › Inbound rules**, libere a porta TCP usada (80 e 443, ou a
porta do endereço HTTP).

## 4. Trazer a base da Vercel

1. Vercel › **Storage** › banco Neon › **.env.local**: copie o valor de `DATABASE_URL_UNPOOLED` (URL
   **direta**, sem `-pooler`).
2. No servidor, cole essa URL, sozinha, no arquivo `C:\metabi-dados\segredos\neon-url-direta.txt`.
3. Rode:

```bat
pnpm windows:copiar-neon
```

O Neon só é lido. A base deste servidor é **substituída** (antes, o script faz um backup dela). Os usuários
entram com a mesma senha da Vercel. No fim, apague o arquivo com a URL.

Começando do zero? Em vez disso, crie um administrador com `pnpm windows:criar-admin` e importe a planilha do
Focco em **Administração › Importações**.

## 5. E-mail ("esqueci minha senha")

Abra `C:\metabi\.env` no Bloco de Notas e preencha `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
`SMTP_PASSWORD` e `SMTP_FROM` com os mesmos valores da Vercel. Depois rode `pnpm windows:atualizar --sem-git`.

## 6. Conferir

```bat
pnpm windows:status
```

Os serviços devem aparecer como `RUNNING`, a API com `HTTP 200`. No navegador:

1. Abra o endereço escolhido e entre com o seu usuário.
2. Teste: Visão geral, um ranking, **Exportar › Excel** e **Exportar › PDF**.
3. Login de um representante: ele só vê os próprios dados.

## Virada (sair da Vercel)

Enquanto as duas versões estiverem no ar, cada uma tem a **sua** base. Para virar:

1. Avise os usuários. Ninguém importa planilhas durante a virada.
2. Rode `pnpm windows:copiar-neon` de novo, para pegar os dados mais recentes.
3. Confira (passo 6) e passe o novo endereço aos usuários.
4. Depois de alguns dias funcionando, desligue os projetos na Vercel.

---

## Atualizar para uma versão nova

Depois de um push na `main`:

```bat
cd C:\metabi
pnpm windows:atualizar
```

O script faz backup, baixa o código, compila, aplica as migrations e reinicia. O sistema fica fora do ar por
alguns minutos, então prefira fora do horário de uso. Se der erro, ele mostra como voltar à versão anterior.

## Comandos do dia a dia

| Comando                         | O que faz                                            |
| ------------------------------- | ---------------------------------------------------- |
| `pnpm windows:status`           | Situação dos serviços, da API e do último backup     |
| `pnpm windows:atualizar`        | Atualiza para a versão mais nova da `main`           |
| `pnpm windows:backup`           | Backup do banco agora (em `C:\metabi-dados\backups`) |
| `pnpm windows:criar-admin`      | Cria um admin ou redefine a senha de um              |
| `net stop metabi-api` / `start` | Para ou liga a API (idem `metabi-web` para o site)   |

Logs: `C:\metabi-dados\logs` (`metabi-api.err.log`, `metabi-web.err.log`).

**Restaurar um backup:** `net stop metabi-api`, depois rode (com a senha do usuário `metabi`, que está no
`.env`, em `POSTGRES_PASSWORD`):

```bat
set PGPASSWORD=senha-do-env
"C:\Program Files\PostgreSQL\17\bin\pg_restore" --clean --if-exists --no-owner -h 127.0.0.1 -U metabi -d metabi C:\metabi-dados\backups\ARQUIVO.dump
set PGPASSWORD=
net start metabi-api
```

**Cópia fora do servidor:** os backups ficam no mesmo disco. Ative snapshots automáticos do volume EBS na AWS
(Data Lifecycle Manager) para ter cópia fora da máquina.

## Problemas comuns

| Sintoma                | O que fazer                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| Site não abre de fora  | Porta liberada no Security Group da AWS? `pnpm windows:status` mostra o site respondendo local? |
| HTTPS não funciona     | DNS ainda não propagou ou portas 80/443 fechadas/ocupadas. Veja `metabi-web.err.log`            |
| "porta já está em uso" | Outro sistema usa a porta. Escolha outra (HTTP) ou libere 80/443                                |
| Erro ao gerar PDF      | Veja `metabi-api.err.log`. O Chrome está instalado em `PDF_CHROMIUM_PATH` (no `.env`)?          |
