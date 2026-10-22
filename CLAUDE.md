# MetaBI — Metahospitalar

BI comercial interno: importa o relatório de pedidos do ERP Focco3i e
apresenta KPIs, rankings e comparativos com controle de acesso por papel.

## Stack

Monorepo pnpm · Nuxt 4 (SPA) + Tailwind v4 + Nuxt UI v4 + ECharts ·
NestJS (Fastify) + Prisma + PostgreSQL · Zod compartilhado em packages/shared.

## Comandos

- `pnpm dev` — web + api em modo dev
- `pnpm db:up` / `pnpm db:down` — Postgres via Docker
- `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e`
- `pnpm --filter api db:migrate` · `pnpm --filter api db:seed`

## Mapa

- apps/web — frontend · apps/api — backend · packages/shared — schemas/tipos
- docs/ — especificação (índice em docs/README.md) · fixtures/ — planilhas de teste
- .claude/hooks — hooks em Node (.mjs), não em bash (ver ADR 0005)

## Regras inegociáveis

1. Escopo de dados (RBAC) é aplicado no backend em TODA query de vendas.
2. Dinheiro é Decimal, nunca float. Datas em America/Sao_Paulo. UI em pt-BR.
3. Schemas e tipos compartilhados vivem em packages/shared — não duplique.
4. Cores e espaçamentos só via tokens do design system.
5. Tarefa só termina com lint + typecheck + testes afetados passando.
6. Só ecossistema JavaScript/TypeScript (Node, Vue/Nuxt, NestJS). Nada de Python ou outras linguagens.
7. Não invente regra de negócio: registre em docs/progresso.md › "Decisões pendentes" e pergunte.

## Onde está o contexto (leia quando relevante)

- Regras de negócio: docs/produto/regras-de-negocio.md
- Padrão visual (layout comum aos outros projetos; cores/fontes seguem o design system): docs/design/padrao-visual.md
- Fórmulas de KPI: docs/dados/metricas-kpis.md
- Importação Focco: docs/dados/importacao-focco.md
- Segurança e RBAC: docs/arquitetura/seguranca-rbac.md
- Decisões arquiteturais: docs/arquitetura/adr/
- Estado atual do projeto: docs/progresso.md

## Agentes e skills

- Arquitetura/plano: plan mode + ADR em docs/arquitetura/adr/
- Interface: agente `vue-expert`, skills `frontend-design`, `ui-ux-pro-max`, `novo-grafico`
- API: agente `fullstack-developer`, skill `novo-modulo-api`
- KPIs: agente `data-analyst` · Testes: agente `test-engineer`
- Fim de fase: skill `checagem-completa`, `/code-review`, `/security-audit`, agentes `security-auditor` e `revisor-rbac`
- Investigações que leem muitos arquivos: delegar a subagente e trazer só o resumo.

Glossário: @docs/produto/glossario.md
