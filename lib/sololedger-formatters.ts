/**
 * Sololedger formatting utilities
 * Format dates and numbers based on organization settings
 */

import type { DateFormat, DecimalSeparator, ThousandsSeparator } from "@prisma/client";

/**
 * Format a date according to organization settings
 */
export function formatDate(
  date: Date | string,
  format: DateFormat
): string {
  const d = typeof date === "string" ? new Date(date) : date;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  switch (format) {
    case "DD_MM_YYYY":
      return `${day}/${month}/${year}`;
    case "MM_DD_YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY_MM_DD":
      return `${year}-${month}-${day}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * Format a number (amount) according to organization settings
 */
export function formatAmount(
  amount: number | string,
  decimalSeparator: DecimalSeparator,
  thousandsSeparator: ThousandsSeparator,
  decimalPlaces: number = 2
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(num)) {
    return "0.00";
  }

  // Split into integer and decimal parts
  const fixed = num.toFixed(decimalPlaces);
  const [integerPart, decimalPart] = fixed.split(".");

  // Add thousands separator to integer part
  let formattedInteger = integerPart;

  if (thousandsSeparator !== "NONE") {
    const separator = getSeparatorChar(thousandsSeparator);
    formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  }

  // Combine with decimal separator
  const decimalChar = getSeparatorChar(decimalSeparator);
  return `${formattedInteger}${decimalChar}${decimalPart}`;
}

/**
 * Format currency with symbol
 */
export function formatCurrency(
  amount: number | string,
  currency: string,
  decimalSeparator: DecimalSeparator,
  thousandsSeparator: ThousandsSeparator,
  decimalPlaces: number = 2
): string {
  const formatted = formatAmount(
    amount,
    decimalSeparator,
    thousandsSeparator,
    decimalPlaces
  );
  return `${currency} ${formatted}`;
}

/**
 * Parse a formatted amount back to a number
 * Handles different decimal and thousands separators
 */
export function parseAmount(
  formattedAmount: string,
  decimalSeparator: DecimalSeparator,
  thousandsSeparator: ThousandsSeparator
): number {
  let cleaned = formattedAmount.trim();

  // Remove currency symbols and extra spaces
  cleaned = cleaned.replace(/[A-Z]{3}\s*/g, "");

  // Remove thousands separator
  if (thousandsSeparator !== "NONE") {
    const separator = getSeparatorChar(thousandsSeparator);
    cleaned = cleaned.replace(new RegExp("\\" + separator, "g"), "");
  }

  // Replace decimal separator with dot
  const decimalChar = getSeparatorChar(decimalSeparator);
  if (decimalChar !== ".") {
    cleaned = cleaned.replace(decimalChar, ".");
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Get the actual character for a separator type
 */
function getSeparatorChar(
  separator: DecimalSeparator | ThousandsSeparator
): string {
  switch (separator) {
    case "DOT":
      return ".";
    case "COMMA":
      return ",";
    case "SPACE":
      return " ";
    case "NONE":
      return "";
    default:
      return ".";
  }
}

/**
 * Format a date range for display
 */
export function formatDateRange(
  startDate: Date | string,
  endDate: Date | string,
  format: DateFormat
): string {
  return `${formatDate(startDate, format)} - ${formatDate(endDate, format)}`;
}

/**
 * Get fiscal year date range based on settings
 */
export function getFiscalYearRange(
  fiscalYearStartMonth: number,
  currentDate: Date = new Date()
): { startDate: Date; endDate: Date } {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12

  let fiscalYear: number;

  // If we're past the fiscal year start month, we're in the current fiscal year
  // Otherwise, we're still in the previous fiscal year
  if (currentMonth >= fiscalYearStartMonth) {
    fiscalYear = currentYear;
  } else {
    fiscalYear = currentYear - 1;
  }

  const startDate = new Date(fiscalYear, fiscalYearStartMonth - 1, 1);
  const endDate = new Date(fiscalYear + 1, fiscalYearStartMonth - 1, 0); // Last day of month before next fiscal year

  return { startDate, endDate };
}

/**
 * Get Year-To-Date range based on fiscal year
 */
export function getYTDRange(
  fiscalYearStartMonth: number,
  currentDate: Date = new Date()
): { startDate: Date; endDate: Date } {
  const { startDate } = getFiscalYearRange(fiscalYearStartMonth, currentDate);
  return { startDate, endDate: currentDate };
}

/**
 * Format month name from number (1-12)
 */
export function formatMonth(month: number): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[month - 1] || "Unknown";
}

/**
 * Format a dual-currency transaction amount
 * Shows both base and secondary amounts if secondary exists
 */
export function formatDualCurrency(
  amountBase: number | string,
  currencyBase: string,
  amountSecondary: number | string | null | undefined,
  currencySecondary: string | null | undefined,
  decimalSeparator: DecimalSeparator,
  thousandsSeparator: ThousandsSeparator,
  decimalPlaces: number = 2
): string {
  const baseFormatted = formatCurrency(
    amountBase,
    currencyBase,
    decimalSeparator,
    thousandsSeparator,
    decimalPlaces
  );

  // If no secondary currency, just return base
  if (!amountSecondary || !currencySecondary) {
    return baseFormatted;
  }

  const secondaryFormatted = formatCurrency(
    amountSecondary,
    currencySecondary,
    decimalSeparator,
    thousandsSeparator,
    decimalPlaces
  );

  // Return both with secondary in parentheses
  return `${baseFormatted} (${secondaryFormatted})`;
}

/**
 * Format transaction amount with smart display
 * Primary display is always base currency, with optional secondary in parentheses
 */
export function formatTransactionAmount(
  transaction: {
    amountBase: number | string;
    currencyBase?: string | null;
    amountSecondary?: number | string | null;
    currencySecondary?: string | null;
  },
  baseCurrency: string,
  decimalSeparator: DecimalSeparator,
  thousandsSeparator: ThousandsSeparator,
  decimalPlaces: number = 2
): string {
  const effectiveCurrencyBase = transaction.currencyBase || baseCurrency;

  return formatDualCurrency(
    transaction.amountBase,
    effectiveCurrencyBase,
    transaction.amountSecondary,
    transaction.currencySecondary,
    decimalSeparator,
    thousandsSeparator,
    decimalPlaces
  );
}

/**
 * Get exchange rate from dual-currency transaction
 * Returns null if not a dual-currency transaction
 */
export function getExchangeRate(
  amountBase: number | string,
  amountSecondary: number | string | null | undefined
): number | null {
  if (!amountSecondary) return null;

  const base = typeof amountBase === "string" ? parseFloat(amountBase) : amountBase;
  const secondary = typeof amountSecondary === "string" ? parseFloat(amountSecondary) : amountSecondary;

  if (isNaN(base) || isNaN(secondary) || secondary === 0) return null;

  return base / secondary;
}

/**
 * Format exchange rate for display
 */
export function formatExchangeRate(
  rate: number | null,
  fromCurrency: string,
  toCurrency: string
): string | null {
  if (!rate) return null;
  return `1 ${fromCurrency} = ${rate.toFixed(8)} ${toCurrency}`;
}
