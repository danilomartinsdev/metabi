# Progresso

**Fase atual:** 4b — Migração UI para Nuxt UI v4 (`fase-4b-ui`, ADR 0007)
**Concluídas:** 0 Contexto · 1 Fundação · 2 Dados · 3 Dashboards · 4 RBAC (`fase-4-rbac`)

### Fase 2 — Dados (feito)

Importador (HTML/xls/xlsx/csv) com prévia, lotes e rollback; cadastros de representantes, status PDV e clientes;
metas. Planilha real: 744 pedidos, 0 erros, reimportação sem duplicar. Amostra anonimizada em `fixtures/focco/amostras/`.

### Fase 3 — Dashboards (feito)

Visão geral, rankings (gestores/estados/regiões), clientes, pedidos paginados; filtros na URL.
Aceite: agosto/2026 = 65 pedidos, R$ 6.049.414,77, ticket R$ 93.067,92 — igual ao cálculo manual
(`apps/api/test/agosto-2026.spec.ts`). Testes de escopo provam que representante não vê dados de outros.
Comparações nos KPIs: período de vários meses mostra só "vs. mesmo período do ano anterior"; um mês mostra também o mês anterior (decisão de 2026-10-05).
Período e busca ficaram na barra de filtros de cada tela (não na topbar).

**Segmento configurado (2026-10-05):** MURILLO = Público (licitações); todos os demais representantes = Privado.

## Pendências

- [x] **Migração UI → Nuxt UI v4** (fase-4b-ui, ADR 0007): fases 0–8 feitas (tema, shell, primitivos/overlays/toasts, tabelas/paginação/selects, formulários de auth com UForm, telas de admin com UCheckbox/USwitch/URadioGroup, filtro por usuário e detalhe na auditoria, validação/alterações pendentes em metas; dashboards com atingimento acumulado da meta, comparativo acumulado em gráfico, sparkline de % Público, atalhos de período, aviso de busca ativa e top 3 destacado nos rankings — inspirados no dashboard HTML de referência); 8 (2026-10-06): removidos components/ui, components.json, shadcn-nuxt, reka-ui (direto), vue-sonner, tw-animate-css, cva/clsx/tailwind-merge e os pacotes lucide — ícones só via UIcon (i-lucide-*, bundle local). Exportação CSV da referência não entra: a spec prevê Excel (export.xlsx) em fase própria.
- [ ] Tela de override de segmento por cliente (Fase 4, ainda não feita).
- [ ] **Exportação** Excel (pedidos, rankings, clientes) e PDF executivo (ADR 0004): funcionando (menu "Exportar" nas análises) e **PDF de faturamento** (botão "Exportar PDF" na tela de Faturamento: período, tabela do ano e comparativo com meses/indicador da tela; exige faturamento.view + escopo "todos") e **PDF da Análise de faturamento** (2026-10-15; `/export/pdf/analise-faturamento` → `/print/analise-faturamento`: indicadores, rosca e divisões, ranking de representantes e curvas ABC com resumo por classe + 30 maiores clientes/produtos; exige faturamento-analise.view + escopo "todos"). Token de impressão no banco (`TokenImpressao`), de uso único e preso ao tipo de relatório; testes de token, 401/403 e parâmetros. Falta: atualizar docs/arquitetura/api.md; revisor-rbac.
- [ ] **Histórico manual** de faturamento mensal: tela Administração › Histórico e cálculo prontos (total vendido, evolução, atingimento, acumulado e PDF). Falta: testes (unitário do total com manual + integração 403/escopo) e docs/dados/metricas-kpis.md.
- [x] **Mapas do Brasil** (malhas IBGE de regiões e UFs em public/geo): aba "Mapa" na Visão geral; mapa centralizado nos rankings de regiões e de estados; clique filtra.
- [x] **Análise de faturamento** (2026-10-13, `fase-5g-analise-faturamento`): Análise › Análise de faturamento (`/faturamento/analise`) com pizza por divisão de venda, ranking por representante e curvas ABC por cliente e por produto, a partir do relatório de itens de NF do Focco (botão "Importar notas"). Testes de integração (importação, ABC, 403/escopo). Conferido com a planilha real no dev: total R$ 55.880.900,12, divisões iguais ao gráfico do Focco. Regras confirmadas pelo usuário em 2026-10-14 (ver Decisões tomadas). Validada pelo usuário na homologação e em produção desde 2026-10-19 (`8d61172`).

