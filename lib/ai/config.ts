import { db } from "@/lib/db";
import {
  type AiProvider,
  clampOutputTokens,
  isCuratedModel,
  PROVIDER_CAPS,
} from "@/lib/ai/providers";

/**
 * AI configuration resolution and validation
 * Resolves provider, model, and token limits for feature requests
 * Server-only module - Node runtime required
 */

// Custom error codes for AI configuration issues
export const AI_CONFIG_ERROR_CODES = {
  MISSING_API_KEY: "AI_CONFIG_MISSING_API_KEY",
  MODEL_NOT_ALLOWED: "AI_CONFIG_MODEL_NOT_ALLOWED",
  TOKEN_LIMIT_EXCEEDED: "AI_CONFIG_TOKEN_LIMIT_EXCEEDED",
  PROVIDER_UNAVAILABLE: "AI_CONFIG_PROVIDER_UNAVAILABLE",
  NO_DEFAULT_MODEL: "AI_CONFIG_NO_DEFAULT_MODEL",
} as const;

export class AiConfigError extends Error {
  constructor(
    public code: (typeof AI_CONFIG_ERROR_CODES)[keyof typeof AI_CONFIG_ERROR_CODES],
    message: string
  ) {
    super(message);
    this.name = "AiConfigError";
  }
}

// Resolved configuration for a feature request
export type ResolvedAiConfig = {
  provider: AiProvider;
  modelName: string;
  maxOutputTokens: number;
  apiKeyId: string;
};

type RequireConfigOptions = {
  orgId: string;
  feature: string;
  requestedMaxOutputTokens?: number;
  modelName?: string;
  provider?: AiProvider;
};

/**
 * Resolves AI configuration for an organization feature request
 *
 * Resolution logic:
 * 1. If provider + modelName specified: validate and use them
 * 2. If only modelName specified: infer provider from model, validate
 * 3. If only provider specified: use default model for that provider
 * 4. If neither specified: use org's default model (first default found)
 *
 * @throws AiConfigError with specific error code if configuration is invalid
 */
export async function requireOrgAiConfigForFeature(
  options: RequireConfigOptions
): Promise<ResolvedAiConfig> {
  const {
    orgId,
    feature,
    requestedMaxOutputTokens = 2048,
    modelName,
    provider,
  } = options;

  // Case 1: Both provider and model specified
  if (provider && modelName) {
    return await resolveWithProviderAndModel(
      orgId,
      provider,
      modelName,
      requestedMaxOutputTokens
    );
  }

  // Case 2: Only model specified - infer provider
  if (modelName && !provider) {
    return await resolveWithModelName(orgId, modelName, requestedMaxOutputTokens);
  }

  // Case 3: Only provider specified - use default model
  if (provider && !modelName) {
    return await resolveWithProvider(
      orgId,
      provider,
      requestedMaxOutputTokens
    );
  }

  // Case 4: Neither specified - use org default
  return await resolveWithOrgDefault(orgId, requestedMaxOutputTokens);
}

/**
 * Case 1: Provider and model both specified
 */
async function resolveWithProviderAndModel(
  orgId: string,
  provider: AiProvider,
  modelName: string,
  requestedMaxOutputTokens: number
): Promise<ResolvedAiConfig> {
  // Verify the model is curated
  if (!isCuratedModel(provider, modelName)) {
    throw new AiConfigError(
      AI_CONFIG_ERROR_CODES.MODEL_NOT_ALLOWED,
      `Model "${modelName}" is not in the curated list for provider "${provider}"`
    );
  }

  // Find the org's API key for this provider
  const apiKey = await db.organizationAiApiKey.findUnique({
    where: {
      organizationId_provider: {
        organizationId: orgId,
        provider,
      },
    },
  });

  if (!apiKey) {
    throw new AiConfigError(
      AI_CONFIG_ERROR_CODES.MISSING_API_KEY,
      `Organization does not have an API key configured for provider "${provider}"`
    );
  }

  // Find the model in org's configured models (optional - org may not have added it yet)
  const orgModel = await db.organizationAiModel.findUnique({
    where: {
      organizationId_provider_name: {
        organizationId: orgId,
        provider,
        name: modelName,
      },
    },
  });

  // Clamp tokens to provider and model limits
  const clampedTokens = clampOutputTokens(
    provider,
    modelName,
    requestedMaxOutputTokens
  );

  return {
    provider,
    modelName,
    maxOutputTokens: clampedTokens,
    apiKeyId: apiKey.id,
  };
}

