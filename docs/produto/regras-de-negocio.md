# Regras de negócio

> Itens marcados **[PENDENTE]** não podem ser implementados como regra fixa; ver
> [../progresso.md](../progresso.md) › Decisões pendentes.

## Região (derivada da UF)
Constante em `packages/shared/src/constants/regioes.ts`.

| Região | UFs |
|---|---|
| Norte | AC, AM, AP, PA, RO, RR, TO |
| Nordeste | AL, BA, CE, MA, PB, PE, PI, RN, SE |
| Centro-Oeste | DF, GO, MS, MT |
| Sudeste | ES, MG, RJ, SP |
| Sul | PR, RS, SC |
| Exterior | EX (exportação) |

UF fora da lista → erro de validação na linha da importação.

## Representantes (= Gestores)
- Cadastro: `codigo` (como vem do Focco, ex.: `BL REPR`), `nomeExibicao` (ex.: `BL REPR (BRUNA)`),
  `segmentoPadrao` (ex.: MURILLO = Público), `ativo`.
- Representante novo encontrado na importação é criado com `nomeExibicao = codigo`,
  segmento **Privado** (decidido em 2026-10-05: só o MURILLO é Público, por ser licitação; outra exceção
  futura é ajustada em Administração › Representantes), e listado na prévia.
- Inativo continua aparecendo no histórico; só deixa de aparecer em listas de seleção.

## Segmento
- Valores: Público (licitações — hoje só o MURILLO) e Privado (demais representantes).
- Segmento efetivo de um pedido = `cliente.segmentoOverride` ?? `representante.segmentoPadrao`.
- Calculado na consulta (não gravado no pedido), para que mudanças de cadastro reflitam no histórico.

## Clientes
- Chave de agrupamento: nome normalizado = remover acentos → maiúsculas → trim → colapsar espaços.
  Ex.: `"  São  Camilo "` e `"SAO CAMILO"` → `SAO CAMILO`.
- Nome original preservado (o mais recente importado é exibido).
- Cliente novo = primeiro pedido no período analisado e nenhum pedido antes do período.
- Recorrência = número de meses distintos com pedido no período.

## Status PDV (POS PDV)
- Cadastro: `codigo` (A, PE, AC...), `descricao`, `contaNoTotal` (bool), `cor` (token).
- Significado de A/PE/AC e se PE conta no total vendido: **[PENDENTE]**.
- Código desconhecido na importação → criado com `contaNoTotal = true` e sinalizado na prévia **[PENDENTE: confirmar default]**.

## Metas
- Mensais (ano, mês), em valor (Decimal), no total da empresa e por representante.
- Meta total é cadastrada explicitamente (não é soma das metas por representante).
- Só papéis com `metas.edit` alteram; alterações auditadas.

## Análise de descontos e tabela de preços
- Tabela de preços **por ano**: produto (código agrupado da curva ABC, "MT169." = "MT169") + unidade → preço de tabela (Decimal(14,4)).
- Desconto = preço de tabela × quantidade vendida − valor vendido (ITNFS_VALOR_TOTAL dos itens de NF), num período de/até (padrão: do início do ano ao último mês com notas). Negativo = vendido acima da tabela.
- Período que cruza anos: cada mês usa a tabela do seu ano; o preço unitário só aparece quando o período está num ano só.
- Cada ano usa só a sua tabela: alterar os preços de um ano não muda os números de outro. Produto sem preço no ano fica fora do desconto; a "cobertura" mostra quanto do faturamento do ano tem preço.
- A tabela de preços (Administração › Tabela de preços) lista todo produto que já saiu em nota, de qualquer ano, mais os incluídos à mão (`ProdutoCadastro`, para produto ainda sem nota). Não dá para incluir à mão um produto que já está nas notas; excluir um incluído à mão apaga os preços dele em todos os anos.
- Ver a análise: `descontos.view` + escopo "todos"; tabela de preços: `precos.edit` + escopo "todos"; alterações auditadas (`precos.alterados`, `produto.incluido`, `produto.excluido`).
- Relatórios: PDF (indicadores + desconto por produto) e Excel/CSV (aba Produtos + aba Resumo).
- Anos da tabela (`AnoTabelaPreco`): o usuário inclui (vazio ou copiando os preços de outro ano, que depois ficam independentes) e retira (apaga os preços daquele ano; a análise deixa de calcular o desconto das vendas dele). Gravar preço num ano fora da lista inclui o ano. Auditado (`precos.ano-incluido`, `precos.ano-excluido`).

## Histórico 2025
- Vem do mesmo relatório Focco detalhado de 2025 → importação normal, mesmas regras.
- Comparativos "ano anterior" usam os pedidos importados do ano anterior.

## Datas e valores
- Competência = mês de DT EMIS no fuso America/Sao_Paulo.
- Valores em Decimal(14,2), arredondamento half-up a 2 casas na importação.

## Fórmulas
Ver [../dados/metricas-kpis.md](../dados/metricas-kpis.md).
