# Métricas e KPIs

Todas as métricas são calculadas no backend, **sempre dentro do escopo do usuário** e dos
filtros ativos, com `Decimal` (nunca float). Pedidos cujo status tem `contaNoTotal = false`
são excluídos de todas as métricas de venda **[PENDENTE: confirmar quais status]**.
Arredondamento só na apresentação (2 casas para BRL, 1 casa para %).

## Exemplo base
Pedidos fictícios usados em todos os exemplos:

| Pedido | Competência | Segmento | Valor |
|---|---|---|---|
| 1 | 2026-08 | Público | 10.000,00 |
| 2 | 2026-08 | Privado | 5.000,00 |
| 3 | 2026-08 | Público | 15.000,00 |
| 4 | 2026-07 | Privado | 20.000,00 |
| 5 | 2025-08 | Público | 12.000,00 |
| 6 | 2025-08 | Privado | 8.000,00 |

## Fórmulas
### Total vendido
`Σ valor`. Agosto/2026: 10.000 + 5.000 + 15.000 = **R$ 30.000,00**.

### Quantidade de pedidos
`contagem de pedidos`. Agosto/2026: **3**.

### Ticket médio
`total ÷ qtd`; se qtd = 0, "—". Agosto/2026: 30.000 ÷ 3 = **R$ 10.000,00**.

### % Público
`total Público ÷ total`; se total = 0, "—". Agosto/2026: 25.000 ÷ 30.000 = **83,3%**.
Segmento efetivo = override do cliente ?? padrão do representante; sem segmento = "Não definido"
(entra no total, não entra no numerador).

### Quais comparações aparecem nos cards (decidido em 2026-10-05)
Período de **vários meses** (ex.: acumulado do ano): só **vs. mesmo período do ano anterior**.
Período de **um mês**: vs. mês anterior **e** vs. mesmo mês do ano anterior.
O rótulo sempre diz o período comparado (ex.: "vs. jan–set/2025").

### Variação vs. mês anterior (MoM)
`(atual − anterior) ÷ anterior`; se anterior = 0, "—" (sem %).
Agosto/2026 vs. julho/2026: (30.000 − 20.000) ÷ 20.000 = **+50,0%**.

### Variação vs. mesmo mês do ano anterior (YoY)
Agosto/2026 vs. agosto/2025: (30.000 − 20.000) ÷ 20.000 = **+50,0%**.
Qtd: (3 − 2) ÷ 2 = **+50,0%**.

### Acumulado do ano (YTD) — só meses em comum
Comparar o ano atual com o anterior **apenas nos meses que existem nos dois** (até o último mês
com dados no ano atual, respeitando o filtro de período).
Ex.: dados de 2026 até agosto → YTD 2026 = jan–ago/2026; YTD 2025 = jan–ago/2025
(setembro–dezembro/2025 ficam de fora).
Com o exemplo base (só jul–ago existem): YTD 2026 = 20.000 + 30.000 = 50.000;
YTD 2025 = 0 (jul) + 20.000 (ago) = 20.000; variação = **+150,0%**.

### Comparativo com o ano anterior (card da Visão geral)
Período selecionado × **mesmo período do ano anterior** (ex.: janeiro a setembro de 2026 × janeiro a
setembro de 2025; só setembro/2026 × setembro/2025), por segmento e no total. Os dois períodos aparecem
escritos na tela. O total usa o faturamento manual (Histórico) nos meses sem pedidos; os segmentos, só pedidos.
Decidido com o usuário em 2026-10-05.

### Atingimento de meta
`total ÷ meta`; meta ausente ou 0 → "sem meta". Ex.: meta ago/2026 = 40.000 →
30.000 ÷ 40.000 = **75,0%**.

**Acumulado (rodapé da evolução mensal):** Σ real ÷ Σ meta somando só os meses de janeiro até o
mês final do período que têm meta (> 0). Ex.: meta só em ago = 40.000, real jul = 20.000 e
ago = 30.000 → 30.000 ÷ 40.000 = **75,0%** (julho, sem meta, fica de fora). Nenhuma meta no
intervalo → "sem meta".

### % de participação (rankings)
`valor do item ÷ total do conjunto filtrado`. Soma das participações = 100% (diferença de
arredondamento absorvida na exibição, não no cálculo). A linha de total mostra Σ valor, Σ qtd,
100%.

### Sparkline dos KPIs
Série dos últimos 12 meses até o mês final do filtro, mesma métrica e filtros (exceto período).

### Evolução mensal (Real × Ano anterior × Meta)
12 meses do ano selecionado; **ignora o filtro de mês** (usa só o ano). Meta = meta total, ou
soma das metas dos representantes quando filtrado por gestor **[PENDENTE: confirmar]**.

## Teste de aceite (Fase 3)
Cálculo manual de **agosto/2026** com a planilha real, documentado em teste
(`apps/api/src/modules/dashboard/__tests__/agosto-2026.spec.ts`) com os valores escritos à mão.

## Faturamento manual (tela Faturamento)

Em meses sem nenhum dia importado do relatório de faturamento, o valor digitado em
Administração › Histórico › Faturamento entra como Fatura DRE do mês (demais colunas = 0).
Havendo dias importados, vale só a importação. Testes em `apps/api/test/faturamento.spec.ts`.
