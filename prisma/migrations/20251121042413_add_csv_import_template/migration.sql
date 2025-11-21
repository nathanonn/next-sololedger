-- CreateTable
CREATE TABLE "csv_import_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "config" JSON NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_import_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "csv_import_templates_organizationId_idx" ON "csv_import_templates"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "csv_import_templates_organizationId_name_key" ON "csv_import_templates"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "csv_import_templates" ADD CONSTRAINT "csv_import_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_import_templates" ADD CONSTRAINT "csv_import_templates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