/**
 * Case 2: Only model name specified - infer provider from configured models
 */
async function resolveWithModelName(
  orgId: string,
  modelName: string,
  requestedMaxOutputTokens: number
): Promise<ResolvedAiConfig> {
  // Find the model in org's configured models
  const orgModel = await db.organizationAiModel.findFirst({
    where: {
      organizationId: orgId,
      name: modelName,
    },
    include: {
      apiKey: true,
    },
  });

  if (!orgModel) {
    throw new AiConfigError(
      AI_CONFIG_ERROR_CODES.MODEL_NOT_ALLOWED,
      `Model "${modelName}" is not configured for this organization`
    );
  }

  const provider = orgModel.provider as AiProvider;

  // Verify the model is still curated
  if (!isCuratedModel(provider, modelName)) {
    throw new AiConfigError(
      AI_CONFIG_ERROR_CODES.MODEL_NOT_ALLOWED,
      `Model "${modelName}" is no longer in the curated list for provider "${provider}"`
    );
  }

  // Clamp tokens
  const clampedTokens = clampOutputTokens(
    provider,
    modelName,
    requestedMaxOutputTokens
  );

  return {
    provider,
    modelName,
    maxOutputTokens: clampedTokens,
    apiKeyId: orgModel.apiKeyId,
  };
}

/**
 * Case 3: Only provider specified - use default model for that provider
 */
async function resolveWithProvider(
  orgId: string,
  provider: AiProvider,
  requestedMaxOutputTokens: number
): Promise<ResolvedAiConfig> {
  // Find API key for provider
  const apiKey = await db.organizationAiApiKey.findUnique({
    where: {
      organizationId_provider: {
        organizationId: orgId,
        provider,
      },
    },
    include: {
      models: {
        where: {
          isDefault: true,
        },
      },
    },
  });

  if (!apiKey) {
    throw new AiConfigError(
      AI_CONFIG_ERROR_CODES.MISSING_API_KEY,
      `Organization does not have an API key configured for provider "${provider}"`
    );
  }

  const defaultModel = apiKey.models[0];

  if (!defaultModel) {
    throw new AiConfigError(
      AI_CONFIG_ERROR_CODES.NO_DEFAULT_MODEL,
      `No default model configured for provider "${provider}" in this organization`
    );
  }

  // Clamp tokens
  const clampedTokens = clampOutputTokens(
    provider,
    defaultModel.name,
    requestedMaxOutputTokens
  );

  return {
    provider,
    modelName: defaultModel.name,
    maxOutputTokens: clampedTokens,
    apiKeyId: apiKey.id,
  };
}

/**
 * Case 4: No provider or model specified - use org's default
 */
async function resolveWithOrgDefault(
  orgId: string,
  requestedMaxOutputTokens: number
): Promise<ResolvedAiConfig> {
  // Find any default model for this org
  const defaultModel = await db.organizationAiModel.findFirst({
    where: {
      organizationId: orgId,
      isDefault: true,
    },
    include: {
      apiKey: true,
    },
  });

  if (!defaultModel) {
    throw new AiConfigError(
      AI_CONFIG_ERROR_CODES.NO_DEFAULT_MODEL,
      "No default AI model configured for this organization. Please configure a model in AI Settings."
    );
  }

  const provider = defaultModel.provider as AiProvider;

  // Clamp tokens
  const clampedTokens = clampOutputTokens(
    provider,
    defaultModel.name,
    requestedMaxOutputTokens
  );

  return {
    provider,
    modelName: defaultModel.name,
    maxOutputTokens: clampedTokens,
    apiKeyId: defaultModel.apiKeyId,
  };
}

/**
 * Helper to get org AI settings with defaults
 */
export async function getOrgAiSettings(orgId: string): Promise<{
  retentionDays: number;
  perMinuteLimit: number | null;
}> {
  const settings = await db.organizationAiSettings.findUnique({
    where: { organizationId: orgId },
  });

  return {
    retentionDays: settings?.retentionDays ?? 30,
    perMinuteLimit: settings?.perMinuteLimit ?? null,
  };
}