- [x] **Fonte e cores do sistema** (2026-10-15, `fase-5g-analise-faturamento`): barra flutuante (? Novidades | A− A+ | menu Tema com 7 opções cor + claro/escuro) e 6 temas de cores (tokens em `[data-tema]`, claro e escuro), salvos por navegador.
- [x] **Rosca de participação e menu lateral** (2026-10-19, em produção `8d61172`): na Visão geral a rosca "Participação" troca a legenda paginada do ECharts por uma lista (cor, nome, valor e %), como na rosca de divisões; o PDF não muda. Menu lateral mais leve (rolagem discreta, itens mais baixos, marcador fino no item ativo) e grupo Administração recolhível (fechado por padrão, lembrado por navegador, aberto quando a tela atual está nele); no menu, "Cadastro de representantes" → "Representantes" e "Segmento por cliente" → "Segmentos".
- [ ] **Usuário no rodapé do menu e aparência centralizada** (2026-10-19, `fase-5g-analise-faturamento`): nome/papel, Trocar senha e Sair no rodapé do menu lateral (topo só com o título); tema claro/escuro e cores, tamanho da letra, cores dos gráficos e Novidades só na barra flutuante (saíram o botão de sol do topo e os itens duplicados do menu do usuário). E2E de login/RBAC ajustados ao grupo Administração recolhido. Falta: homologação e produção.

- [ ] **Sair do ngrok para a Vercel** (2026-10-19; ADR 0008, docs/operacao/deploy-vercel.md, plano Hobby): no ar em https://metahospitalar-bi.vercel.app (site, projeto `metahospitalar-bi`, `apps/web`) e https://metahospitalar-api.vercel.app (API, projeto `metabi-api`, `apps/api`, com o Neon). Correções para funcionar: site instala só `web...`; função da API virou `api/index.js` com rewrite de todo `/api/*`. Base da produção copiada com `pnpm vercel:copiar-prod` (796 pedidos, 17 usuários; login e Visão geral conferidos). `pnpm vercel:definir-senha` define senha no Neon. Falta: usuário testar (PDF incluso), copiar de novo na virada, desligar o ngrok e parar a stack Docker.
- [ ] **Planilha real** em `fixtures/focco/ano-todo-ate-agora.xls` (gitignored) — necessária para validar o importador.
- [ ] Gerar amostra anonimizada em `fixtures/focco/amostras/` a partir da planilha real.
- [ ] Rodar `/memory` e confirmar a hierarquia de contexto (comando interativo, usuário).
- [ ] Default branch do GitHub ainda é `fase-0-contexto` (trocar para `main` em Settings ou autenticar o `gh`).
- [ ] Subir a stack de produção (`docker-compose.prod.yml`) de ponta a ponta — imagens já compilam (Fase 6).
- [ ] Primeira execução da CI no GitHub.
- [x] **Ambiente de homologação** (2026-10-07): stack `meta-bi-homolog` isolada da produção, em http://localhost:4337 (Mailpit em :4339), faixa "Homologação", cópia da produção via `pnpm homolog:copiar-prod` (banco e, desde 2026-10-19, as planilhas importadas do volume `storage`) — ver docs/operacao/homologacao.md. Fluxo: validar na homologação, depois produção.

## Decisões tomadas

- **Análise de faturamento por notas fiscais (proposta de 2026-10-13, confirmada pelo usuário em 2026-10-14):**
  - Valor = ITNFS_VALOR_TOTAL de **todos** os itens (Venda e Faturamento Antecipado): é o que bate com o gráfico "Faturamento por Divisão de Venda no Ano" do Focco.
  - Curva ABC: classe pelo acumulado **antes** do item (A até 80%, B até 95%, C o restante).
  - "Juntar os produtos": o mesmo código sem o ponto final ("MT169." e "MT169") vira uma linha; códigos diferentes não são juntados.
  - Curva ABC por quantidade: uma curva por unidade de medida (UN, KG, PC, M2), padrão UN; unidades diferentes não se somam (a planilha tem sucata em KG, 63.360, que distorceria o ranking).
  - Clique numa divisão da pizza: ranking dos representantes daquela divisão, % sobre o total da divisão.
  - Acesso: permissão própria "Ver análise de faturamento" (faturamento-analise.view, checkbox em Papéis; pedido do usuário em 2026-10-13) + escopo "todos". Na migração entrou em todo papel que já tinha faturamento.view. Importar notas continua em faturamento.import.

