-- AlterTable
ALTER TABLE "organization_integrations" ADD COLUMN     "connectionType" VARCHAR(20) NOT NULL DEFAULT 'public',
ADD COLUMN     "workspaceId" VARCHAR(255);
