-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "clientName" VARCHAR(255);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "nameLower" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clients_organizationId_active_idx" ON "clients"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "clients_organizationId_nameLower_key" ON "clients"("organizationId", "nameLower");

-- CreateIndex
CREATE INDEX "transactions_organizationId_clientId_status_date_idx" ON "transactions"("organizationId", "clientId", "status", "date");

-- CreateIndex
CREATE INDEX "transactions_clientId_idx" ON "transactions"("clientId");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
