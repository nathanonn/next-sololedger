import { generateText, streamText } from "ai";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import {
  requireOrgAiConfigForFeature,
  AiConfigError,
  AI_CONFIG_ERROR_CODES,
} from "@/lib/ai/config";
import { getOrgProviderClient, type AiProvider } from "@/lib/ai/providers";

/**
 * AI text generation with structured logging
 * Handles both streaming and non-streaming generation
 * Server-only module - Node runtime required
 */

const MAX_INPUT_LOG_LENGTH = 8192; // 8KB
const MAX_OUTPUT_LOG_LENGTH = 16384; // 16KB

type GenerateOptions = {
  orgId: string;
  userId: string;
  feature: string;
  prompt: string;
  modelName?: string;
  provider?: AiProvider;
  maxOutputTokens?: number;
  correlationId?: string;
  temperature?: number;
};

type GenerateResult = {
  text: string;
  correlationId: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
};

type StreamGenerateResult = {
  textStream: AsyncIterable<string>;
  correlationId: string;
  fullText: Promise<string>;
  metadata: Promise<{
    tokensIn?: number;
    tokensOut?: number;
    latencyMs: number;
  }>;
};

/**
 * Sanitizes text for logging (removes secrets, truncates length)
 */
function sanitizeForLog(text: string, maxLength: number): string {
  if (!text) return "";

  // Remove common secret patterns
  let sanitized = text
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[a-zA-Z0-9_-]{20,}/gi, "Bearer [REDACTED]")
    .replace(/token["\s:=]+[a-zA-Z0-9_-]{20,}/gi, "token [REDACTED]")
    .replace(/password["\s:=]+\S+/gi, "password [REDACTED]")
    .replace(/api[_-]?key["\s:=]+\S+/gi, "api_key [REDACTED]");

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + "... [truncated]";
  }

  return sanitized;
}

/**
 * Generates a correlation ID for tracking requests
 */
function generateCorrelationId(): string {
  return randomBytes(8).toString("hex");
}

/**
 * Logs AI generation to database
 */
async function logGeneration(params: {
  organizationId: string;
  userId: string;
  provider: string;
  model: string;
  feature: string;
  status: "ok" | "error" | "canceled";
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
  correlationId: string;
  rawInput: string;
  rawOutput: string;
  errorCode?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db.aiGenerationLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        provider: params.provider,
        model: params.model,
        feature: params.feature,
        status: params.status,
        tokensIn: params.tokensIn ?? null,
        tokensOut: params.tokensOut ?? null,
        latencyMs: params.latencyMs,
        correlationId: params.correlationId,
        rawInputTruncated: sanitizeForLog(params.rawInput, MAX_INPUT_LOG_LENGTH),
        rawOutputTruncated: sanitizeForLog(params.rawOutput, MAX_OUTPUT_LOG_LENGTH),
        errorCode: params.errorCode ?? null,
        errorMessage: params.errorMessage ?? null,
      },
    });
  } catch (error) {
    // Log errors should not break the main flow
    console.error("Failed to log AI generation:", error);
  }
}

/**
 * Non-streaming text generation with automatic logging
 */
export async function generateTextWithLogging(
  options: GenerateOptions
): Promise<GenerateResult> {
  const {
    orgId,
    userId,
    feature,
    prompt,
    modelName,
    provider,
    maxOutputTokens,
    correlationId = generateCorrelationId(),
    temperature,
  } = options;

  const startTime = Date.now();
  let resolvedProvider: AiProvider | undefined;
  let resolvedModel: string | undefined;

  try {
    // Resolve configuration
    const config = await requireOrgAiConfigForFeature({
      orgId,
      feature,
      requestedMaxOutputTokens: maxOutputTokens,
      modelName,
      provider,
    });

    resolvedProvider = config.provider;
    resolvedModel = config.modelName;

    // Get provider client
    const client = await getOrgProviderClient(orgId, config.provider);

    // Generate text
    const result = await generateText({
      model: client.model(config.modelName),
      prompt,
      maxTokens: config.maxOutputTokens,
      temperature,
    });

    const latencyMs = Date.now() - startTime;

    // Log success
    await logGeneration({
      organizationId: orgId,
      userId,
      provider: config.provider,
      model: config.modelName,
      feature,
      status: "ok",
      tokensIn: result.usage?.promptTokens,
      tokensOut: result.usage?.completionTokens,
      latencyMs,
      correlationId,
      rawInput: prompt,
      rawOutput: result.text,
    });

    return {
      text: result.text,
      correlationId,
      tokensIn: result.usage?.promptTokens,
      tokensOut: result.usage?.completionTokens,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    // Determine error code and message
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = "An unknown error occurred";

    if (error instanceof AiConfigError) {
      errorCode = error.code;
      errorMessage = error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;

      // Parse common AI SDK errors
      if (errorMessage.includes("401") || errorMessage.includes("unauthorized")) {
        errorCode = "UNAUTHORIZED";
      } else if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
        errorCode = "RATE_LIMITED";
      } else if (errorMessage.includes("quota")) {
        errorCode = "QUOTA_EXCEEDED";
      } else if (errorMessage.includes("timeout")) {
        errorCode = "TIMEOUT";
      } else if (errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED")) {
        errorCode = "NETWORK_ERROR";
      }
    }

    // Log error
    if (resolvedProvider && resolvedModel) {
      await logGeneration({
        organizationId: orgId,
        userId,
        provider: resolvedProvider,
        model: resolvedModel,
        feature,
        status: "error",
        latencyMs,
        correlationId,
        rawInput: prompt,
        rawOutput: "",
        errorCode,
        errorMessage,
      });
    }

    // Re-throw with correlation ID
    if (error instanceof Error) {
      error.message = `[${correlationId}] ${error.message}`;
    }
    throw error;
  }
}

/**
 * Streaming text generation with automatic logging
 */
export async function streamTextWithLogging(
  options: GenerateOptions
): Promise<StreamGenerateResult> {
  const {
    orgId,
    userId,
    feature,
    prompt,
    modelName,
    provider,
    maxOutputTokens,
    correlationId = generateCorrelationId(),
    temperature,
  } = options;

  const startTime = Date.now();
  let resolvedProvider: AiProvider | undefined;
  let resolvedModel: string | undefined;

  try {
    // Resolve configuration
    const config = await requireOrgAiConfigForFeature({
      orgId,
      feature,
      requestedMaxOutputTokens: maxOutputTokens,
      modelName,
      provider,
    });

    resolvedProvider = config.provider;
    resolvedModel = config.modelName;

    // Get provider client
    const client = await getOrgProviderClient(orgId, config.provider);

    // Stream text
    const result = streamText({
      model: client.model(config.modelName),
      prompt,
      maxTokens: config.maxOutputTokens,
      temperature,
    });

    // Collect full text and metadata for logging
    const fullTextPromise = result.text;
    const metadataPromise = (async () => {
      const text = await fullTextPromise;
      const usage = await result.usage;
      const latencyMs = Date.now() - startTime;

      // Log after stream completes
      await logGeneration({
        organizationId: orgId,
        userId,
        provider: config.provider,
        model: config.modelName,
        feature,
        status: "ok",
        tokensIn: usage?.promptTokens,
        tokensOut: usage?.completionTokens,
        latencyMs,
        correlationId,
        rawInput: prompt,
        rawOutput: text,
      });

      return {
        tokensIn: usage?.promptTokens,
        tokensOut: usage?.completionTokens,
        latencyMs,
      };
    })();

    return {
      textStream: result.textStream,
      correlationId,
      fullText: fullTextPromise,
      metadata: metadataPromise,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    // Determine error code and message (same as non-streaming)
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = "An unknown error occurred";

    if (error instanceof AiConfigError) {
      errorCode = error.code;
      errorMessage = error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;

      if (errorMessage.includes("401") || errorMessage.includes("unauthorized")) {
        errorCode = "UNAUTHORIZED";
      } else if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
        errorCode = "RATE_LIMITED";
      } else if (errorMessage.includes("quota")) {
        errorCode = "QUOTA_EXCEEDED";
      } else if (errorMessage.includes("timeout")) {
        errorCode = "TIMEOUT";
      } else if (errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED")) {
        errorCode = "NETWORK_ERROR";
      }
    }

    // Log error if we have provider and model info
    if (resolvedProvider && resolvedModel) {
      await logGeneration({
        organizationId: orgId,
        userId,
        provider: resolvedProvider,
        model: resolvedModel,
        feature,
        status: "error",
        latencyMs,
        correlationId,
        rawInput: prompt,
        rawOutput: "",
        errorCode,
        errorMessage,
      });
    }

    // Re-throw with correlation ID
    if (error instanceof Error) {
      error.message = `[${correlationId}] ${error.message}`;
    }
    throw error;
  }
}
