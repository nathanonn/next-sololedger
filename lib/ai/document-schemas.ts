/**
 * Zod schemas for AI document extraction
 *
 * Defines structured extraction schemas for different document types
 * (receipts, invoices, bank statements). Version-controlled for future evolution.
 */

import { z } from 'zod';

// ============================================================================
// Field-level schemas with confidence scores
// ============================================================================

/**
 * Schema for extracted monetary amount with confidence
 */
const MoneyFieldSchema = z.object({
  value: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  rawText: z.string().nullable().optional(),
});

/**
 * Schema for extracted entity (vendor, client) with confidence
 */
const EntityFieldSchema = z.object({
  name: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});

/**
 * Schema for extracted line item
 */
const LineItemSchema = z.object({
  description: z.string().nullable(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  lineTotal: z.number().nullable(),
  taxAmount: z.number().nullable(),
  categoryName: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

/**
 * Schema for totals section
 */
const TotalsSchema = z.object({
  grandTotal: MoneyFieldSchema.nullable(),
  netAmount: MoneyFieldSchema.nullable(),
  taxAmount: MoneyFieldSchema.nullable(),
  tipAmount: MoneyFieldSchema.nullable(),
});

// ============================================================================
// Main extraction schema (v1)
// ============================================================================

/**
 * Main document extraction schema (version 1)
 *
 * Used for all document types. AI model returns this structure.
 */
export const DocumentExtractionV1Schema = z.object({
  schemaVersion: z.literal('v1').default('v1'),
  documentType: z.enum(['RECEIPT', 'INVOICE', 'BANK_STATEMENT', 'OTHER']),
  currencyCode: z.string().nullable(), // ISO 4217 (e.g., "USD", "EUR")
  transactionDate: z.string().nullable(), // ISO 8601 date string
  vendor: EntityFieldSchema.nullable(),
  client: EntityFieldSchema.nullable(),
  totals: TotalsSchema,
  lineItems: z.array(LineItemSchema),
  warnings: z.array(z.string()).default([]),
  overallConfidence: z.number().min(0).max(1),
});

export type DocumentExtractionV1 = z.infer<typeof DocumentExtractionV1Schema>;

// ============================================================================
// Confidence tier mapping (for UI display)
// ============================================================================

export type ConfidenceTier = 'high' | 'medium' | 'low';

/**
 * Convert numeric confidence (0-1) to tier label for UI
 */
export function getConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Get Tailwind color classes for confidence tier
 */
export function getConfidenceColorClasses(tier: ConfidenceTier): {
  badge: string;
  border: string;
  text: string;
} {
  switch (tier) {
    case 'high':
      return {
        badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        border: 'border-green-500',
        text: 'text-green-700 dark:text-green-400',
      };
    case 'medium':
      return {
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
        border: 'border-amber-500',
        text: 'text-amber-700 dark:text-amber-400',
      };
    case 'low':
      return {
        badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        border: 'border-red-500',
        text: 'text-red-700 dark:text-red-400',
      };
  }
}

// ============================================================================
// API request/response schemas
// ============================================================================

/**
 * Request schema for POST /extract endpoint
 */
export const ExtractDocumentRequestSchema = z.object({
  templateKey: z.enum(['standard_receipt', 'invoice', 'bank_statement_page', 'custom']).nullable().optional(),
  customPrompt: z.string().max(5000).nullable().optional(),
  provider: z.enum(['openai', 'gemini', 'anthropic']).optional(),
  modelName: z.string().max(100).optional(),
  documentTypeHint: z.enum(['RECEIPT', 'INVOICE', 'BANK_STATEMENT', 'OTHER']).optional(),
  localeHint: z.string().max(10).optional(), // e.g., "en-US"
});

export type ExtractDocumentRequest = z.infer<typeof ExtractDocumentRequestSchema>;

/**
 * Response schema for extraction endpoints
 */
export const ExtractionMetadataSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  status: z.enum(['RAW', 'REVIEWED_DRAFT', 'APPLIED']),
  templateKey: z.string().nullable(),
  customPrompt: z.string().nullable(),
  provider: z.enum(['openai', 'gemini', 'anthropic']),
  modelName: z.string(),
  overallConfidence: z.number().nullable(),
  summaryTotalAmount: z.number().nullable(),
  summaryCurrency: z.string().nullable(),
  summaryTransactionDate: z.string().nullable(), // ISO 8601
  isActive: z.boolean(),
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(), // ISO 8601
});

export type ExtractionMetadata = z.infer<typeof ExtractionMetadataSchema>;

/**
 * Full extraction response (includes payload)
 */
export const ExtractionResponseSchema = ExtractionMetadataSchema.extend({
  payload: DocumentExtractionV1Schema,
});

export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;
