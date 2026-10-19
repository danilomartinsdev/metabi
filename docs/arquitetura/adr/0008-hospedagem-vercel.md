# ADR 0008 — Hospedagem na Vercel (site + API serverless) com banco no Neon

**Status:** aceito (2026-10-05)

## Contexto

O BI precisa ficar no ar no domínio da empresa. O plano contratado no HostGator (Turbo) é hospedagem
compartilhada e não roda Docker, Node em serviço nem PostgreSQL. O usuário escolheu a Vercel.

O sistema foi feito para Docker (Caddy + API NestJS/Fastify + Postgres, ADR 0002/0004). Na Vercel a API
roda como função serverless: sem disco persistente, cada requisição pode cair numa instância diferente,
corpo de requisição de até 4,5 MB e Chromium próprio para o PDF.

## Decisão

- **Dois projetos Vercel** no mesmo repositório: `apps/web` (SPA estática via Build Output API, com os
  mesmos cabeçalhos de segurança/CSP do Caddy e `/api/*` encaminhado à API — mesma origem) e `apps/api`
  (função `api/index.js`, que recebe todo `/api/*` por um rewrite e reaproveita `criarApp()`, o mesmo código do Docker).
- **Banco no Neon** (Postgres gerenciado): `DATABASE_URL` com pool de conexões para a aplicação e
  `DATABASE_URL_DIRECT` para as migrations (`prisma migrate deploy` roda no build da API).
- **Estado fora do disco/memória**: prévia de importação em `ArquivoTemporario` (banco) e token do PDF em
  `TokenImpressao` (banco, hash, uso único) — vale também para o Docker.
- **PDF** com `@sparticuz/chromium` quando `VERCEL` está definido; Docker segue com o Chromium do sistema.
- **Upload limitado a 4 MB** (planilhas reais: < 1 MB).
- O deploy em **Docker continua suportado** (servidor próprio), com o mesmo código.

## Consequências

- **Positivas:** HTTPS e domínio próprio sem servidor para manter; deploy automático a cada push na `main`;
  prévia de importação e token do PDF ficaram mais robustos (sobrevivem a reinício e a várias instâncias).
- **Negativas/risco:** primeira requisição após inatividade mais lenta (função "acordando"); PDF mais
  sensível a tempo e memória (função com 2 GB e 60 s); rate limit passa a ser por instância (memória),
  menos rígido; custo: Vercel Pro (uso comercial) e Neon conforme o uso.
- Documentação operacional: `docs/operacao/deploy-vercel.md`.
