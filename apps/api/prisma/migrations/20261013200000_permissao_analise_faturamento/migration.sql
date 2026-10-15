-- "Ver análise de faturamento" (checkbox em Papéis), separada de "Ver faturamento". Para ninguém perder
-- acesso à tela que já usava, entra em todo papel que hoje tem faturamento.view (Admin incluído).
INSERT INTO "RolePermission" ("roleId", "permissao", "createdAt", "updatedAt")
SELECT rp."roleId", 'faturamento-analise.view', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "RolePermission" rp
WHERE rp."permissao" = 'faturamento.view'
ON CONFLICT ("roleId", "permissao") DO NOTHING;
