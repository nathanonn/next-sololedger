/**
 * CSV Import for Transactions
 * Server-side only (Node runtime)
 *
 * Handles:
 * - CSV parsing with configurable delimiters and headers
 * - Column mapping to transaction fields
 * - Dual-currency support with type detection (column vs sign)
 * - Validation using organization settings
 * - Duplicate detection based on secondary/original amounts
 * - Vendor/client auto-creation
 */

import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";
import { isValidCurrencyCode } from "@/lib/currencies";
import { parseAmount } from "@/lib/sololedger-formatters";
import type {
  DateFormat,
  DecimalSeparator,
  ThousandsSeparator,
  TransactionType,
  OrganizationSettings,
} from "@prisma/client";

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Direction mode for determining transaction type
 */
export type DirectionMode = "type_column" | "sign_based";

/**
 * CSV column mapping configuration
 */
export interface CsvColumnMapping {
  date?: string;
  amount?: string;
  currency?: string;
  type?: string; // For type_column mode
  description?: string;
  category?: string;
  account?: string;
  vendor?: string;
  client?: string;
  notes?: string;
  tags?: string;
  secondaryAmount?: string;
  secondaryCurrency?: string;
}

/**
 * CSV parsing options
 */
export interface CsvParsingOptions {
  delimiter: string;
  headerRowIndex: number;
  hasHeaders: boolean;
  dateFormat: DateFormat;
  decimalSeparator: DecimalSeparator;
  thousandsSeparator: ThousandsSeparator;
  directionMode: DirectionMode;
}

/**
 * Full import template configuration
 */
export interface ImportTemplateConfig {
  columnMapping: CsvColumnMapping;
  parsingOptions: CsvParsingOptions;
}

/**
 * Raw CSV parsing result
 */
export interface ParsedCsvData {
  headers: string[];
  rows: string[][];
}

/**
 * Raw import row before normalization
 */
export interface RawImportRow {
  rowIndex: number;
  raw: string[];
  candidate: {
    directionSource: DirectionMode;
    dateRaw?: string;
    amountRaw?: string;
    currencyRaw?: string;
    typeRaw?: string;
    description?: string;
    categoryName?: string;
    accountName?: string;
    vendorName?: string;
    clientName?: string;
    notes?: string;
    tagsRaw?: string;
    secondaryAmountRaw?: string;
    secondaryCurrencyRaw?: string;
  };
}

/**
 * Normalized import row after validation
 */
export interface NormalizedImportRow {
  rowIndex: number;
  raw: string[];
  status: "valid" | "invalid";
  errors: string[];
  normalized?: {
    type: TransactionType;
    date: Date;
    amountBase: number;
    currencyBase: string;
    amountSecondary?: number;
    currencySecondary?: string;
    amountOriginal: number;
    currencyOriginal: string;
    exchangeRateToBase: number;
    description: string;
    categoryId: string;
    accountId: string;
    vendorId?: string;
    vendorName?: string;
    clientId?: string;
    clientName?: string;
    notes?: string;
    tagNames?: string[];
  };
  isDuplicateCandidate: boolean;
  duplicateMatches: DuplicateMatch[];
}

/**
 * Duplicate match information
 */
export interface DuplicateMatch {
  transactionId: string;
  date: Date;
  amount: number;
  currency: string;
  description: string;
  vendorName?: string;
  clientName?: string;
}

/**
 * Import preview summary
 */
export interface ImportPreviewSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCandidates: number;
}

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Parse CSV buffer to headers and rows
 */
