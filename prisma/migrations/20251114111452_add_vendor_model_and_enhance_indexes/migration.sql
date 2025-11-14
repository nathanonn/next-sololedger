-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "vendorId" TEXT;

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendors_organizationId_active_idx" ON "vendors"("organizationId", "active");

-- CreateIndex
CREATE INDEX "vendors_organizationId_name_idx" ON "vendors"("organizationId", "name");

-- CreateIndex
CREATE INDEX "categories_organizationId_type_parentId_sortOrder_idx" ON "categories"("organizationId", "type", "parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "transactions_organizationId_categoryId_status_date_idx" ON "transactions"("organizationId", "categoryId", "status", "date");

-- CreateIndex
CREATE INDEX "transactions_organizationId_vendorId_status_date_idx" ON "transactions"("organizationId", "vendorId", "status", "date");

-- CreateIndex
CREATE INDEX "transactions_organizationId_accountId_status_date_idx" ON "transactions"("organizationId", "accountId", "status", "date");

-- CreateIndex
CREATE INDEX "transactions_vendorId_idx" ON "transactions"("vendorId");

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
