# Glossário

- **Focco3i** — ERP da Metahospitalar; origem dos pedidos.
- **PDV** — Pedido de Venda no Focco. "Extrator PDV" é o relatório exportado.
- **POS PDV** — posição/status do pedido (A, PE, AC); significado configurável (pendente).
- **CPR / Ordem CPR** — ordem de compra do cliente; texto livre (ex.: `163625`, `2026NE124`).
- **NE** — Nota de Empenho (órgão público); aparece dentro da Ordem CPR.
- **Representante (= "gestor" no código)** — o código da coluna REPRESENTANTE (PPX, MURILLO, BL REPR). Na UI chama-se "Representante"; no código/API o nome interno continua `gestor` (ex.: filtro `?gestor=`, ranking `gestores`).
- **Segmento** — Público ou Privado; padrão vem do representante, pode ser sobrescrito por cliente.
- **Região** — derivada da UF; `EX` (exportação) → região "Exterior".
- **Competência** — mês/ano da data de emissão (DT EMIS).
- **Lote de importação** — uma execução do importador; pode ser desfeita (rollback).
- **Escopo** — conjunto de pedidos que um usuário pode ver: todos, por região ou por representantes vinculados.
- **Ticket médio** — total vendido ÷ quantidade de pedidos.
- **YTD / Acumulado** — soma do ano até o último mês com dados, comparada só nos meses em comum.
