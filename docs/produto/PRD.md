# PRD — MetaBI (Meta Hospitalar)

## Visão
A Meta Hospitalar (fabricante de equipamentos hospitalares, Aparecida de Goiânia/GO) acompanha
vendas por um protótipo HTML alimentado manualmente pelo relatório "DASHBOARD_Extrator PDV" do
Focco3i. Queremos uma aplicação real: login, banco de dados, importação/exportação de planilhas,
dashboards confiáveis e controle de acesso por papel e escopo de dados.

## Usuários
| Persona | Papel | Necessidade principal |
|---|---|---|
| Diretoria | Visualizador / Admin | Visão executiva no celular; PDF para reuniões |
| Gestão comercial | Gestor comercial | Importar relatório, acompanhar metas, rankings, exportar |
| Representante | Representante | Ver e exportar só os próprios pedidos e desempenho |
| TI/Administração | Admin | Usuários, papéis, auditoria, cadastros |

## Escopo (v1)
- Autenticação completa (login, esqueci a senha, troca obrigatória, bloqueio, inatividade).
- RBAC com permissões granulares e escopo de dados; papéis editáveis.
- Importação do relatório Focco com prévia, lotes e rollback; histórico 2025 pelo mesmo relatório.
- Dashboards: Visão Geral, Rankings (gestores, estados, regiões), Clientes, Pedidos; filtros na URL.
- Exportação Excel e PDF executivo, respeitando filtros e escopo, auditada.
- Administração: usuários, papéis, representantes, status PDV, metas, importações, auditoria.
- Responsivo (celular), pt-BR, light/dark, acessibilidade AA.

## Fora de escopo (v1)
- Redis, filas, microsserviços (volume ≈ 1.000 pedidos/ano).
- Integração direta com o banco do Focco (só via relatório exportado).
- App mobile nativo; multi-empresa; previsão de vendas.

## Métricas de sucesso
- KPIs batem com o cálculo manual (teste de agosto/2026).
- Importação mensal em menos de 2 minutos, sem duplicar.
- Nenhum vazamento de escopo (testes E2E por papel).

## Fases
Ver tabela em [../progresso.md](../progresso.md) e critérios de pronto:
0 Contexto · 1 Fundação · 2 Dados · 3 Dashboards · 4 RBAC · 5 Exportação · 6 Endurecimento.

| Fase | Critério de pronto |
|---|---|
| 0 | `/memory` com hierarquia correta; hooks testados; commit `chore: estrutura de contexto` |
| 1 | Login/logout/refresh com testes; CI verde |
| 2 | Planilha real importada sem erros; reimportar não duplica; rollback restaura |
| 3 | KPIs batem com cálculo manual de agosto/2026 documentado em teste |
| 4 | `revisor-rbac` sem achados críticos; E2E por papel |
| 5 | Exports respeitam filtros e escopo; PDF idêntico à tela |
| 6 | Restore de backup testado; checklist de deploy executado |
