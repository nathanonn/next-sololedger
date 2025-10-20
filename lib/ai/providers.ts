import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
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
  openai: { maxOutputTokens: 16384, displayName: "OpenAI" },
  gemini: { maxOutputTokens: 8192, displayName: "Google Gemini" },
  anthropic: { maxOutputTokens: 8192, displayName: "Anthropic" },
};

/**
 * Curated models per provider
 * Intentionally limited to prevent errors and manage costs
 */
export const CURATED_MODELS: Record<AiProvider, CuratedModel[]> = {
  openai: [
    {
      id: "gpt-4o-mini",
      label: "GPT-4o Mini",
      maxOutputTokens: 16384,
      description: "Fast, cost-effective model for most tasks",
    },
    {
      id: "gpt-4o",
      label: "GPT-4o",
      maxOutputTokens: 16384,
      description: "Advanced reasoning and complex tasks",
    },
    {
      id: "gpt-5-mini",
      label: "GPT-5 Mini",
      maxOutputTokens: 16384,
      description: "Latest small model with improved capabilities",
    },
    {
      id: "gpt-5",
      label: "GPT-5",
      maxOutputTokens: 16384,
      description: "Most capable OpenAI model",
    },
  ],
  gemini: [
    {
      id: "gemini-2.5-flash",
      label: "Gemini 2.5 Flash",
      maxOutputTokens: 8192,
      description: "Fast, multimodal model with large context",
    },
    {
      id: "gemini-2.5-pro",
      label: "Gemini 2.5 Pro",
      maxOutputTokens: 8192,
      description: "Advanced reasoning with 2M token context",
    },
    {
      id: "gemini-1.5-flash",
      label: "Gemini 1.5 Flash",
      maxOutputTokens: 8192,
      description: "Fast, cost-effective model",
    },
    {
      id: "gemini-1.5-pro",
      label: "Gemini 1.5 Pro",
      maxOutputTokens: 8192,
      description: "High-quality multimodal understanding",
    },
  ],
  anthropic: [
    {
      id: "claude-3-5-haiku-20241022",
      label: "Claude 3.5 Haiku",
      maxOutputTokens: 8192,
      description: "Fastest Claude model for simple tasks",
    },
    {
      id: "claude-3-5-sonnet-20241022",
      label: "Claude 3.5 Sonnet",
      maxOutputTokens: 8192,
      description: "Balanced performance and speed",
    },
    {
      id: "claude-sonnet-4-20250514",
      label: "Claude Sonnet 4",
      maxOutputTokens: 8192,
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
  model: (name: string) => ReturnType<typeof openai | typeof anthropic | typeof google>;
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
    case "openai":
      return {
        provider,
        model: (name: string) => openai(name, { apiKey: plainKey }),
      };
    case "gemini":
      return {
        provider,
        model: (name: string) => google(name, { apiKey: plainKey }),
      };
    case "anthropic":
      return {
        provider,
        model: (name: string) => anthropic(name, { apiKey: plainKey }),
      };
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
    switch (provider) {
      case "openai": {
        await generateText({
          model: openai("gpt-4o-mini", { apiKey: plainKey }),
          prompt: testPrompt,
          maxTokens: 5,
        });
        break;
      }
      case "gemini": {
        await generateText({
          model: google("gemini-2.5-flash", { apiKey: plainKey }),
          prompt: testPrompt,
          maxTokens: 5,
        });
        break;
      }
      case "anthropic": {
        await generateText({
          model: anthropic("claude-3-5-haiku-20241022", { apiKey: plainKey }),
          prompt: testPrompt,
          maxTokens: 5,
        });
        break;
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error) {
    // Parse error to provide helpful feedback
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes("401") || message.includes("unauthorized") || message.includes("invalid_api_key")) {
        throw new Error(
          `Invalid API key for ${PROVIDER_CAPS[provider].displayName}. Please check your key and try again.`
        );
      }

      if (message.includes("429") || message.includes("rate limit")) {
        throw new Error(
          `Rate limited by ${PROVIDER_CAPS[provider].displayName}. Please try again later.`
        );
      }

      if (message.includes("quota") || message.includes("insufficient_quota")) {
        throw new Error(
          `API quota exceeded for ${PROVIDER_CAPS[provider].displayName}. Please check your billing.`
        );
      }

      if (message.includes("network") || message.includes("econnrefused") || message.includes("timeout")) {
        throw new Error(
          `Network error connecting to ${PROVIDER_CAPS[provider].displayName}. Please try again.`
        );
      }

      // Generic error with original message
      throw new Error(
        `Verification failed for ${PROVIDER_CAPS[provider].displayName}: ${error.message}`
      );
    }

    throw new Error(
      `Unknown error verifying ${PROVIDER_CAPS[provider].displayName} API key`
    );
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
export function isCuratedModel(provider: AiProvider, modelName: string): boolean {
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