- **Minhas vendas (2026-10-07):** aparece só para representante, por checkbox em Papéis (`minhas-vendas.view`, marcada só no papel Representante; o Admin não recebe). Montada sobre a versão da produção (`062dfff`); o cadastro de usuário continua como na produção (escopo "Por representante" define quais vendas ele vê). A simplificação "papel decide as vendas" ficou guardada em stash, não aplicada.

- **Reimportação de faturamento (2026-10-06):** a prévia lista os meses da planilha, com o que já existe no sistema em cada um, e o usuário **escolhe quais importar** (todos marcados por padrão). Cada mês escolhido é substituído por completo; os demais não mudam (antes: o ano inteiro era substituído). Importar outubro não apaga jan–set; reimportar outubro atualizado troca outubro inteiro, sem duplicar.

- **Histórico manual para comparativo (2026-10-05):** o usuário cadastra o **faturamento total da empresa por mês** de anos anteriores. O valor manual só vale em meses **sem nenhum pedido importado** (pedidos importados têm prioridade). Consequência (segurança/coerência): como é um total da empresa, só entra nos números para quem tem escopo "todos" e sem filtros de região/UF/representante/segmento/status/busca — mesmo critério das metas. Tela: Administração › Histórico (permissão metas.edit).
- **Histórico com abas Pedidos e Faturamento (2026-10-08):** Administração › Histórico tem duas abas. "Pedidos" é a grade acima (total vendido). "Faturamento" é a mesma grade, para o faturamento da empresa por mês (tabela `FaturamentoManual`, permissão faturamento.import + escopo "todos"): entra como **Fatura DRE** na tela Faturamento (cards, evolução, tabela do ano, comparativo, anos, PDF) só em meses **sem** faturamento importado do Focco; bruto/antecipado/remessa/devolução ficam zerados nesses meses. Tela de Pedidos ganhou o card "Valor total do filtro" (soma no escopo do usuário, `meta.valorTotal`).
- **Usuários online na Auditoria (2026-10-08):** aba "Online" (permissão audit.view) com a contagem e a lista (nome, papel, último sinal, navegador, IP). Online = usuário ativo, com sessão válida, que deu sinal nos últimos **5 minutos**; a tela manda sinal a cada minuto enquanto a aba do navegador está visível (`POST /auth/presenca`) e o guard grava a presença (tabela `Presenca`, no máximo 1 gravação/min por usuário). Logout tira da lista na hora.

- **Segmento por representante (2026-10-05):** pedidos do MURILLO são licitações (Público); os demais representantes são Privado. Aplicado nos 20 representantes atuais via Administração › Representantes (auditado). Representante novo vindo da importação entra como Privado.

## Decisões pendentes

Não implementar nada que dependa destes itens sem resposta do usuário.

1. **Status PDV (A, PE, AC):** significado de cada código e se pedidos **PE** contam no total vendido. Até a resposta, o cadastro de status terá a flag `contaNoTotal` configurável e os KPIs a respeitam.
2. **SMTP:** servidor e remetente para "esqueci minha senha".
3. **Escopo "por região":** um usuário com escopo de região vê todos os pedidos cuja UF pertence à região, independentemente do representante? (assumido sim, a confirmar)
4. **Visualizador × exportação:** padrão do papel Visualizador é sem exportação? (a permissão é configurável; falta o default)
5. **Metas por representante:** por valor apenas, ou também por quantidade de pedidos?
6. **Timeout de inatividade:** valor (sugestão: 30 min) e duração do refresh (sugestão: 7 dias); duração do bloqueio após 5 falhas (sugestão: 15 min).
7. **Propostas escritas nos docs na Fase 0, a confirmar:**
   - Cliente novo = 1º pedido dentro do período e nenhum antes; recorrência = nº de meses distintos com pedido.
   - Meta total cadastrada explicitamente (não é a soma das metas por representante); com filtro de gestor, a evolução usa a soma das metas dos gestores filtrados.
   - Importação com linhas inválidas: segue só com as válidas após confirmação explícita (alternativa: bloquear tudo).
   - Rollback só do lote mais recente que tocou cada pedido.
   - Status/representante desconhecidos na importação são criados automaticamente e sinalizados na prévia.
   - Matriz de papéis padrão em docs/arquitetura/seguranca-rbac.md (rollback para Gestor comercial, cadastros só Admin).

