# Meta Hospitalar BI

Dashboard executivo para acompanhamento de pedidos, faturamento, gestores, estados e regiões. O projeto usa Nuxt 3, Node.js e Docker. A base é importada diretamente de arquivos `.xls` ou `.xlsx` e armazenada em um volume Docker.

## Executar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3789`.

**Acesso inicial:** `admin@metahospitalar.com.br` / `admin123`.

## Executar com Docker

```bash
docker compose up --build
```

No painel, use **Importar Excel** para enviar a planilha. O importador reconhece as colunas `ID`, `NUM PEDIDO`, `ORDEM CPR`, `DT EMIS`, `DT ENTREGA`, `POS PDV`, `CLIENTE`, `UF`, `REPRESENTANTE` e `VALOR`.

O usuário inicial é demonstrativo para o MVP. Antes de publicar, altere a autenticação para uma tabela de usuários e defina `JWT_SECRET` em um arquivo `.env`.

## Deploy no Windows Server 2019 (AWS EC2)

O Docker do Windows Server 2019 roda **containers Windows**, por isso use o `Dockerfile.windows` (base `servercore:ltsc2019` + Node 24).

No servidor, em um PowerShell como Administrador, na pasta do projeto:

```powershell
.\deploy\deploy-windows.ps1 -JwtSecret "uma-chave-longa-e-aleatoria"
```

O script faz o build da imagem, cria o volume `meta-bi-data` para os dados, sobe o container na porta `3789` e libera a porta no firewall do Windows. Também é preciso liberar a porta `3789` (TCP) no Security Group da instância.

Variáveis de runtime: `NUXT_JWT_SECRET`, `NUXT_DATA_FILE` e `NUXT_COOKIE_SECURE` (`true` só quando o site estiver atrás de HTTPS; em HTTP o login não funciona com ela ligada).
