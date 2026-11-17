# Importação do relatório Focco3i

## Origem
Relatório **"DASHBOARD_Extrator PDV"** do Focco3i, exportado como `.xls`. Referência:
`fixtures/focco/ano-todo-ate-agora.xls` (real, **não versionado**) e amostras anonimizadas em
`fixtures/focco/amostras/` (versionadas, usadas nos testes e na CI).

## Detecção de formato
Nunca confiar na extensão. Ler os primeiros bytes:
| Assinatura | Formato | Leitura |
|---|---|---|
| `D0 CF 11 E0 A1 B1 1A E1` | XLS binário (BIFF/OLE) | SheetJS |
| `50 4B 03 04` (zip) com `[Content_Types].xml` | XLSX | SheetJS |
| começa com `<` / contém `<table` | HTML salvo como .xls | SheetJS (HTML) |
| texto com `;`, `\t` ou `,` | CSV/TSV | SheetJS com separador detectado |
| outro | — | rejeitar: "formato não reconhecido" |

Encoding de texto: tentar UTF-8; se houver bytes inválidos, Windows-1252.
SheetJS é instalado do CDN oficial (`https://cdn.sheetjs.com/`), não do npm.

## Localizar o cabeçalho
O relatório tem linhas de título antes da tabela. Percorrer as linhas até achar uma que contenha
(comparação normalizada: sem acento, maiúsculas, espaços colapsados) **todas** as colunas
obrigatórias abaixo. Linhas após o fim da tabela (totais, rodapé) são ignoradas: linha sem ID
numérico = fim/ignorar (contada como "ignorada", não "erro").

## Colunas
| Coluna | Campo | Exemplo | Regra |
|---|---|---|---|
| ID | `focoId` | 57537 | inteiro, obrigatório, **chave de upsert** |
| NUM PEDIDO | `numPedido` | 1128 | obrigatório, texto (preserva zeros) |
| ORDEM CPR | `ordemCpr` | 163625, 2026NE124, vazio | texto livre, opcional |
| DT EMIS | `dtEmissao` | 05/01/26 | dd/mm/aa → 2026-01-05, obrigatório; define a competência |
| DT ENTREGA | `dtEntrega` | 27/02/26 | dd/mm/aa, opcional |
| POS PDV | `statusCodigo` | A, PE, AC | obrigatório; status novo é criado e sinalizado |
| CLIENTE | `clienteNome` | IGESP SA ... | obrigatório; agrupado pelo nome normalizado |
| UF | `uf` | SP, EX | obrigatório; deve existir no mapa UF→região |
| REPRESENTANTE | `representanteCodigo` | PPX, BL REPR | obrigatório; representante novo é criado e sinalizado |
| VALOR | `valor` | 83575,74920002 | pt-BR → Decimal(14,2), half-up (conversão por string, sem float) |
| COD DIVD | — | 1 | ignorada (o nome da divisão já identifica) |
| DIVISAO VENDA | `divisao` | PRIVADO - MERCADO INTERNO PRIVADO | **opcional** (relatórios desde 13/11/2026); texto em maiúsculas, espaços colapsados; vazia → sem divisão. Relatório sem a coluna mantém a divisão já gravada. Alimenta a aba "Divisão" da Participação na Visão geral |
| G TOTAL GERAL | — | (vazia) | ignorada; no relatório real é uma coluna separada e vazia |

### Conversões
- Número pt-BR: remover `.` de milhar, trocar `,` por `.`, parsear como Decimal (nunca float),
  arredondar a 2 casas. `"83575,74920002"` → `83575.75`. `"1.234,5"` → `1234.50`.
  Se a célula vier numérica (xlsx), converter via string para Decimal.
- Data `dd/mm/aa`: ano `20aa`; data sem hora no fuso America/Sao_Paulo. Aceitar também
  `dd/mm/aaaa` e data serial do Excel. Data inválida (ex.: 31/02/26) = erro na linha.

## Fluxo (5 etapas)
1. **Upload** (arrastar e soltar). Limite `IMPORT_MAX_FILE_MB` (padrão 10 MB). Arquivo salvo em
   `UPLOAD_DIR` (fora do webroot) com nome = hash SHA-256; nome original fica no lote.
2. **Parse e validação** com schema Zod em `packages/shared/src/schemas/import.ts`.
3. **Prévia** (nada gravado ainda): novos, atualizados, inalterados, ignorados, erros por linha
   (nº da linha + coluna + motivo), representantes novos, clientes novos, status novos,
   intervalo de datas e total do arquivo.
4. **Confirmação** pelo usuário (`import.run`). Se houver erros, a importação só segue com as
   linhas válidas mediante confirmação explícita **[PENDENTE: ou bloquear tudo?]**.
5. **Gravação** em uma transação: upsert por `focoId`; cria representantes/clientes/status novos;
   registra o lote.

## Lotes e rollback
- `ImportLote`: usuário, data/hora, nome original, hash, tamanho, contagens (novos, atualizados,
  inalterados, ignorados, erros), status (`aplicado` | `revertido`).
- Para cada pedido tocado guarda-se `ImportLoteItem` com a ação (`criado`/`atualizado`) e o
  **snapshot anterior** (JSON) quando atualizado.
- **Rollback** (`import.rollback`): em transação, apaga pedidos criados pelo lote e restaura os
  snapshots dos atualizados. Só é permitido no lote mais recente que tocou cada pedido; se um lote
  posterior alterou os mesmos pedidos, o rollback é recusado com explicação.
- Reimportar o mesmo arquivo: tudo "inalterado", nenhum duplicado.
- Import e rollback são auditados.

## Segurança
- Validar conteúdo real (assinatura), não a extensão nem o MIME do navegador.
- Limitar linhas (ex.: 50.000) e tamanho; rejeitar fórmulas/macros (só valores são lidos).
- Nunca logar o conteúdo da planilha; logar só contagens e hash.

## Arquivo real analisado (2026-10-02)
HTML (Windows-1252) com título `DASHBOARD_Extrator PDV`, 11 colunas, 744 pedidos (05/01 a 30/09/2026), status A/PE/AC,
20 representantes, 27 UFs (inclui EX), 413 nomes de cliente → 408 após normalização. Importado sem erros.
Amostra anonimizada para testes: `node scripts/anonimizar-focco.mjs <real> fixtures/focco/amostras/amostra-anonimizada.xls 80`.
