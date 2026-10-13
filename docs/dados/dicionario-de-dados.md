# Dicionário de dados

> Modelo **previsto** (Fase 0). A fonte de verdade passa a ser `apps/api/prisma/schema.prisma`
> a partir da Fase 1; mantenha este documento sincronizado.
> Convenções: PK `id` (cuid/uuid ou int), `createdAt`/`updatedAt` em toda tabela,
> dinheiro `Decimal(14,2)`, datas sem hora como `@db.Date`.

## Vendas

### Pedido

| Coluna          | Tipo                 | Origem                | Observação                      |
| --------------- | -------------------- | --------------------- | ------------------------------- |
| id              | uuid                 | —                     | PK                              |
| focoId          | int, único           | ID                    | chave de upsert                 |
| numPedido       | text                 | NUM PEDIDO            |                                 |
| ordemCpr        | text?                | ORDEM CPR             |                                 |
| dtEmissao       | date                 | DT EMIS               | índice                          |
| dtEntrega       | date?                | DT ENTREGA            |                                 |
| competencia     | date (1º dia do mês) | derivada de dtEmissao | índice                          |
| statusId        | FK StatusPdv         | POS PDV               | índice                          |
| clienteId       | FK Cliente           | CLIENTE               | índice                          |
| representanteId | FK Representante     | REPRESENTANTE         | índice                          |
| uf              | char(2)              | UF                    | índice                          |
| regiao          | enum                 | derivada da UF        | índice                          |
| valor           | Decimal(14,2)        | VALOR G TOTAL GERAL   |                                 |
| ultimoLoteId    | FK ImportLote        | —                     | último lote que gravou o pedido |

### Cliente

| Coluna           | Tipo           | Observação                     |
| ---------------- | -------------- | ------------------------------ |
| id               | uuid           |                                |
| nomeNormalizado  | text, único    | chave de agrupamento           |
| nomeOriginal     | text           | último nome visto              |
| segmentoOverride | enum Segmento? | sobrescreve o do representante |

### Representante

| Coluna         | Tipo           | Observação             |
| -------------- | -------------- | ---------------------- |
| id             | uuid           |                        |
| codigo         | text, único    | como vem do Focco      |
| nomeExibicao   | text           | ex.: "BL REPR (BRUNA)" |
| segmentoPadrao | enum Segmento? |                        |
| ativo          | bool           |                        |

### StatusPdv

`id`, `codigo` (único), `descricao`, `contaNoTotal` (bool), `cor` (nome de token).

### Meta

`id`, `ano`, `mes`, `representanteId?` (null = meta total), `valor` Decimal(14,2).
Único em (`ano`, `mes`, `representanteId`).

### FaturamentoHistorico

`id`, `ano`, `mes`, `valor` Decimal(14,2) — faturamento total da empresa digitado à mão (Administração ›
Histórico). Único em (`ano`, `mes`). Só entra nos números em meses **sem pedidos importados**, para escopo
"todos" e sem filtros (ver docs/progresso.md › Decisões tomadas).

## Faturamento (relatório diário do Focco — separado dos pedidos)

### FaturamentoDia

`id`, `empresa`, `data` (Date, **única**), `ano`, `mes`, `semana`, `bruto`, `antecipado`, `remessa`,
`devolucao`, `dre` (todos Decimal(14,2); `dre` = bruto + antecipado + remessa + devolucao), `loteId`.
Na importação, a prévia lista os meses da planilha (com o que já está gravado em cada um) e o usuário escolhe quais importar: cada mês escolhido é **substituído por completo** pelos dias do arquivo; os demais meses ficam intactos. Índice (`ano`, `mes`).

### FaturamentoLote

`id`, `ano`, `arquivoNome`, `arquivoHash`, `dias`, `totalDre` Decimal(14,2), `usuarioId?` — histórico das
importações de faturamento.

## Notas fiscais (itens de NF do Focco — Análise de faturamento)

