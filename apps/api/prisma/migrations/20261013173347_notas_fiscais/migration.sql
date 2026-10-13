-- CreateTable
CREATE TABLE "NotaFiscalItem" (
    "id" UUID NOT NULL,
    "itemId" INTEGER NOT NULL,
    "notaId" INTEGER NOT NULL,
    "numNota" TEXT NOT NULL,
    "dataEmissao" DATE NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "tipoNota" TEXT NOT NULL,
    "divisao" TEXT NOT NULL,
    "repCodigo" TEXT NOT NULL,
    "repNome" TEXT NOT NULL,
    "cliCodigo" TEXT NOT NULL,
    "cliRazaoSocial" TEXT NOT NULL,
    "cliNomeFantasia" TEXT,
    "cliCidade" TEXT,
    "cliUf" CHAR(2) NOT NULL,
    "produtoCodigo" TEXT NOT NULL,
    "produtoAgrupado" TEXT NOT NULL,
    "produtoDescricao" TEXT NOT NULL,
    "quantidade" DECIMAL(14,2) NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "loteId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaFiscalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscalLote" (
    "id" UUID NOT NULL,
    "arquivoNome" TEXT NOT NULL,
    "arquivoHash" TEXT NOT NULL,
    "itens" INTEGER NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "meses" TEXT[],
    "usuarioId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaFiscalLote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscalItem_itemId_key" ON "NotaFiscalItem"("itemId");

-- CreateIndex
CREATE INDEX "NotaFiscalItem_dataEmissao_idx" ON "NotaFiscalItem"("dataEmissao");

-- CreateIndex
CREATE INDEX "NotaFiscalItem_ano_mes_idx" ON "NotaFiscalItem"("ano", "mes");

-- CreateIndex
CREATE INDEX "NotaFiscalItem_cliCodigo_idx" ON "NotaFiscalItem"("cliCodigo");

-- CreateIndex
CREATE INDEX "NotaFiscalItem_repCodigo_idx" ON "NotaFiscalItem"("repCodigo");

-- CreateIndex
CREATE INDEX "NotaFiscalItem_produtoAgrupado_idx" ON "NotaFiscalItem"("produtoAgrupado");

-- CreateIndex
CREATE INDEX "NotaFiscalItem_loteId_idx" ON "NotaFiscalItem"("loteId");

-- CreateIndex
CREATE INDEX "NotaFiscalLote_createdAt_idx" ON "NotaFiscalLote"("createdAt");

-- AddForeignKey
ALTER TABLE "NotaFiscalItem" ADD CONSTRAINT "NotaFiscalItem_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "NotaFiscalLote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscalLote" ADD CONSTRAINT "NotaFiscalLote_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
