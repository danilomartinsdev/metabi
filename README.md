# Meta Hospitalar BI

Dashboard executivo para acompanhamento de pedidos, faturamento, gestores, estados e regiões. O projeto usa Nuxt 4, Node.js e Docker. A base é importada diretamente de arquivos `.xls` ou `.xlsx` e armazenada em um volume Docker.

## Executar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3789`.

Só no modo de desenvolvimento (`npm run dev`), se as variáveis de acesso não estiverem definidas, o login padrão é `admin@metahospitalar.com.br` / `admin123`. Em produção não existe login padrão.

## Configuração de acesso (obrigatória em produção)

Em produção o servidor **não sobe** sem estas variáveis:

| Variável | O que é |
|---|---|
| `NUXT_JWT_SECRET` | Segredo das sessões, com pelo menos 32 caracteres. Gere com `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NUXT_ADMIN_EMAIL` | E-mail de login do administrador |
| `NUXT_ADMIN_PASSWORD_HASH` | Hash bcrypt da senha. Gere com `npm run hash-password -- "senha-forte"` |

## Executar com Docker

Copie `.env.example` para `.env`, preencha os valores e rode:

```bash
docker compose up --build
```

No painel, use **Importar Excel** para enviar a planilha. O importador reconhece as colunas `ID`, `NUM PEDIDO`, `ORDEM CPR`, `DT EMIS`, `DT ENTREGA`, `POS PDV`, `CLIENTE`, `UF`, `REPRESENTANTE` e `VALOR`.

## Deploy no Windows Server 2019 (AWS EC2)

O Docker do Windows Server 2019 roda **containers Windows**, por isso use o `Dockerfile.windows` (base `servercore:ltsc2019` + Node 24).

No servidor, em um PowerShell como Administrador, na pasta do projeto:

```powershell
.\deploy\deploy-windows.ps1 -JwtSecret "chave-aleatoria-com-32+-caracteres" `
  -AdminEmail "admin@metahospitalar.com.br" `
  -AdminPasswordHash '<hash gerado com npm run hash-password>'
```

Use aspas simples no hash, porque ele contém `$`.

O script faz o build da imagem, cria o volume `meta-bi-data` para os dados, sobe o container na porta `3789` e libera a porta no firewall do Windows. Também é preciso liberar a porta `3789` (TCP) no Security Group da instância.

Variáveis de runtime: `NUXT_JWT_SECRET`, `NUXT_ADMIN_EMAIL`, `NUXT_ADMIN_PASSWORD_HASH`, `NUXT_DATA_FILE` e `NUXT_COOKIE_SECURE` (`true` só quando o site estiver atrás de HTTPS; em HTTP o login não funciona com ela ligada).
