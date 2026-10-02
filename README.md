# Meta Hospitalar BI

Dashboard executivo para acompanhamento de pedidos, faturamento, gestores, estados e regiões. O projeto usa Nuxt 3, Node.js e Docker. A base é importada diretamente de arquivos `.xls` ou `.xlsx` e armazenada em um volume Docker.

## Executar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

**Acesso inicial:** `admin@metahospitalar.com.br` / `admin123`.

## Executar com Docker

```bash
docker compose up --build
```

No painel, use **Importar Excel** para enviar a planilha. O importador reconhece as colunas `ID`, `NUM PEDIDO`, `ORDEM CPR`, `DT EMIS`, `DT ENTREGA`, `POS PDV`, `CLIENTE`, `UF`, `REPRESENTANTE` e `VALOR`.

O usuário inicial é demonstrativo para o MVP. Antes de publicar, altere a autenticação para uma tabela de usuários e defina `JWT_SECRET` em um arquivo `.env`.
