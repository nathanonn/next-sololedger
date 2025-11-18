-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('RECEIPT', 'INVOICE', 'BANK_STATEMENT', 'OTHER');

-- AlterTable
ALTER TABLE "organization_settings" ADD COLUMN     "documentRetentionDays" INTEGER;

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filenameOriginal" VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "type" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "documentDate" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "textContent" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_documents" (
    "transactionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_documents_pkey" PRIMARY KEY ("transactionId","documentId")
);

-- CreateIndex
CREATE INDEX "documents_organizationId_idx" ON "documents"("organizationId");

-- CreateIndex
CREATE INDEX "documents_organizationId_deletedAt_idx" ON "documents"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "documents_organizationId_documentDate_idx" ON "documents"("organizationId", "documentDate");

-- CreateIndex
CREATE INDEX "documents_organizationId_uploadedAt_idx" ON "documents"("organizationId", "uploadedAt");

-- CreateIndex
CREATE INDEX "documents_organizationId_filenameOriginal_idx" ON "documents"("organizationId", "filenameOriginal");

-- CreateIndex
CREATE INDEX "documents_organizationId_type_idx" ON "documents"("organizationId", "type");

-- CreateIndex
CREATE INDEX "documents_organizationId_mimeType_idx" ON "documents"("organizationId", "mimeType");

-- CreateIndex
CREATE INDEX "transaction_documents_documentId_idx" ON "transaction_documents"("documentId");

-- CreateIndex
CREATE INDEX "transaction_documents_transactionId_idx" ON "transaction_documents"("transactionId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_documents" ADD CONSTRAINT "transaction_documents_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_documents" ADD CONSTRAINT "transaction_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
