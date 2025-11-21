-- Create tags table scoped to organization
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_lower" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- Ensure organization-scoped uniqueness
CREATE UNIQUE INDEX "tags_organization_id_name_lower_key" ON "tags"("organization_id", "name_lower");
CREATE INDEX "tags_organization_id_name_lower_idx" ON "tags"("organization_id", "name_lower");

-- Many-to-many join between transactions and tags
CREATE TABLE "transaction_tags" (
    "transaction_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transaction_tags_pkey" PRIMARY KEY ("transaction_id", "tag_id")
);

CREATE INDEX "transaction_tags_tag_id_idx" ON "transaction_tags"("tag_id");
CREATE INDEX "transaction_tags_transaction_id_idx" ON "transaction_tags"("transaction_id");

-- Drop deprecated free-text tags column
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "tags";

-- Foreign keys
ALTER TABLE "tags"
ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transaction_tags"
ADD CONSTRAINT "transaction_tags_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transaction_tags"
ADD CONSTRAINT "transaction_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
