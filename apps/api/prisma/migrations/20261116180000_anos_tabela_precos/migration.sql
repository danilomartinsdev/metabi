-- Anos da tabela de preços: agora a lista é controlada pelo usuário (incluir / retirar ano).
-- CreateTable
CREATE TABLE "AnoTabelaPreco" (
    "ano" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnoTabelaPreco_pkey" PRIMARY KEY ("ano")
);

-- Começa com os anos que já aparecem hoje no seletor: os que têm preço ou notas fiscais.
INSERT INTO "AnoTabelaPreco" ("ano")
SELECT DISTINCT "ano" FROM "PrecoTabela"
UNION
SELECT DISTINCT "ano" FROM "NotaFiscalItem"
ON CONFLICT DO NOTHING;