export function parseCsvBuffer(
  buffer: Buffer,
  options: CsvParsingOptions
): ParsedCsvData {
  const { delimiter, headerRowIndex, hasHeaders } = options;

  try {
    // Parse CSV using csv-parse
    const records = parse(buffer, {
      delimiter,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as string[][];

    if (records.length === 0) {
      throw new Error("CSV file is empty");
    }

    let headers: string[];
    let dataRows: string[][];

    if (hasHeaders) {
      // Extract headers from specified row index
      if (headerRowIndex >= records.length) {
        throw new Error(
          `Header row index ${headerRowIndex} exceeds total rows ${records.length}`
        );
      }

      headers = records[headerRowIndex];
      // Data rows are everything after the header row
      dataRows = records.slice(headerRowIndex + 1);
    } else {
      // Generate generic headers (Column 1, Column 2, etc.)
      const columnCount = Math.max(...records.map((r) => r.length));
      headers = Array.from(
        { length: columnCount },
        (_, i) => `Column ${i + 1}`
      );
      dataRows = records;
    }

    return { headers, rows: dataRows };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse CSV: ${error.message}`);
    }
    throw new Error("Failed to parse CSV: Unknown error");
  }
}

// ============================================================================
// Mapping Application
// ============================================================================

/**
 * Apply column mapping to parsed CSV data
 */
export function applyColumnMapping(
  parsedData: ParsedCsvData,
  mapping: CsvColumnMapping,
  directionMode: DirectionMode
): RawImportRow[] {
  const { headers, rows } = parsedData;

  // Create a map of column names to indices
  const columnIndices: Record<string, number> = {};
  headers.forEach((header, index) => {
    columnIndices[header] = index;
  });

  const rawRows: RawImportRow[] = [];

  rows.forEach((row, index) => {
    const getValue = (mappedColumn?: string): string | undefined => {
      if (!mappedColumn || !columnIndices.hasOwnProperty(mappedColumn)) {
        return undefined;
      }
      const value = row[columnIndices[mappedColumn]];
      return value?.trim() || undefined;
    };

    rawRows.push({
      rowIndex: index,
      raw: row,
      candidate: {
        directionSource: directionMode,
        dateRaw: getValue(mapping.date),
        amountRaw: getValue(mapping.amount),
        currencyRaw: getValue(mapping.currency),
        typeRaw: getValue(mapping.type),
        description: getValue(mapping.description),
        categoryName: getValue(mapping.category),
        accountName: getValue(mapping.account),
        vendorName: getValue(mapping.vendor),
        clientName: getValue(mapping.client),
        notes: getValue(mapping.notes),
        tagsRaw: getValue(mapping.tags),
        secondaryAmountRaw: getValue(mapping.secondaryAmount),
        secondaryCurrencyRaw: getValue(mapping.secondaryCurrency),
      },
    });
  });

  return rawRows;
}

// ============================================================================
// Date Parsing
// ============================================================================

/**
 * Parse date string according to specified format
 */
function parseDate(dateStr: string, format: DateFormat): Date | null {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();
  let day: number, month: number, year: number;

  switch (format) {
    case "DD_MM_YYYY": {
      // Supports DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
      const match = cleaned.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
      if (!match) return null;
      day = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      year = parseInt(match[3], 10);
      break;
    }

    case "MM_DD_YYYY": {
      // Supports MM/DD/YYYY, MM-DD-YYYY, MM.DD.YYYY
      const match = cleaned.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
      if (!match) return null;
      month = parseInt(match[1], 10);
      day = parseInt(match[2], 10);
      year = parseInt(match[3], 10);
      break;
    }

    case "YYYY_MM_DD": {
      // Supports YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
      const match = cleaned.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})$/);
      if (!match) return null;
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      day = parseInt(match[3], 10);
      break;
    }

    default:
      return null;
  }

  // Validate ranges
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Create date (month is 0-indexed in JavaScript)
  const date = new Date(year, month - 1, day);

  // Verify the date is valid (handles invalid dates like Feb 30)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

// ============================================================================
// Normalization & Validation
// ============================================================================

/**
 * Normalize and validate import rows
 */
export async function normalizeAndValidateRows(
  rawRows: RawImportRow[],
  organizationId: string,
  settings: OrganizationSettings,
  parsingOptions: CsvParsingOptions
): Promise<NormalizedImportRow[]> {
  // Fetch organization lookup data
  const [categories, accounts] = await Promise.all([
    db.category.findMany({
      where: { organizationId, active: true },
      select: { id: true, name: true, type: true },
    }),
    db.account.findMany({
      where: { organizationId, active: true },
      select: { id: true, name: true },
    }),
  ]);

  // Create lookup maps (case-insensitive)
  const categoryMap = new Map(
    categories.map((c) => [c.name.toLowerCase(), c])
  );
  const accountMap = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));

  const normalizedRows: NormalizedImportRow[] = [];

  for (const rawRow of rawRows) {
    const { rowIndex, raw, candidate } = rawRow;
    const errors: string[] = [];

    // Validate required fields
    if (!candidate.dateRaw) {
      errors.push("Date is required");
    }

    if (!candidate.amountRaw) {
      errors.push("Amount is required");
    }

    if (!candidate.currencyRaw) {
      errors.push("Currency is required");
    }

    if (!candidate.description) {
      errors.push("Description is required");
    }

    if (!candidate.categoryName) {
      errors.push("Category is required");
    }

    if (!candidate.accountName) {
      errors.push("Account is required");
    }

    // Direction mode validation
    if (
      candidate.directionSource === "type_column" &&
      !candidate.typeRaw
    ) {
      errors.push("Type column is required when using type-based direction");
    }

    // If any required field is missing, mark as invalid
    if (errors.length > 0) {
      normalizedRows.push({
        rowIndex,
        raw,
        status: "invalid",
        errors,
        isDuplicateCandidate: false,
        duplicateMatches: [],
      });
      continue;
    }

    try {
      // Parse and validate date using parsingOptions format
      const date = parseDate(candidate.dateRaw!, parsingOptions.dateFormat);
      if (!date) {
        errors.push(
          `Invalid date format. Expected ${parsingOptions.dateFormat.replace(/_/g, "/")}`
        );
      }

      // Parse amount using parsingOptions separators
      let amountValue = parseAmount(
        candidate.amountRaw!,
        parsingOptions.decimalSeparator,
        parsingOptions.thousandsSeparator
      );

      // Determine transaction type and adjust amount if needed
      let type: TransactionType;
      if (candidate.directionSource === "type_column") {
        const typeNormalized = candidate.typeRaw!.trim().toUpperCase();
        if (typeNormalized === "INCOME" || typeNormalized === "IN") {
          type = "INCOME";
        } else if (typeNormalized === "EXPENSE" || typeNormalized === "EXP" || typeNormalized === "OUT") {
          type = "EXPENSE";
        } else {
          errors.push(
            `Invalid type "${candidate.typeRaw}". Expected: INCOME or EXPENSE`
          );
          type = "EXPENSE"; // Default
        }
        // Ensure amount is positive
        amountValue = Math.abs(amountValue);
      } else {
        // Sign-based mode
        if (amountValue < 0) {
          type = "EXPENSE";
          amountValue = Math.abs(amountValue);
        } else if (amountValue > 0) {
          type = "INCOME";
        } else {
          errors.push("Amount cannot be zero");
          type = "EXPENSE"; // Default
        }
      }

      // Validate amount is positive
      if (amountValue <= 0) {
        errors.push("Amount must be greater than zero");
      }

      // Validate currency
      const currency = candidate.currencyRaw!.trim().toUpperCase();
      if (!isValidCurrencyCode(currency)) {
        errors.push(`Invalid currency code "${currency}"`);
      }

      // Validate secondary currency if provided
      let secondaryAmount: number | undefined;
      let secondaryCurrency: string | undefined;
      if (candidate.secondaryAmountRaw || candidate.secondaryCurrencyRaw) {
        // Both must be present
        if (!candidate.secondaryAmountRaw) {
          errors.push("Secondary amount is required when secondary currency is provided");
        }
        if (!candidate.secondaryCurrencyRaw) {
          errors.push("Secondary currency is required when secondary amount is provided");
        }

        if (candidate.secondaryAmountRaw && candidate.secondaryCurrencyRaw) {
          secondaryAmount = parseAmount(
            candidate.secondaryAmountRaw,
            parsingOptions.decimalSeparator,
            parsingOptions.thousandsSeparator
          );
          secondaryAmount = Math.abs(secondaryAmount);

          if (secondaryAmount <= 0) {
            errors.push("Secondary amount must be greater than zero");
          }

          secondaryCurrency = candidate.secondaryCurrencyRaw.trim().toUpperCase();
          if (!isValidCurrencyCode(secondaryCurrency)) {
            errors.push(`Invalid secondary currency code "${secondaryCurrency}"`);
          }
        }
      }

      // Resolve category
      const category = categoryMap.get(candidate.categoryName!.toLowerCase());
      if (!category) {
        errors.push(
          `Category "${candidate.categoryName}" not found in organization`
        );
      }

      // Validate category type matches transaction type
      if (category && category.type !== type) {
        errors.push(
          `Category "${candidate.categoryName}" is ${category.type} but transaction is ${type}`
        );
      }

      // Resolve account
      const account = accountMap.get(candidate.accountName!.toLowerCase());
      if (!account) {
        errors.push(
          `Account "${candidate.accountName}" not found in organization`
        );
      }

      // Parse tags
      let tagNames: string[] | undefined;
      if (candidate.tagsRaw) {
        tagNames = candidate.tagsRaw
          .split(";")
          .map((t) => t.trim())
          .filter(Boolean);
      }

      // If there are validation errors, mark as invalid
      if (errors.length > 0) {
        normalizedRows.push({
          rowIndex,
          raw,
          status: "invalid",
          errors,
          isDuplicateCandidate: false,
          duplicateMatches: [],
        });
        continue;
      }

      // Determine base vs original amounts based on baseCurrency
      let amountBase: number;
      let currencyBase: string;
      let amountSecondary: number | undefined;
      let currencySecondary: string | undefined;
      let amountOriginal: number;
      let currencyOriginal: string;
      let exchangeRateToBase: number;

      // If there's a secondary currency, determine which is base
      if (secondaryAmount && secondaryCurrency) {
        if (secondaryCurrency === settings.baseCurrency) {
          // Secondary is actually the base
          amountBase = secondaryAmount;
          currencyBase = secondaryCurrency;
          amountSecondary = amountValue;
          currencySecondary = currency;
          amountOriginal = amountValue;
          currencyOriginal = currency;
          exchangeRateToBase = amountBase / amountOriginal;
        } else {
          // Primary is the base
          amountBase = amountValue;
          currencyBase = currency;
          amountSecondary = secondaryAmount;
          currencySecondary = secondaryCurrency;
          amountOriginal = amountValue;
          currencyOriginal = currency;
          exchangeRateToBase = 1.0;
        }
      } else {
        // Single currency transaction
        amountBase = amountValue;
        currencyBase = currency;
        amountOriginal = amountValue;
        currencyOriginal = currency;
        exchangeRateToBase = 1.0;
      }

      normalizedRows.push({
        rowIndex,
        raw,
        status: "valid",
        errors: [],
        normalized: {
          type,
          date: date!,
          amountBase,
          currencyBase,
          amountSecondary,
          currencySecondary,
          amountOriginal,
          currencyOriginal,
          exchangeRateToBase,
          description: candidate.description!,
          categoryId: category!.id,
          accountId: account!.id,
          vendorName: candidate.vendorName,
          clientName: candidate.clientName,
          notes: candidate.notes,
          tagNames,
        },
        isDuplicateCandidate: false,
        duplicateMatches: [],
      });
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "Unknown validation error"
      );
      normalizedRows.push({
        rowIndex,
        raw,
        status: "invalid",
        errors,
        isDuplicateCandidate: false,
        duplicateMatches: [],
      });
    }
  }

  return normalizedRows;
}

// ============================================================================
// Duplicate Detection
// ============================================================================

const DUPLICATE_DATE_WINDOW_DAYS = 2;
const DUPLICATE_AMOUNT_EPSILON = 0.01;

/**
 * Detect duplicates for normalized import rows
 */
export async function detectDuplicates(
  normalizedRows: NormalizedImportRow[],
  organizationId: string
): Promise<NormalizedImportRow[]> {
  // Only check valid rows
  const validRows = normalizedRows.filter((r) => r.status === "valid");
  if (validRows.length === 0) {
    return normalizedRows;
  }

  // Determine date range for the import
  const dates = validRows.map((r) => r.normalized!.date);
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  // Add window padding
  const searchStartDate = new Date(minDate);
  searchStartDate.setDate(searchStartDate.getDate() - DUPLICATE_DATE_WINDOW_DAYS);
  const searchEndDate = new Date(maxDate);
  searchEndDate.setDate(searchEndDate.getDate() + DUPLICATE_DATE_WINDOW_DAYS);

  // Fetch candidate transactions from the database
  const candidateTransactions = await db.transaction.findMany({
    where: {
      organizationId,
      deletedAt: null,
      date: {
        gte: searchStartDate,
        lte: searchEndDate,
      },
    },
    include: {
      vendor: true,
      client: true,
    },
  });

  // Check each valid row for duplicates
  for (const row of validRows) {
    const { normalized } = row;
    if (!normalized) continue;

    const matches: DuplicateMatch[] = [];

    // Prefer secondary/original for matching
    const matchAmount = normalized.amountSecondary ?? normalized.amountBase;
    const matchCurrency =
      normalized.currencySecondary ?? normalized.currencyBase;

    for (const existingTx of candidateTransactions) {
      // Check if dates are within window
      const daysDiff = Math.abs(
        (normalized.date.getTime() - existingTx.date.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysDiff > DUPLICATE_DATE_WINDOW_DAYS) continue;

      // Get existing transaction's match amount/currency
      const existingMatchAmount =
        existingTx.amountSecondary !== null
          ? Number(existingTx.amountSecondary)
          : Number(existingTx.amountBase);
      const existingMatchCurrency =
        existingTx.currencySecondary || existingTx.currencyBase || "";

      // Check currency match
      if (matchCurrency !== existingMatchCurrency) continue;

      // Check amount match (within epsilon)
      const amountDiff = Math.abs(matchAmount - existingMatchAmount);
      if (amountDiff > DUPLICATE_AMOUNT_EPSILON) continue;

      // Condition A: Same date + same amount + same vendor
      let isConditionA = false;
      if (
        daysDiff === 0 &&
        amountDiff <= DUPLICATE_AMOUNT_EPSILON
      ) {
        // Check vendor match
        const importVendorName = normalized.vendorName?.toLowerCase().trim();
        const existingVendorName =
          existingTx.vendorName?.toLowerCase().trim() ||
          existingTx.vendor?.name.toLowerCase().trim();

        if (importVendorName && existingVendorName && importVendorName === existingVendorName) {
          isConditionA = true;
        }
      }

      // Condition B: Same amount + identical description within ±2 days
      let isConditionB = false;
      if (
        daysDiff <= DUPLICATE_DATE_WINDOW_DAYS &&
        amountDiff <= DUPLICATE_AMOUNT_EPSILON
      ) {
        const importDesc = normalized.description.toLowerCase().trim();
        const existingDesc = existingTx.description.toLowerCase().trim();

        if (importDesc === existingDesc) {
          isConditionB = true;
        }
      }

      if (isConditionA || isConditionB) {
        matches.push({
          transactionId: existingTx.id,
          date: existingTx.date,
          amount: existingMatchAmount,
          currency: existingMatchCurrency,
          description: existingTx.description,
          vendorName: existingTx.vendorName || existingTx.vendor?.name,
          clientName: existingTx.clientName || existingTx.client?.name,
        });
      }
    }

    // Update row with duplicate information
    row.isDuplicateCandidate = matches.length > 0;
    row.duplicateMatches = matches.slice(0, 5); // Cap to 5 matches for display
  }

  return normalizedRows;
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Generate import preview summary
 */
export function generateImportSummary(
  normalizedRows: NormalizedImportRow[]
): ImportPreviewSummary {
  const totalRows = normalizedRows.length;
  const validRows = normalizedRows.filter((r) => r.status === "valid").length;
  const invalidRows = normalizedRows.filter(
    (r) => r.status === "invalid"
  ).length;
  const duplicateCandidates = normalizedRows.filter(
    (r) => r.isDuplicateCandidate
  ).length;

  return {
    totalRows,
    validRows,
    invalidRows,
    duplicateCandidates,
  };
}
