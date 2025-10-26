import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, type LanguageModel, APICallError } from "ai";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";
import { env } from "@/lib/env";

/**
 * AI provider abstraction for organization-scoped API keys
 * Server-only module - Node runtime required
 */

// Provider type (must match Prisma schema)
export type AiProvider = "openai" | "gemini" | "anthropic";

// Curated model definition
export type CuratedModel = {
  id: string;
  label: string;
  maxOutputTokens: number;
  description?: string;
};

/**
 * Provider configuration with safe maximums
 */
export const PROVIDER_CAPS: Record<
  AiProvider,
  { maxOutputTokens: number; displayName: string }
> = {
  openai: { maxOutputTokens: 128000, displayName: "OpenAI" },
  gemini: { maxOutputTokens: 65535, displayName: "Google Gemini" },
  anthropic: { maxOutputTokens: 64000, displayName: "Anthropic" },
};

/**
 * Curated models per provider
 * Intentionally limited to prevent errors and manage costs
 */
export const CURATED_MODELS: Record<AiProvider, CuratedModel[]> = {
  openai: [
    {
      id: "gpt-5-mini",
      label: "GPT-5 Mini",
      maxOutputTokens: 128000,
      description: "Latest small model with improved capabilities",
    },
    {
      id: "gpt-5",
      label: "GPT-5",
      maxOutputTokens: 128000,
      description: "Most capable OpenAI model",
    },
  ],
  gemini: [
    {
      id: "gemini-2.5-flash",
      label: "Gemini 2.5 Flash",
      maxOutputTokens: 65535,
      description: "Fast, multimodal model with large context",
    },
    {
      id: "gemini-2.5-pro",
      label: "Gemini 2.5 Pro",
      maxOutputTokens: 65535,
      description: "Advanced reasoning with 2M token context",
    },
  ],
  anthropic: [
    {
      id: "claude-haiku-4-5-20251001",
      label: "Claude Haiku 4.5",
      maxOutputTokens: 64000,
      description: "Fastest Claude model for simple tasks",
    },
    {
      id: "claude-sonnet-4-5-20250929",
      label: "Claude Sonnet 4.5",
      maxOutputTokens: 64000,
      description: "Balanced performance and speed",
    },
    {
      id: "claude-opus-4-1-20250805",
      label: "Claude Opus 4.1",
      maxOutputTokens: 32000,
      description: "Latest Claude with advanced capabilities",
    },
  ],
};

/**
 * Validates that a provider is allowed
 */
export function isProviderAllowed(provider: string): provider is AiProvider {
  const allowed = env.AI_ALLOWED_PROVIDERS.split(",").map((p) => p.trim());
  return allowed.includes(provider);
}

/**
 * Gets the list of allowed providers
 */
export function getAllowedProviders(): AiProvider[] {
  return env.AI_ALLOWED_PROVIDERS.split(",").map((p) =>
    p.trim()
  ) as AiProvider[];
}

/**
 * Provider client wrapper with org-specific API key
 */
type ProviderClient = {
  provider: AiProvider;
  model: (name: string) => LanguageModel;
};

/**
 * Fetches and decrypts org API key, returns provider client
 * @throws Error if key not found or decryption fails
 */
export async function getOrgProviderClient(
  orgId: string,
  provider: AiProvider
): Promise<ProviderClient> {
  if (!isProviderAllowed(provider)) {
    throw new Error(`Provider not allowed: ${provider}`);
  }

  // Fetch encrypted key from database
  const apiKey = await db.organizationAiApiKey.findUnique({
    where: {
      organizationId_provider: {
        organizationId: orgId,
        provider,
      },
    },
  });

  if (!apiKey) {
    throw new Error(
      `No API key found for provider ${provider} in organization ${orgId}`
    );
  }

  // Decrypt the key
  const plainKey = decryptSecret(apiKey.encryptedKey);

  // Return provider-specific client factory
  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey: plainKey });
      return {
        provider,
        model: (name: string) => openai(name),
      };
    }
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey: plainKey });
      return {
        provider,
        model: (name: string) => google(name),
      };
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: plainKey });
      return {
        provider,
        model: (name: string) => anthropic(name),
      };
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Verifies an API key by making a minimal generation call
 * @throws Error with descriptive message if verification fails
 */
export async function verifyApiKey(
  provider: AiProvider,
  plainKey: string
): Promise<void> {
  if (!plainKey || plainKey.trim().length === 0) {
    throw new Error("API key cannot be empty");
  }

  // Use a minimal prompt to verify the key
  const testPrompt = "Hello";

  try {
    let model: LanguageModel;

    switch (provider) {
      case "openai": {
        const openai = createOpenAI({ apiKey: plainKey });
        model = openai("gpt-4o-mini");
        break;
      }
      case "gemini": {
        const google = createGoogleGenerativeAI({ apiKey: plainKey });
        model = google("gemini-2.5-flash");
        break;
      }
      case "anthropic": {
        const anthropic = createAnthropic({ apiKey: plainKey });
        model = anthropic("claude-3-5-haiku-20241022");
        break;
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Make the verification call
    await generateText({
      model,
      prompt: testPrompt,
      maxOutputTokens: 32,
    });
  } catch (error) {
    // Parse error to provide helpful feedback
    const displayName = PROVIDER_CAPS[provider].displayName;

    if (error instanceof APICallError) {
      const statusCode = error.statusCode;

      if (statusCode === 401) {
        throw new Error(
          `Invalid API key for ${displayName}. Please check your key and try again.`
        );
      }

      if (statusCode === 429) {
        throw new Error(
          `Rate limited by ${displayName}. Please try again later.`
        );
      }

      if (statusCode === 403) {
        throw new Error(
          `API quota exceeded for ${displayName}. Please check your billing.`
        );
      }

      // Generic API error with status code
      throw new Error(
        `Verification failed for ${displayName} (HTTP ${statusCode}): ${error.message}`
      );
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (
        message.includes("network") ||
        message.includes("econnrefused") ||
        message.includes("timeout")
      ) {
        throw new Error(
          `Network error connecting to ${displayName}. Please try again.`
        );
      }

      // Generic error with original message
      throw new Error(
        `Verification failed for ${displayName}: ${error.message}`
      );
    }

    throw new Error(`Unknown error verifying ${displayName} API key`);
  }
}

/**
 * Gets curated models for a provider
 */
export function getCuratedModels(provider: AiProvider): CuratedModel[] {
  return CURATED_MODELS[provider] || [];
}

/**
 * Validates that a model name exists in the curated list
 */
export function isCuratedModel(
  provider: AiProvider,
  modelName: string
): boolean {
  return CURATED_MODELS[provider]?.some((m) => m.id === modelName) ?? false;
}

/**
 * Gets a curated model by name
 */
export function getCuratedModel(
  provider: AiProvider,
  modelName: string
): CuratedModel | undefined {
  return CURATED_MODELS[provider]?.find((m) => m.id === modelName);
}

/**
 * Clamps output tokens to provider and model limits
 */
export function clampOutputTokens(
  provider: AiProvider,
  modelName: string,
  requested: number
): number {
  const providerMax = PROVIDER_CAPS[provider].maxOutputTokens;
  const model = getCuratedModel(provider, modelName);
  const modelMax = model?.maxOutputTokens ?? providerMax;

  return Math.min(requested, modelMax, providerMax);
}
