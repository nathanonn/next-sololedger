/**
 * Prompt templates for AI document extraction
 *
 * Provides predefined system and user prompts for different document types.
 * Templates ensure consistent extraction quality across different AI providers.
 */

export type TemplateKey = 'standard_receipt' | 'invoice' | 'bank_statement_page' | 'custom';

export interface PromptTemplate {
  key: TemplateKey;
  label: string;
  description: string;
  systemMessage: string;
  userIntro: string;
  extraInstructions?: string;
}

/**
 * Base system message shared across all templates
 */
const BASE_SYSTEM_MESSAGE = `You are a financial document extraction engine. Extract structured data from receipts, invoices, and financial statements with high accuracy.

CRITICAL RULES:
1. Use ISO 8601 date format (YYYY-MM-DD) for all dates
2. Use ISO 4217 currency codes (USD, EUR, GBP, etc.)
3. NEVER hallucinate or guess values - use null for unknown fields
4. Provide confidence scores (0.0 to 1.0) for all extracted fields
5. Extract exact amounts as shown on the document
6. Preserve original text in rawText fields when uncertain
7. Flag any discrepancies or warnings in the warnings array

CONFIDENCE SCORING GUIDE:
- High (0.8-1.0): Clear, unambiguous text; no OCR artifacts
- Medium (0.5-0.79): Some uncertainty or minor OCR issues
- Low (0.0-0.49): Poor quality, ambiguous, or heavily damaged text

AMOUNT EXTRACTION RULES:
- Grand total: Final amount to be paid/received
- Net amount: Pre-tax subtotal
- Tax amount: Total tax/VAT
- Tip amount: Gratuity (if separate)

LINE ITEM EXTRACTION:
- Extract each distinct product or service as a separate line item
- Include description, quantity, unit price, and line total
- Extract tax amounts per line if itemized
- Suggest category names based on item descriptions`;

/**
 * Standard receipt template
 */
const STANDARD_RECEIPT_TEMPLATE: PromptTemplate = {
  key: 'standard_receipt',
  label: 'Standard Receipt',
  description: 'For retail receipts, restaurant bills, and simple transactions',
  systemMessage: BASE_SYSTEM_MESSAGE,
  userIntro: `This is a retail receipt. Extract all transaction details including vendor name, date, total amount, line items, and tax information.

Common receipt sections to extract:
- Merchant/vendor name (often at top)
- Transaction date and time
- Individual line items (products/services)
- Subtotal, tax, tips, and grand total
- Payment method (if shown)

Pay special attention to:
- Multiple tax rates (if applicable)
- Discounts or promotional amounts
- Tip lines (common in restaurant receipts)`,
  extraInstructions: 'If the receipt shows multiple payment methods or split payments, note this in the warnings field.',
};

/**
 * Invoice template
 */
const INVOICE_TEMPLATE: PromptTemplate = {
  key: 'invoice',
  label: 'Invoice',
  description: 'For business invoices and bills',
  systemMessage: BASE_SYSTEM_MESSAGE,
  userIntro: `This is a business invoice. Extract all invoice details including vendor (biller), client (bill-to), invoice date, line items, and payment terms.

Common invoice sections to extract:
- Vendor/seller information (from address)
- Client/buyer information (bill-to or ship-to)
- Invoice number and date
- Due date (if shown)
- Detailed line items with descriptions, quantities, and rates
- Subtotals, taxes, discounts, and total due

Pay special attention to:
- Multiple tax rates or tax exemptions
- Volume discounts or early payment discounts
- Currency if operating internationally
- Net payment terms (e.g., Net 30)`,
  extraInstructions: 'If the invoice includes payment instructions or bank details, note their presence in warnings but do not extract sensitive banking information.',
};

/**
 * Bank statement page template
 */
const BANK_STATEMENT_PAGE_TEMPLATE: PromptTemplate = {
  key: 'bank_statement_page',
  label: 'Bank Statement Page',
  description: 'For bank statements and transaction lists',
  systemMessage: BASE_SYSTEM_MESSAGE,
  userIntro: `This is a bank statement or transaction list. Extract all visible transactions including dates, descriptions, and amounts.

Common statement sections to extract:
- Statement period dates
- Account information (sanitized)
- Individual transactions with dates, descriptions, debits, and credits
- Running balance (if shown)
- Summary totals (opening balance, closing balance)

Pay special attention to:
- Debit vs credit amounts (positive/negative)
- Transaction categories or codes
- Foreign currency transactions and exchange rates
- Pending vs posted transactions

IMPORTANT for bank statements:
- Extract each transaction as a separate line item
- Use negative amounts for debits/outflows
- Use positive amounts for credits/inflows
- Note the statement currency in currencyCode`,
  extraInstructions: 'Bank statements may span multiple pages. If this appears to be a partial extract, note it in warnings. Do NOT extract sensitive account numbers in full - only the last 4 digits if needed for reference.',
};

/**
 * Custom/flexible template
 */
const CUSTOM_TEMPLATE: PromptTemplate = {
  key: 'custom',
  label: 'Custom',
  description: 'Flexible extraction with user-provided instructions',
  systemMessage: BASE_SYSTEM_MESSAGE,
  userIntro: `Extract financial information from this document based on the custom instructions provided by the user.

Apply the same extraction rules for dates, currencies, amounts, and confidence scoring as defined in the system message.`,
  extraInstructions: 'Follow any additional custom instructions provided by the user to tailor the extraction to specific document formats or requirements.',
};

/**
 * All available templates
 */
export const PROMPT_TEMPLATES: Record<TemplateKey, PromptTemplate> = {
  standard_receipt: STANDARD_RECEIPT_TEMPLATE,
  invoice: INVOICE_TEMPLATE,
  bank_statement_page: BANK_STATEMENT_PAGE_TEMPLATE,
  custom: CUSTOM_TEMPLATE,
};

/**
 * Get template by key
 */
export function getPromptTemplate(key: TemplateKey): PromptTemplate {
  return PROMPT_TEMPLATES[key];
}

/**
 * Build complete system message with template
 */
export function buildSystemMessage(templateKey: TemplateKey): string {
  const template = getPromptTemplate(templateKey);
  return template.systemMessage;
}

/**
 * Build complete user message with template and custom prompt
 */
export function buildUserMessage(
  templateKey: TemplateKey,
  customPrompt?: string | null,
  documentTypeHint?: string,
  localeHint?: string,
): string {
  const template = getPromptTemplate(templateKey);

  let message = template.userIntro;

  // Add document type hint if provided and different from template
  if (documentTypeHint) {
    message += `\n\nDocument type hint: ${documentTypeHint}`;
  }

  // Add locale hint if provided
  if (localeHint) {
    message += `\n\nLocale/language hint: ${localeHint}`;
  }

  // Add extra instructions from template
  if (template.extraInstructions) {
    message += `\n\n${template.extraInstructions}`;
  }

  // Add custom user prompt if provided
  if (customPrompt && customPrompt.trim()) {
    message += `\n\nADDITIONAL CUSTOM INSTRUCTIONS:\n${customPrompt.trim()}`;
  }

  return message;
}

/**
 * Get list of all template options for UI dropdowns
 */
export function getTemplateOptions(): Array<{ value: TemplateKey; label: string; description: string }> {
  return Object.values(PROMPT_TEMPLATES).map((template) => ({
    value: template.key,
    label: template.label,
    description: template.description,
  }));
}
