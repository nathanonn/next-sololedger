/**
 * Core document extraction pipeline using AI SDK v5
 *
 * Provides provider-agnostic document extraction with multimodal support
 * for receipts, invoices, and bank statements.
 */

import { generateObject, APICallError } from "ai";
import { randomBytes } from "crypto";
import { Readable } from "stream";
import { extractText } from "unpdf";
import { db } from "@/lib/db";
import { requireOrgAiConfigForFeature, AiConfigError } from "@/lib/ai/config";
import { getOrgProviderClient, type AiProvider } from "@/lib/ai/providers";
import {
  DocumentExtractionV1Schema,
  type DocumentExtractionV1,
} from "@/lib/ai/document-schemas";
import {
  buildSystemMessage,
  buildUserMessage,
  type TemplateKey,
} from "@/lib/ai/document-prompts";
import { getDocumentStorage } from "@/lib/document-storage";

// ============================================================================
// Types
// ============================================================================

export interface ExtractDocumentOptions {
  orgId: string;
  userId: string;
  documentId: string;
  templateKey?: TemplateKey | null;
  customPrompt?: string | null;
  provider?: AiProvider;
  modelName?: string;
  documentTypeHint?: string;
  localeHint?: string;
}

export interface ExtractionResult {
  extraction: DocumentExtractionV1;
  provider: AiProvider;
  modelName: string;
  correlationId: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
}

// ============================================================================
// Main extraction function
// ============================================================================

/**
 * Extract structured data from a document using AI
 *
 * This function orchestrates the entire extraction pipeline:
 * 1. Loads document from storage
 * 2. Preprocesses based on file type (text, PDF, image)
 * 3. Resolves AI provider and model configuration
 * 4. Builds prompts from templates
 * 5. Calls AI SDK generateObject with structured schema
 * 6. Logs extraction to database
 * 7. Returns structured extraction result
 *
 * @throws AiConfigError if AI configuration is invalid
 * @throws Error if document not found or processing fails
 */
export async function extractDocument(
  options: ExtractDocumentOptions
): Promise<ExtractionResult> {
  const {
    orgId,
    userId,
    documentId,
    templateKey = "standard_receipt",
    customPrompt,
    provider,
    modelName,
    documentTypeHint,
    localeHint,
  } = options;

  const startTime = Date.now();
  const correlationId = randomBytes(16).toString("hex");

  try {
    // Step 1: Load document metadata from database
    const document = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new Error("Document not found or has been deleted");
    }

    // Step 2: Read document file from storage
    const storage = getDocumentStorage();
    const fileStream = storage.getStream({
      organizationId: orgId,
      storageKey: document.storageKey,
    });

    // Convert stream to buffer
    const fileBuffer = await streamToBuffer(fileStream);

    // Step 3: Preprocess document based on MIME type
    const { textContent, base64Images } = await preprocessDocument(
      fileBuffer,
      document.mimeType
    );

    // Step 4: Resolve AI configuration
    const config = await requireOrgAiConfigForFeature({
      orgId,
      feature: "document_extraction",
      requestedMaxOutputTokens: 4096, // Documents can have complex structures
      modelName,
      provider,
    });

    // Step 5: Build prompt messages
    const systemMessage = buildSystemMessage(templateKey || "standard_receipt");
    const userMessage = buildUserMessage(
      templateKey || "standard_receipt",
      customPrompt,
      documentTypeHint,
      localeHint
    );

    // Step 6: Get provider client
    const client = await getOrgProviderClient(orgId, config.provider);

    // Step 7: Build AI SDK messages array
    const messages: Array<{
      role: "system" | "user";
      content: string | Array<{ type: string; text?: string; image?: string }>;
    }> = [{ role: "system", content: systemMessage }];

    // For text-only documents
    if (base64Images.length === 0) {
      messages.push({
        role: "user",
        content: `${userMessage}\n\nDOCUMENT CONTENT:\n${textContent}`,
      });
    } else {
      // For documents with images (multimodal)
      const contentParts: Array<{
        type: string;
        text?: string;
        image?: string;
      }> = [{ type: "text", text: userMessage }];

      // Add images
      for (const base64Image of base64Images) {
        contentParts.push({
          type: "image",
          image: base64Image,
        });
      }

      // Add extracted text as context if available
      if (textContent && textContent.trim()) {
        contentParts.push({
          type: "text",
          text: `\n\nExtracted text from document (for reference):\n${textContent}`,
        });
      }

      messages.push({
        role: "user",
        content: contentParts,
      });
    }

    // Step 8: Call AI SDK generateObject with structured schema
    const result = await generateObject({
      model: client.model(config.modelName),
      schema: DocumentExtractionV1Schema,
      messages,
      maxRetries: 1,
    });

    const latencyMs = Date.now() - startTime;

    // Step 9: Log extraction to database
    await db.aiGenerationLog.create({
      data: {
        organizationId: orgId,
        userId,
        provider: config.provider,
        model: config.modelName,
        feature: "document_extraction",
        status: "ok",
        tokensIn: result.usage?.promptTokens,
        tokensOut: result.usage?.completionTokens,
        latencyMs,
        correlationId,
        rawInputTruncated: sanitizeForLog(JSON.stringify(messages), 8192),
        rawOutputTruncated: sanitizeForLog(
          JSON.stringify(result.object),
          16384
        ),
        rawRequest: sanitizeJsonForLog({
          provider: config.provider,
          model: config.modelName,
          schema: "DocumentExtractionV1Schema",
          templateKey,
          documentId,
        }),
        rawResponse: sanitizeJsonForLog({
          finishReason: result.finishReason,
          usage: result.usage,
        }),
      },
    });

    // Step 10: Return structured result
    return {
      extraction: result.object,
      provider: config.provider,
      modelName: config.modelName,
      correlationId,
      tokensIn: result.usage?.promptTokens,
      tokensOut: result.usage?.completionTokens,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    // Log error to database
    const errorCode =
      error instanceof AiConfigError ? error.code : "EXTRACTION_ERROR";
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await db.aiGenerationLog.create({
      data: {
        organizationId: orgId,
        userId,
        provider: provider || "openai",
        model: modelName || "unknown",
        feature: "document_extraction",
        status: "error",
        latencyMs,
        correlationId,
        rawInputTruncated: sanitizeForLog(`documentId: ${documentId}`, 8192),
        rawOutputTruncated: "",
        errorCode,
        errorMessage: sanitizeForLog(errorMessage, 1024),
      },
    });

    // Re-throw error for API handler
    throw error;
  }
}

