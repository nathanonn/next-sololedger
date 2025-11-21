/*
  Warnings:

  - You are about to drop the column `created_at` on the `tags` table. All the data in the column will be lost.
  - You are about to drop the column `name_lower` on the `tags` table. All the data in the column will be lost.
  - You are about to drop the column `organization_id` on the `tags` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `tags` table. All the data in the column will be lost.
  - The primary key for the `transaction_tags` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_at` on the `transaction_tags` table. All the data in the column will be lost.
  - You are about to drop the column `tag_id` on the `transaction_tags` table. All the data in the column will be lost.
  - You are about to drop the column `transaction_id` on the `transaction_tags` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[organizationId,nameLower]` on the table `tags` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nameLower` to the `tags` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `tags` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `tags` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tagId` to the `transaction_tags` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transactionId` to the `transaction_tags` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."tags" DROP CONSTRAINT "tags_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."transaction_tags" DROP CONSTRAINT "transaction_tags_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."transaction_tags" DROP CONSTRAINT "transaction_tags_transaction_id_fkey";

-- DropIndex
DROP INDEX "public"."tags_organization_id_name_lower_idx";

-- DropIndex
DROP INDEX "public"."tags_organization_id_name_lower_key";

-- DropIndex
DROP INDEX "public"."transaction_tags_tag_id_idx";

-- DropIndex
DROP INDEX "public"."transaction_tags_transaction_id_idx";

-- AlterTable
ALTER TABLE "tags" DROP COLUMN "created_at",
DROP COLUMN "name_lower",
DROP COLUMN "organization_id",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nameLower" VARCHAR(255) NOT NULL,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "transaction_tags" DROP CONSTRAINT "transaction_tags_pkey",
DROP COLUMN "created_at",
DROP COLUMN "tag_id",
DROP COLUMN "transaction_id",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "tagId" TEXT NOT NULL,
ADD COLUMN     "transactionId" TEXT NOT NULL,
ADD CONSTRAINT "transaction_tags_pkey" PRIMARY KEY ("transactionId", "tagId");

-- CreateIndex
CREATE INDEX "tags_organizationId_nameLower_idx" ON "tags"("organizationId", "nameLower");

-- CreateIndex
CREATE UNIQUE INDEX "tags_organizationId_nameLower_key" ON "tags"("organizationId", "nameLower");

-- CreateIndex
CREATE INDEX "transaction_tags_tagId_idx" ON "transaction_tags"("tagId");

-- CreateIndex
CREATE INDEX "transaction_tags_transactionId_idx" ON "transaction_tags"("transactionId");

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
