-- Divisão de venda do pedido (coluna "DIVISAO VENDA" do relatório Extrator PDV).
-- Pedidos importados antes da coluna existir ficam sem divisão até serem reimportados.
-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN "divisao" TEXT;

-- CreateIndex
CREATE INDEX "Pedido_divisao_idx" ON "Pedido"("divisao");
