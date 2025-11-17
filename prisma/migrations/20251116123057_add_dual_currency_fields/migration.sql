-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "amountSecondary" DECIMAL(18,2),
ADD COLUMN     "currencyBase" VARCHAR(3),
ADD COLUMN     "currencySecondary" VARCHAR(3);

-- CreateIndex
CREATE INDEX "transactions_organizationId_currencySecondary_idx" ON "transactions"("organizationId", "currencySecondary");
