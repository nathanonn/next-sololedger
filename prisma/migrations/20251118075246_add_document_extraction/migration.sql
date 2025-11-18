-- CreateEnum
CREATE TYPE "DocumentExtractionStatus" AS ENUM ('RAW', 'REVIEWED_DRAFT', 'APPLIED');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('openai', 'gemini', 'anthropic');

-- CreateTable
CREATE TABLE "document_extractions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "DocumentExtractionStatus" NOT NULL DEFAULT 'RAW',
    "templateKey" VARCHAR(100),
    "customPrompt" TEXT,
    "provider" "AiProvider" NOT NULL,
    "modelName" VARCHAR(100) NOT NULL,
    "documentType" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "summaryTotalAmount" DECIMAL(18,2),
    "summaryCurrency" VARCHAR(3),
    "summaryTransactionDate" TIMESTAMP(3),
    "overallConfidence" DECIMAL(5,4),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSON NOT NULL,
    "appliedTransactionIds" JSON,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_extractions_organizationId_documentId_isActive_idx" ON "document_extractions"("organizationId", "documentId", "isActive");

-- CreateIndex
CREATE INDEX "document_extractions_organizationId_documentId_createdAt_idx" ON "document_extractions"("organizationId", "documentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "document_extractions_organizationId_documentType_summaryTra_idx" ON "document_extractions"("organizationId", "documentType", "summaryTransactionDate");

-- CreateIndex
CREATE INDEX "document_extractions_organizationId_summaryCurrency_idx" ON "document_extractions"("organizationId", "summaryCurrency");

-- CreateUniqueIndex: Ensure at most one active extraction per document
CREATE UNIQUE INDEX "document_extractions_documentId_isActive_unique" ON "document_extractions"("documentId") WHERE "isActive" = true;

-- AddForeignKey
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
