-- CreateTable
CREATE TABLE "PrecoTabela" (
    "id" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "produtoCodigo" TEXT NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT '',
    "preco" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecoTabela_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrecoTabela_ano_idx" ON "PrecoTabela"("ano");

-- CreateIndex
CREATE UNIQUE INDEX "PrecoTabela_ano_produtoCodigo_unidade_key" ON "PrecoTabela"("ano", "produtoCodigo", "unidade");

-- "Ver previsão de descontos": entra em todo papel que já vê a Análise de faturamento (mesma origem dos dados).
INSERT INTO "RolePermission" ("roleId", "permissao", "createdAt", "updatedAt")
SELECT rp."roleId", 'descontos.view', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "RolePermission" rp
WHERE rp."permissao" = 'faturamento-analise.view'
ON CONFLICT ("roleId", "permissao") DO NOTHING;

-- "Editar tabela de preços": só o Admin (que tem sempre todas as permissões); outros papéis por checkbox.
INSERT INTO "RolePermission" ("roleId", "permissao", "createdAt", "updatedAt")
SELECT r."id", p.permissao, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" r CROSS JOIN (VALUES ('descontos.view'), ('precos.edit')) AS p(permissao)
WHERE r."chave" = 'admin'
ON CONFLICT ("roleId", "permissao") DO NOTHING;