## Decisões tomadas

| Data       | Decisão                                                                                                                                                                                         | Onde                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 2026-10-02 | Gestor = Representante (mesma entidade; "Gestor" é o rótulo de UI)                                                                                                                              | glossario.md         |
| 2026-10-02 | Histórico 2025 vem do mesmo relatório Focco detalhado (importação normal)                                                                                                                       | regras-de-negocio.md |
| 2026-10-02 | Planilha real fica fora do git; só amostra anonimizada é versionada                                                                                                                             | importacao-focco.md  |
| 2026-10-02 | Agentes/skills do claude-code-templates instalados no `.claude/` do projeto                                                                                                                     | CLAUDE.md            |
| 2026-10-02 | Hooks do Claude Code em Node (.mjs), exec form                                                                                                                                                  | ADR 0005             |
| 2026-10-02 | Postgres sobe já na Fase 0 via `pnpm db:up` (pedido do usuário)                                                                                                                                 | docker-compose.yml   |
| 2026-10-02 | Projeto só JS/TS: scripts Python das skills removidos                                                                                                                                           | CLAUDE.md            |
| 2026-10-02 | Removidos por não se encaixarem: agentes data-scientist e context-manager; skills senior-frontend, senior-architect, senior-backend. `/security-audit` reescrito (lia `.env*` e usava npm/bash) | .claude/             |

## Feito

### Fase 4 — RBAC (feito)

Usuários, papéis com permissões editáveis, escopo (todos/região/representantes), auditoria.
Telas: Administração › Usuários, Papéis, Auditoria. Fix da revisão de autorização aplicado
(`380ea16`); revisor-rbac e /code-review aprovados.

### Fase 1 — Fundação

- Monorepo pnpm (shared/api/web), TS estrito, ESLint/Prettier, pre-commit anti-segredos.
- API NestJS 12 + Prisma 7: schema completo, auth (argon2id, bloqueio, refresh rotativo com detecção de reuso,
  inatividade, troca obrigatória, esqueci/redefinir senha via Mailpit), guard seguro por padrão, auditoria.
- Web Nuxt 4 SPA: tokens light/dark, layout com sidebar, telas de autenticação, dashboard provisório.
- Testes: 8 shared + 6 web + 23 integração API (Postgres real) + 11 E2E (desktop e celular).
- Docker de produção (API, Caddy com SPA e CSP) e CI no GitHub Actions. Ajustes de versão: ADR 0006.

**Como testar:** `pnpm db:up` · `pnpm dev` → http://localhost:4317 · `pnpm test` · `pnpm test:e2e`.

### Fase 0 — Contexto

- CLAUDE.md raiz e por pacote, REVIEW.md, README.md, .gitignore, .env.example, pnpm-workspace.yaml.
- `.claude/`: settings.json (permissões + hooks), 8 rules, 3 skills do projeto, agente `revisor-rbac`,
  hooks Node (`protect-paths`, `format`, `session-context`) com testes.
- Instalados do claude-code-templates: agentes context-manager, vue-expert, fullstack-developer,
  data-analyst, data-scientist, test-engineer, security-auditor; skills senior-architect,
  senior-frontend, senior-backend, frontend-design, ui-ux-pro-max; comando /security-audit.
  `code-review` usa o comando nativo do Claude Code.
- docs/ completo (produto, dados, arquitetura, ADRs 0001–0005, design, operação em esqueleto).
- Logos baixados em `apps/web/public/brand/`.
- docker-compose.yml com Postgres 16 (127.0.0.1:5517, volume `meta-bi_pgdata`).

**Como testar**

- `pnpm hooks:test` — testes dos hooks.
- Pedir ao Claude para escrever em `.env` → deve ser bloqueado pelo hook.
- `pnpm db:up` → container `meta-bi-postgres` healthy; `pnpm db:down` para parar.
- `/memory` → CLAUDE.md raiz, glossário importado, rules `seguranca` e `git` sempre carregadas.

**Observações**

- `pnpm lint`/`typecheck`/`test` ainda não existem: não há código de aplicação (Fase 1).
- Git Bash desta máquina falha ao iniciar; por isso hooks em Node e comandos via PowerShell.
