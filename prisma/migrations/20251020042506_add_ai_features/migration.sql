-- CreateTable
CREATE TABLE "organization_ai_api_keys" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "lastFour" VARCHAR(4) NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_ai_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_ai_models" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "maxOutputTokens" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generation_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "feature" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "latencyMs" INTEGER NOT NULL,
    "correlationId" VARCHAR(100) NOT NULL,
    "rawInputTruncated" TEXT NOT NULL,
    "rawOutputTruncated" TEXT NOT NULL,
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_ai_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "perMinuteLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_ai_api_keys_organizationId_provider_idx" ON "organization_ai_api_keys"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "organization_ai_api_keys_organizationId_updatedAt_idx" ON "organization_ai_api_keys"("organizationId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "organization_ai_api_keys_organizationId_provider_key" ON "organization_ai_api_keys"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "organization_ai_models_organizationId_provider_idx" ON "organization_ai_models"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "organization_ai_models_organizationId_isDefault_idx" ON "organization_ai_models"("organizationId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "organization_ai_models_organizationId_provider_name_key" ON "organization_ai_models"("organizationId", "provider", "name");

-- CreateIndex
CREATE INDEX "ai_generation_logs_organizationId_createdAt_idx" ON "ai_generation_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_generation_logs_organizationId_provider_model_createdAt_idx" ON "ai_generation_logs"("organizationId", "provider", "model", "createdAt");

-- CreateIndex
CREATE INDEX "ai_generation_logs_organizationId_correlationId_idx" ON "ai_generation_logs"("organizationId", "correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_ai_settings_organizationId_key" ON "organization_ai_settings"("organizationId");

-- AddForeignKey
ALTER TABLE "organization_ai_api_keys" ADD CONSTRAINT "organization_ai_api_keys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_ai_api_keys" ADD CONSTRAINT "organization_ai_api_keys_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_ai_api_keys" ADD CONSTRAINT "organization_ai_api_keys_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_ai_models" ADD CONSTRAINT "organization_ai_models_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_ai_models" ADD CONSTRAINT "organization_ai_models_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "organization_ai_api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation_logs" ADD CONSTRAINT "ai_generation_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation_logs" ADD CONSTRAINT "ai_generation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_ai_settings" ADD CONSTRAINT "organization_ai_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
