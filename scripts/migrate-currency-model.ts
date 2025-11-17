/**
 * Migration Script: Exchange-Rate Model to Dual-Currency Model
 *
 * This script migrates transaction data from the legacy exchange-rate-centric
 * model to the new explicit dual-currency model.
 *
 * Usage:
 *   npx tsx scripts/migrate-currency-model.ts [options]
 *
 * Options:
 *   --dry-run       Log planned updates without writing to database
 *   --batch-size N  Number of transactions to process per batch (default: 100)
 *   --org-id ID     Only migrate transactions for a specific organization
 *
 * Example:
 *   npx tsx scripts/migrate-currency-model.ts --dry-run
 *   npx tsx scripts/migrate-currency-model.ts --batch-size 50
 */

import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

interface MigrationStats {
  totalOrgs: number;
  totalTransactions: number;
  baseOnlyTransactions: number;
  dualCurrencyTransactions: number;
  skippedTransactions: number;
  errors: number;
}

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  orgId?: string;
}

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: args.includes("--dry-run"),
    batchSize: 100,
  };

  const batchSizeIndex = args.indexOf("--batch-size");
  if (batchSizeIndex !== -1 && args[batchSizeIndex + 1]) {
    options.batchSize = parseInt(args[batchSizeIndex + 1], 10);
    if (isNaN(options.batchSize) || options.batchSize < 1) {
      console.error("Invalid batch size. Using default: 100");
      options.batchSize = 100;
    }
  }

  const orgIdIndex = args.indexOf("--org-id");
  if (orgIdIndex !== -1 && args[orgIdIndex + 1]) {
    options.orgId = args[orgIdIndex + 1];
  }

  return options;
}

async function migrateTransactions(
  options: MigrationOptions
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalOrgs: 0,
    totalTransactions: 0,
    baseOnlyTransactions: 0,
    dualCurrencyTransactions: 0,
    skippedTransactions: 0,
    errors: 0,
  };

  console.log("\n🚀 Starting currency model migration...\n");
  console.log(`Mode: ${options.dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Batch size: ${options.batchSize}`);
  if (options.orgId) {
    console.log(`Filtering by org ID: ${options.orgId}`);
  }
  console.log("\n");

  // Load organizations with their base currency
  const orgsWhere = options.orgId ? { id: options.orgId } : {};
  const organizations = await prisma.organization.findMany({
    where: orgsWhere,
    include: {
      settings: {
        select: {
          baseCurrency: true,
        },
      },
    },
  });

  stats.totalOrgs = organizations.length;
  console.log(`📊 Found ${organizations.length} organization(s)\n`);

  for (const org of organizations) {
    if (!org.settings?.baseCurrency) {
      console.warn(
        `⚠️  Org ${org.slug} (${org.id}) has no base currency set. Skipping.`
      );
      continue;
    }

    const baseCurrency = org.settings.baseCurrency.toUpperCase();
    console.log(
      `\n🏢 Processing: ${org.name} (${org.slug}) - Base currency: ${baseCurrency}`
    );

    let offset = 0;
    let processedCount = 0;
    let orgBaseOnly = 0;
    let orgDualCurrency = 0;
    let orgSkipped = 0;
    let orgErrors = 0;

    while (true) {
      // Fetch batch of transactions
      const transactions = await prisma.transaction.findMany({
        where: {
          organizationId: org.id,
        },
        orderBy: {
          createdAt: "asc",
        },
        skip: offset,
        take: options.batchSize,
      });

      if (transactions.length === 0) {
        break;
      }

      // Process each transaction
      for (const txn of transactions) {
        try {
          const currencyOriginal = txn.currencyOriginal.toUpperCase();
          const amountOriginal = txn.amountOriginal;
          const amountBase = txn.amountBase;
          const exchangeRateToBase = txn.exchangeRateToBase;

          // Determine new field values based on transformation rules
          let newCurrencyBase: string;
          let newAmountBase: Decimal;
          let newAmountSecondary: Decimal | null;
          let newCurrencySecondary: string | null;

          if (currencyOriginal === baseCurrency) {
            // Base-only transaction
            newCurrencyBase = baseCurrency;
            newAmountBase = amountOriginal;
            newAmountSecondary = null;
            newCurrencySecondary = null;
            orgBaseOnly++;
          } else {
            // Dual-currency transaction
            newCurrencyBase = baseCurrency;
            newAmountBase = amountBase; // Keep existing base amount
            newAmountSecondary = amountOriginal;
            newCurrencySecondary = currencyOriginal;
            orgDualCurrency++;

            // Optional: Log discrepancies between stored amountBase and calculated value
            const calculatedBase = Number(amountOriginal) * Number(exchangeRateToBase);
            const storedBase = Number(amountBase);
            const epsilon = 0.01; // Allow 1 cent difference due to rounding

            if (Math.abs(calculatedBase - storedBase) > epsilon) {
              console.warn(
                `  ⚠️  Transaction ${txn.id}: Stored base (${storedBase}) differs from calculated (${calculatedBase.toFixed(2)})`
              );
            }
          }

          if (options.dryRun) {
            // Dry run: just log
            if (processedCount < 3) {
              // Log first 3 samples
              console.log(`  [Sample] Transaction ${txn.id}:`);
              console.log(`    Original: ${amountOriginal} ${currencyOriginal}`);
              console.log(
                `    New base: ${newAmountBase} ${newCurrencyBase}`
              );
              if (newAmountSecondary && newCurrencySecondary) {
                console.log(
                  `    New secondary: ${newAmountSecondary} ${newCurrencySecondary}`
                );
              }
            }
          } else {
            // Live mode: update the transaction
            await prisma.transaction.update({
              where: { id: txn.id },
              data: {
                currencyBase: newCurrencyBase,
                amountBase: newAmountBase,
                amountSecondary: newAmountSecondary,
                currencySecondary: newCurrencySecondary,
              },
            });
          }

          processedCount++;
        } catch (error) {
          console.error(`  ❌ Error processing transaction ${txn.id}:`, error);
          orgErrors++;
        }
      }

      offset += options.batchSize;

      // Progress indicator
      if (processedCount % 500 === 0) {
        console.log(`  ... processed ${processedCount} transactions`);
      }
    }

    console.log(
      `  ✅ Completed: ${processedCount} transactions (${orgBaseOnly} base-only, ${orgDualCurrency} dual-currency, ${orgErrors} errors)`
    );

    stats.totalTransactions += processedCount;
    stats.baseOnlyTransactions += orgBaseOnly;
    stats.dualCurrencyTransactions += orgDualCurrency;
    stats.skippedTransactions += orgSkipped;
    stats.errors += orgErrors;
  }

  return stats;
}

async function main() {
  const options = parseArgs();

  try {
    const stats = await migrateTransactions(options);

    console.log("\n" + "=".repeat(60));
    console.log("📈 Migration Summary");
    console.log("=".repeat(60));
    console.log(`Organizations:           ${stats.totalOrgs}`);
    console.log(`Total transactions:      ${stats.totalTransactions}`);
    console.log(`  - Base-only:           ${stats.baseOnlyTransactions}`);
    console.log(`  - Dual-currency:       ${stats.dualCurrencyTransactions}`);
    console.log(`  - Skipped:             ${stats.skippedTransactions}`);
    console.log(`  - Errors:              ${stats.errors}`);
    console.log("=".repeat(60));

    if (options.dryRun) {
      console.log(
        "\n✨ Dry run complete. No changes were written to the database."
      );
      console.log(
        "   Run without --dry-run to apply changes.\n"
      );
    } else {
      console.log("\n✨ Migration complete!\n");
    }

    process.exit(stats.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
