-- CreateTable
CREATE TABLE "organization_integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'connected',
    "accountId" VARCHAR(255),
    "accountName" VARCHAR(255),
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "tokenType" VARCHAR(50),
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_auth_states" (
    "id" TEXT NOT NULL,
    "state" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "organizationId" VARCHAR(255) NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "codeVerifier" VARCHAR(255),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_auth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_call_logs" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(255) NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "endpoint" VARCHAR(500) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "httpStatus" INTEGER,
    "latencyMs" INTEGER NOT NULL,
    "correlationId" VARCHAR(100) NOT NULL,
    "requestTruncated" TEXT NOT NULL,
    "responseTruncated" TEXT NOT NULL,
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_integrations_organizationId_provider_idx" ON "organization_integrations"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "organization_integrations_organizationId_updatedAt_idx" ON "organization_integrations"("organizationId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "organization_integrations_organizationId_provider_key" ON "organization_integrations"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "integration_auth_states_state_provider_idx" ON "integration_auth_states"("state", "provider");

-- CreateIndex
CREATE INDEX "integration_call_logs_organizationId_createdAt_idx" ON "integration_call_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "integration_call_logs_organizationId_provider_createdAt_idx" ON "integration_call_logs"("organizationId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX "integration_call_logs_organizationId_correlationId_idx" ON "integration_call_logs"("organizationId", "correlationId");

-- AddForeignKey
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
