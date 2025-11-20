/**
 * Type definitions and Zod schemas for SoloLedger API
 */

import { z } from "zod";

// ============================================================================
// Common Schemas
// ============================================================================

export const TransactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TransactionStatusSchema = z.enum(["DRAFT", "POSTED"]);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const DocumentTypeSchema = z.enum([
  "RECEIPT",
  "INVOICE",
  "BANK_STATEMENT",
  "OTHER",
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const BusinessTypeSchema = z.enum([
  "Freelance",
  "Consulting",
  "Agency",
  "SaaS",
  "Other",
]);
export type BusinessType = z.infer<typeof BusinessTypeSchema>;

export const DateFormatSchema = z.enum([
  "DD_MM_YYYY",
  "MM_DD_YYYY",
  "YYYY_MM_DD",
]);
export type DateFormat = z.infer<typeof DateFormatSchema>;

export const DecimalSeparatorSchema = z.enum(["DOT", "COMMA"]);
export type DecimalSeparator = z.infer<typeof DecimalSeparatorSchema>;

export const ThousandsSeparatorSchema = z.enum([
  "COMMA",
  "DOT",
  "SPACE",
  "NONE",
]);
export type ThousandsSeparator = z.infer<typeof ThousandsSeparatorSchema>;

/**
 * Array string schema helper
 *
 * Accepts both native arrays and stringified arrays from Claude Code's MCP client.
 * Claude Code serializes array parameters to JSON strings, so we need to parse them.
 *
 * Usage: ArrayStringSchema(z.string(), 1) for non-empty string arrays
 *
 * @param itemSchema - Zod schema for array items
 * @param min - Optional minimum array length (default: no minimum)
 * @returns Union schema that accepts both array and stringified array
 */
export function ArrayStringSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  min?: number
) {
  const arraySchema = min ? z.array(itemSchema).min(min) : z.array(itemSchema);

  return z.union([
    arraySchema,
    z.string().transform((val, ctx) => {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          return parsed;
        }
        // If parsed but not an array, wrap in array
        return [val];
      } catch {
        // If JSON parse fails, treat as single value
        return [val];
      }
    })
  ]).pipe(arraySchema);
}

// ============================================================================
// Transaction Schemas
// ============================================================================

export const TransactionFilterSchema = z.object({
  type: TransactionTypeSchema.optional(),
  status: TransactionStatusSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  clientId: z.string().optional(),
  vendorId: z.string().optional(),
  categoryIds: z.string().optional(), // Comma-separated
  amountMin: z.string().optional(),
  amountMax: z.string().optional(),
  currency: z.string().optional(),
});

export const CreateTransactionSchema = z.object({
  type: TransactionTypeSchema,
  status: TransactionStatusSchema,
  amountBase: z.number().positive(),
  amountSecondary: z.number().positive().optional(),
  currencySecondary: z.string().length(3).optional(),
  date: z.string(),
  description: z.string().min(1),
  categoryId: z.string(),
  accountId: z.string(),
  vendorId: z.string().optional(),
  vendorName: z.string().optional(),
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateTransactionSchema = CreateTransactionSchema.partial().extend(
  {
    allowSoftClosedOverride: z.boolean().optional(),
  }
);

export const BulkTransactionActionSchema = z.object({
  transactionIds: z.array(z.string()).min(1),
  action: z.enum(["changeCategory", "changeStatus", "delete"]),
  categoryId: z.string().optional(),
  status: TransactionStatusSchema.optional(),
  allowSoftClosedOverride: z.boolean().optional(),
});

export const TransactionDocumentsSchema = z.object({
  documentIds: z.array(z.string()).min(1),
});

export const ExportRangeSchema = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  type: TransactionTypeSchema.optional(),
  status: TransactionStatusSchema.optional(),
});

// ============================================================================
// Document Schemas
// ============================================================================

export const DocumentFilterSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  linked: z.enum(["all", "linked", "unlinked"]).optional(),
  vendorId: z.string().optional(),
  clientId: z.string().optional(),
  amountMin: z.string().optional(),
  amountMax: z.string().optional(),
  fileType: z.enum(["all", "image", "pdf", "text"]).optional(),
  uploaderId: z.string().optional(),
  q: z.string().optional(),
});

export const UpdateDocumentSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  type: DocumentTypeSchema.optional(),
  documentDate: z.string().optional().nullable(),
});

export const DocumentTransactionsSchema = z.object({
  transactionIds: z.array(z.string()).min(1),
});

export const AIExtractSchema = z.object({
  fields: z.array(z.string()).optional(),
  prompt: z.string().optional(),
});

// ============================================================================
// Category Schemas
// ============================================================================

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(255),
  type: TransactionTypeSchema,
  parentId: z.string().optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  includeInPnL: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export const ReorderCategoriesSchema = z.object({
  categories: z.array(
    z.object({
      id: z.string(),
      sortOrder: z.number().int().min(0),
    })
  ),
});

export const CategoryUsageFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const DeleteCategoryWithReassignmentSchema = z.object({
  newCategoryId: z.string(),
});

// ============================================================================
// Account Schemas
// ============================================================================

export const CreateAccountSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const UpdateAccountSchema = CreateAccountSchema.partial();

export const AccountBalancesFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

// ============================================================================
// Vendor/Client Schemas
// ============================================================================

export const CreateVendorSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const UpdateVendorSchema = CreateVendorSchema.partial();

export const MergeVendorSchema = z.object({
  sourceVendorId: z.string(),
  targetVendorId: z.string(),
});

export const VendorFilterSchema = z.object({
  query: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// Client schemas (same as vendor)
export const CreateClientSchema = CreateVendorSchema;
export const UpdateClientSchema = UpdateVendorSchema;
export const MergeClientSchema = z.object({
  sourceClientId: z.string(),
  targetClientId: z.string(),
});
export const ClientFilterSchema = VendorFilterSchema;

// ============================================================================
// Organization & Settings Schemas
// ============================================================================

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().optional(),
});

export const UpdateBusinessSettingsSchema = z.object({
  businessName: z.string().min(1).max(255),
  businessType: BusinessTypeSchema,
  businessTypeOther: z.string().optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  taxId: z.string().max(100).optional().nullable(),
});

export const UpdateFinancialSettingsSchema = z.object({
  baseCurrency: z.string().length(3),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  dateFormat: DateFormatSchema,
  decimalSeparator: DecimalSeparatorSchema,
  thousandsSeparator: ThousandsSeparatorSchema,
});

// ============================================================================
// Report Schemas
// ============================================================================

export const PnLReportSchema = z.object({
  dateMode: z
    .enum(["fiscalYear", "calendarYear", "ytd", "lastMonth", "custom"])
    .optional(),
  customFrom: z.string().optional(),
  customTo: z.string().optional(),
  detailLevel: z.enum(["summary", "detailed"]).optional(),
});

export const CategoryReportFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: TransactionTypeSchema.optional(),
});

export const VendorReportFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().positive().optional(),
});