// ============================================================================
// Document preprocessing helpers
// ============================================================================

/**
 * Preprocess document based on MIME type
 *
 * Returns extracted text and/or base64-encoded images for multimodal models
 */
async function preprocessDocument(
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ textContent: string; base64Images: string[] }> {
  // Text files - return as-is
  if (mimeType === "text/plain") {
    return {
      textContent: fileBuffer.toString("utf-8"),
      base64Images: [],
    };
  }

  // PDF files - extract text and optionally generate preview images
  if (mimeType === "application/pdf") {
    try {
      // unpdf requires Uint8Array, not Buffer
      const { text } = await extractText(new Uint8Array(fileBuffer), {
        mergePages: true,
      });

      return {
        textContent: text,
        base64Images: [], // Future: generate preview images of first few pages
      };
    } catch (error) {
      throw new Error(
        `Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Image files - return as base64 data URL
  if (mimeType.startsWith("image/")) {
    const base64 = fileBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return {
      textContent: "", // No text extraction for images (OCR could be added later)
      base64Images: [dataUrl],
    };
  }

  // Unsupported file type
  throw new Error(`Unsupported document type: ${mimeType}`);
}

/**
 * Convert a readable stream to a buffer
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// ============================================================================
// Logging helpers (copied from generate.ts pattern)
// ============================================================================

const MAX_LOG_LENGTH = 8192;

function sanitizeForLog(text: string, maxLength: number): string {
  if (!text) return "";

  let sanitized = text
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[a-zA-Z0-9_-]{20,}/gi, "Bearer [REDACTED]")
    .replace(/token["\s:=]+[a-zA-Z0-9_-]{20,}/gi, "token [REDACTED]")
    .replace(/password["\s:=]+\S+/gi, "password [REDACTED]")
    .replace(/api[_-]?key["\s:=]+\S+/gi, "api_key [REDACTED]");

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + "... [truncated]";
  }

  return sanitized;
}

function sanitizeJsonForLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return obj
      .replace(/sk-[a-zA-Z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
      .replace(/Bearer\s+[a-zA-Z0-9_-]{20,}/gi, "Bearer [REDACTED]")
      .replace(/token["\s:=]+[a-zA-Z0-9_-]{20,}/gi, "token [REDACTED]")
      .replace(/password["\s:=]+\S+/gi, "password [REDACTED]")
      .replace(/api[_-]?key["\s:=]+\S+/gi, "api_key [REDACTED]");
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeJsonForLog(item));
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeJsonForLog(value);
    }
    return sanitized;
  }

  return obj;
}
