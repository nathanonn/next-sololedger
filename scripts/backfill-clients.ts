#!/usr/bin/env tsx
/**
 * Backfill script: Migrate income transactions from vendors to clients
 *
 * This script:
 * 1. Finds all INCOME transactions with vendor data
 * 2. Creates Client records from vendors used on income transactions
 * 3. Updates income transactions to link to clients instead of vendors
 *
 * Run: npx tsx scripts/backfill-clients.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface VendorInfo {
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

async function backfillClients() {
  console.log("🚀 Starting client backfill migration...\n");

  try {
    // Get all organizations
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
    });

    console.log(`Found ${organizations.length} organization(s) to process\n`);

    let totalClientsCreated = 0;
    let totalTransactionsUpdated = 0;

    for (const org of organizations) {
      console.log(`📂 Processing organization: ${org.name} (${org.slug})`);

      // Find all distinct INCOME transactions with vendor data
      const incomeTransactions = await prisma.transaction.findMany({
        where: {
          organizationId: org.id,
          type: "INCOME",
          deletedAt: null,
          OR: [
            { vendorName: { not: null } },
            { vendorId: { not: null } },
          ],
        },
        select: {
          id: true,
          vendorId: true,
          vendorName: true,
          vendor: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              notes: true,
            },
          },
        },
      });

      console.log(`  Found ${incomeTransactions.length} income transaction(s) with vendor data`);

      if (incomeTransactions.length === 0) {
        console.log(`  ✓ No income transactions to migrate\n`);
        continue;
      }

      // Group transactions by vendor name (normalized)
      const vendorMap = new Map<string, { vendorInfo: VendorInfo; transactionIds: string[] }>();

      for (const tx of incomeTransactions) {
        // Prefer vendorName from transaction, fallback to vendor.name
        const vendorName = tx.vendorName || tx.vendor?.name;
        if (!vendorName) continue;

        const nameLower = vendorName.toLowerCase().trim();

        if (!vendorMap.has(nameLower)) {
          vendorMap.set(nameLower, {
            vendorInfo: {
              name: vendorName,
              email: tx.vendor?.email,
              phone: tx.vendor?.phone,
              notes: tx.vendor?.notes,
            },
            transactionIds: [],
          });
        }

        vendorMap.get(nameLower)!.transactionIds.push(tx.id);
      }

      console.log(`  Found ${vendorMap.size} distinct vendor(s) to convert to clients`);

      // Process each vendor -> client conversion
      for (const [nameLower, { vendorInfo, transactionIds }] of vendorMap.entries()) {
        // Check if client already exists
        let client = await prisma.client.findUnique({
          where: {
            organizationId_nameLower: {
              organizationId: org.id,
              nameLower,
            },
          },
        });

        if (!client) {
          // Create new client
          client = await prisma.client.create({
            data: {
              organizationId: org.id,
              name: vendorInfo.name,
              nameLower,
              email: vendorInfo.email,
              phone: vendorInfo.phone,
              notes: vendorInfo.notes,
              active: true,
            },
          });

          console.log(`    ✓ Created client: "${client.name}"`);
          totalClientsCreated++;
        } else {
          console.log(`    ℹ Client already exists: "${client.name}"`);
        }

        // Update transactions to link to client
        await prisma.transaction.updateMany({
          where: {
            id: { in: transactionIds },
          },
          data: {
            clientId: client.id,
            clientName: client.name,
            // Note: We keep vendorId/vendorName for legacy/debugging
          },
        });

        console.log(`    ✓ Updated ${transactionIds.length} transaction(s) to use client "${client.name}"`);
        totalTransactionsUpdated += transactionIds.length;
      }

      console.log(`  ✓ Completed organization: ${org.name}\n`);
    }

    console.log("✅ Backfill migration completed successfully!");
    console.log(`   Total clients created: ${totalClientsCreated}`);
    console.log(`   Total transactions updated: ${totalTransactionsUpdated}`);
  } catch (error) {
    console.error("❌ Error during backfill migration:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
backfillClients()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
