-- Produtos incluídos à mão na tabela de preços (os das notas fiscais continuam vindo de NotaFiscalItem).
-- CreateTable
CREATE TABLE "ProdutoCadastro" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdutoCadastro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoCadastro_codigo_unidade_key" ON "ProdutoCadastro"("codigo", "unidade");