### NotaFiscalItem

Uma linha por item de nota (relatório "Intermediador de fontes de dados de widgets"): `itemId` (ITNFS_ID, **único**),
`notaId` (NFS_ID), `numNota`, `dataEmissao` (Date), `ano`, `mes`, `tipoNota` (Venda, Faturamento Antecipado…),
`divisao` (DIVD_DESCRICAO), `repCodigo`/`repNome` (REP_*; não ligados ao cadastro de representantes dos pedidos),
`cliCodigo`, `cliRazaoSocial`, `cliNomeFantasia?`, `cliCidade?`, `cliUf`, `produtoCodigo` (como veio), `produtoAgrupado`
(sem o ponto final das variantes: "MT169." → "MT169"; chave da curva ABC), `produtoDescricao`, `unidade?` (ITNFS_UNID_MED_CODIGO: UN, KG, PC, M2…; quantidades só se somam na mesma unidade), `quantidade` e
`valorTotal` (ITNFS_VALOR_TOTAL) Decimal(14,2), `loteId`. Reimportar substitui por completo os meses de emissão do
arquivo. Índices: `dataEmissao`, (`ano`, `mes`), `cliCodigo`, `repCodigo`, `produtoAgrupado`, `loteId`.

### NotaFiscalLote

`id`, `arquivoNome`, `arquivoHash`, `itens`, `total` Decimal(14,2), `meses` ("AAAA-MM"[]), `usuarioId?`.

## Importação

### ImportLote

`id`, `usuarioId`, `arquivoNome`, `arquivoHash`, `arquivoTamanho`, `arquivoPath`,
`novos`, `atualizados`, `inalterados`, `ignorados`, `erros`, `status` (aplicado|revertido),
`revertidoEm?`, `revertidoPorId?`.

### ImportLoteItem

`id`, `loteId`, `pedidoId`/`focoId`, `acao` (criado|atualizado), `snapshotAnterior` (JSON?).

## Acesso

### Usuario

`id`, `email` (único, minúsculo), `nome`, `senhaHash` (argon2id), `roleId`, `ativo`,
`trocarSenha` (bool), `tentativasFalhas`, `bloqueadoAte?`, `ultimoAcessoEm?`,
`escopoTipo` (todos|regiao|representantes), `escopoRegioes` (enum[]).

- `paletaGraficos?` (String): paleta de cores dos gráficos escolhida pelo próprio usuário (null = padrão;
  valores em `PALETAS_GRAFICO`, packages/shared).

### UsuarioRepresentante

Vínculo N:N usuário ↔ representante (escopo "representantes").

### Role / Permission / RolePermission

Papéis editáveis; permissões fixas (lista em `packages/shared/src/constants/permissions.ts`).

### Sessao (refresh tokens)

`id`, `usuarioId`, `tokenHash`, `familia` (detecção de reuso), `expiraEm`, `ultimoUsoEm`,
`revogadaEm?`, `ip`, `userAgent`.

### TokenRedefinicaoSenha / TokenImpressao

`id`, `usuarioId`, `tokenHash`, `expiraEm`, `usadoEm?` (+ `filtros` JSON no de impressão).
O de impressão vale 60 s e uma vez só (consumido de forma atômica por `usadoEm`); só o hash sha256 é gravado.

### ArquivoTemporario

`id`, `hash`, `usuarioId`, `tipo` (pedidos | faturamento), `arquivoNome`, `conteudo` (Bytes), `expiraEm` (2 h).
Arquivo da prévia de importação guardado até o "confirmar" (substitui o disco local — necessário em serverless).
Único em (`hash`, `usuarioId`, `tipo`): a prévia pertence a quem enviou.

### AuditLog

`id`, `usuarioId?`, `acao`, `entidade?`, `entidadeId?`, `detalhes` (JSON, sem segredos),
`ip`, `userAgent`, `createdAt`. Índice em (`createdAt`, `acao`, `usuarioId`).
