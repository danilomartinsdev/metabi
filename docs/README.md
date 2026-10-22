# Documentação — MetaBI (Metahospitalar)

Fonte de verdade do projeto. Leia o documento relevante **antes** de mexer na área.

| Área | Documento | Quando ler |
|---|---|---|
| Estado | [progresso.md](progresso.md) | Sempre ao começar uma sessão |
| Produto | [produto/PRD.md](produto/PRD.md) | Visão, usuários, escopo |
| | [produto/regras-de-negocio.md](produto/regras-de-negocio.md) | Região, segmento, status, metas, clientes |
| | [produto/telas.md](produto/telas.md) | Ao criar/alterar telas |
| | [produto/glossario.md](produto/glossario.md) | Termos (PDV, CPR, NE, gestor...) |
| Dados | [dados/dicionario-de-dados.md](dados/dicionario-de-dados.md) | Ao mexer no schema Prisma |
| | [dados/importacao-focco.md](dados/importacao-focco.md) | Ao mexer no importador |
| | [dados/metricas-kpis.md](dados/metricas-kpis.md) | Ao mexer em KPIs/comparativos |
| Arquitetura | [arquitetura/visao-geral.md](arquitetura/visao-geral.md) | Componentes e fluxos |
| | [arquitetura/seguranca-rbac.md](arquitetura/seguranca-rbac.md) | Auth, papéis, escopo, auditoria |
| | [arquitetura/api.md](arquitetura/api.md) | Convenções REST |
| | [arquitetura/adr/](arquitetura/adr/) | Decisões arquiteturais |
| Design | [design/design-system.md](design/design-system.md) | Antes de criar componente visual |
| Padrão visual | [design/padrao-visual.md](design/padrao-visual.md) | Layout comum aos outros projetos (menu, sino, barra flutuante) |
| Padrão de login | [design/padrao-login.md](design/padrao-login.md) | Tela de login e de senha (medidas, painel, miniatura) |
| Operação | [operacao/deploy.md](operacao/deploy.md) · [backup-restore.md](operacao/backup-restore.md) · [runbook.md](operacao/runbook.md) | Deploy e incidentes |

## ADRs
- [0001 — Monorepo pnpm](arquitetura/adr/0001-monorepo-pnpm.md)
- [0002 — Nuxt SPA + NestJS](arquitetura/adr/0002-nuxt-spa-nestjs.md)
- [0003 — Auth JWT + refresh em cookie](arquitetura/adr/0003-auth-jwt-refresh-cookie.md)
- [0004 — PDF via Playwright](arquitetura/adr/0004-pdf-via-playwright.md)
- [0005 — Hooks do Claude Code em Node](arquitetura/adr/0005-hooks-em-node.md)

Novos ADRs: arquivo `NNNN-titulo-curto.md` com Status, Contexto, Decisão, Consequências.
