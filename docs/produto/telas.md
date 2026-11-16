# Telas

Layout `default`: sidebar recolhível (primary-strong, logo branco) + topbar (período, busca global,
tema, menu do usuário). Layout `auth` para login. Layout `print` para PDF. Todas responsivas.

## Autenticação (layout auth)
| Rota | Objetivo | Componentes | Permissão |
|---|---|---|---|
| /login | Entrar | e-mail, senha, "esqueci minha senha" | pública |
| /esqueci-senha | Pedir link de redefinição | e-mail; resposta neutra (não revela se existe) | pública |
| /redefinir-senha?token= | Definir nova senha | senha + confirmação, regras de força | token válido |
| /trocar-senha | Troca obrigatória no 1º acesso | senha atual, nova, confirmação | autenticado |

## Dashboards (layout default)
Filtros globais na URL (store `filters`): período (mês, intervalo, ano), região, UF, gestor,
segmento, status, busca (cliente, nº pedido, CPR, gestor).

| Rota | Objetivo | Componentes | Permissão |
|---|---|---|---|
| /minhas-vendas | Minhas vendas (checkbox "Ver Minhas vendas" em Papéis; padrão só Representante; página inicial de quem tem) | KPIs total/pedidos/ticket; meta do mês e acumulada; evolução mensal; top 10 clientes; vendas por estado; pedidos recentes. Filtro só de período; dados no escopo do usuário | minhas-vendas.view |
| /dashboard | Visão Geral | KPIs com variação + sparkline; chips (estados, regiões, gestores, clientes); evolução mensal Real × Ano anterior × Meta (meses do período); donut Região ⇄ Público×Privado; Top 10 gestores; acumulado por segmento | dashboard.view |
| /dashboard/gestores | Ranking de gestores | gráfico + tabela ordenável, % participação, linha de total | dashboard.view |
| /dashboard/estados | Ranking por UF | idem | dashboard.view |
| /dashboard/regioes | Ranking por região | idem | dashboard.view |
| /dashboard/clientes | Clientes | ranking, recorrência, clientes novos | dashboard.view |
| /pedidos | Lista de pedidos | tabela paginada no servidor, colunas configuráveis, badge de status | pedidos.view |
| /faturamento/descontos | Análise de descontos (itens de NF × tabela de preços) | período de/até (atalhos Último mês e Acumulado do ano); KPIs valor de tabela, vendido com preço, desconto e cobertura; desconto por produto (busca, com/sem preço, total); Exportar em PDF, Excel e CSV; atalho para a Tabela de preços | descontos.view e escopo "todos" (exportar: export.pdf/export.xlsx) |

Toda tabela tem botão "Exportar Excel" (export.xlsx); dashboards têm "Exportar PDF" (export.pdf).

## Administração (layout default)
| Rota | Objetivo | Permissão |
|---|---|---|
| /admin/importacoes | Upload (arrastar e soltar), prévia, confirmação, histórico de lotes, rollback | import.run / import.rollback |
| /admin/metas | Metas mensais total e por representante | metas.edit |
| /admin/precos | Tabela de preços por ano: produtos das notas (qualquer ano) + incluídos à mão; preço editável, preço do ano anterior, última venda, busca e filtros, "preencher vazios com o ano anterior", incluir/excluir produto à mão; incluir ano (vazio ou copiando outro ano) e retirar ano | precos.edit e escopo "todos" |
| /admin/representantes | Cadastro (nome de exibição, segmento, ativo) | cadastros.edit |
| /admin/clientes | Override de segmento por cliente | cadastros.edit |
| /admin/status-pdv | Significado dos status e se contam no total | cadastros.edit |
| /admin/usuarios | Usuários, papel, escopo, vínculos, desativar, derrubar sessões | users.manage |
| /admin/papeis | Papéis e permissões editáveis | users.manage |
| /admin/auditoria | Log de auditoria filtrável | audit.view |

## Impressão (layout print)
| Rota | Objetivo | Acesso |
|---|---|---|
| /print/relatorio | Relatório executivo A4 para o Playwright | token de uso único |

Sem sidebar nem interação; inclui logo, filtros aplicados, KPIs, gráficos, rankings, rodapé
com usuário, data/hora e paginação.

## Estados obrigatórios
Todo bloco de dados: skeleton (loading), vazio com mensagem útil, erro com "tentar de novo".
Itens sem permissão não aparecem (useCan), e a rota redireciona para 403.
