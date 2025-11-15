/**
 * Soft-closed period utilities
 *
 * Soft-closed periods prevent accidental changes to Posted transactions
 * before a certain date, ensuring previously reported figures remain stable.
 */

/**
 * Check if a transaction date falls within a soft-closed period
 *
 * @param transactionDate The date of the transaction
 * @param softClosedBefore The soft-closed cutoff date (transactions before this are soft-closed)
 * @returns true if the transaction is in a soft-closed period
 */
export function isInSoftClosedPeriod(
  transactionDate: Date,
  softClosedBefore: Date | null
): boolean {
  if (!softClosedBefore) {
    return false;
  }

  return transactionDate < softClosedBefore;
}
