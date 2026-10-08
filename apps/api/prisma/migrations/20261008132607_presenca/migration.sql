-- CreateTable
CREATE TABLE "Presenca" (
    "usuarioId" UUID NOT NULL,
    "ultimaAtividadeEm" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Presenca_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateIndex
CREATE INDEX "Presenca_ultimaAtividadeEm_idx" ON "Presenca"("ultimaAtividadeEm");

-- AddForeignKey
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
