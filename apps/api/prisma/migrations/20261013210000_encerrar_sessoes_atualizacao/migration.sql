-- Atualização de 2026-10-13 (Análise de faturamento + permissão própria): todos entram de novo, para carregar
-- as permissões novas e ver as Novidades. O guard recusa sessão revogada na próxima requisição, e o refresh
-- também; o usuário cai no login. A lista "Online" esvazia junto. Pedido do usuário; roda uma vez por banco.
WITH encerradas AS (
  UPDATE "Sessao"
  SET "revogadaEm" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "revogadaEm" IS NULL AND "expiraEm" > CURRENT_TIMESTAMP
  RETURNING "usuarioId"
)
INSERT INTO "AuditLog" ("id", "acao", "entidade", "detalhes", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'sessoes.todas-encerradas', 'Sessao',
       jsonb_build_object(
         'motivo', 'atualização 2026-10-13 (análise de faturamento)',
         'sessoes', count(*),
         'usuarios', count(DISTINCT "usuarioId")
       ),
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM encerradas;

DELETE FROM "Presenca";
