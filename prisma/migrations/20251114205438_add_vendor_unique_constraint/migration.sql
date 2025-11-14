-- AlterTable: Add nameLower column to vendors
ALTER TABLE "vendors" ADD COLUMN "nameLower" VARCHAR(255);

-- Populate nameLower with lowercase version of existing names
UPDATE "vendors" SET "nameLower" = LOWER("name");

-- Make nameLower NOT NULL
ALTER TABLE "vendors" ALTER COLUMN "nameLower" SET NOT NULL;

-- DropIndex: Remove the old non-unique index on (organizationId, name)
DROP INDEX IF EXISTS "vendors_organizationId_name_idx";

-- CreateIndex: Add unique constraint on (organizationId, nameLower)
CREATE UNIQUE INDEX "vendors_organizationId_nameLower_key" ON "vendors"("organizationId", "nameLower");
