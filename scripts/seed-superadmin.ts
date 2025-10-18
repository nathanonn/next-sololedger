#!/usr/bin/env tsx

/**
 * Seed script: Create or promote a user to superadmin
 *
 * Reads SEED_EMAIL from environment and:
 * - Creates user if doesn't exist
 * - Updates role to 'superadmin'
 * - Increments sessionVersion to invalidate existing sessions
 *
 * Usage: npx tsx scripts/seed-superadmin.ts
 *
 * IMPORTANT: This script grants full system access. Use with caution!
 */

import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Superadmin Seed Script");
  console.log("======================\n");

  // Get email from environment
  const email = process.env.SEED_EMAIL;

  if (!email) {
    console.error("❌ Error: SEED_EMAIL environment variable is required");
    console.error("\nPlease set SEED_EMAIL in your .env file:");
    console.error("  SEED_EMAIL=admin@example.com\n");
    process.exit(1);
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`❌ Error: Invalid email format: ${email}\n`);
    process.exit(1);
  }

  console.log(`Email: ${email}\n`);

  // Warning prompt
  console.log("⚠️  WARNING: This will grant full superadmin privileges!");
  console.log("   Superadmins can:");
  console.log("   - Access ALL organizations without membership");
  console.log("   - Create organizations bypassing all limits");
  console.log("   - Manage ALL members and settings\n");

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Upsert user with superadmin role
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        role: "superadmin",
        sessionVersion: {
          increment: 1, // Invalidate existing sessions
        },
      },
      create: {
        email: normalizedEmail,
        role: "superadmin",
        sessionVersion: 1,
        emailVerifiedAt: new Date(),
      },
    });

    console.log("✅ Success! Superadmin user configured:");
    console.log(`   ID:      ${user.id}`);
    console.log(`   Email:   ${user.email}`);
    console.log(`   Role:    ${user.role}`);
    console.log(`   Version: ${user.sessionVersion}\n`);

    console.log("📝 Next steps:");
    console.log("   1. Sign in using email OTP or dev password signin");
    console.log("   2. You will have access to all organizations");
    console.log("   3. You can create organizations without limits\n");

    if (user.sessionVersion > 1) {
      console.log("⚠️  Note: Existing sessions have been invalidated.");
      console.log("   The user will need to sign in again.\n");
    }
  } catch (error) {
    console.error("❌ Failed to create/update superadmin:");
    console.error(error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error("Fatal error during superadmin seed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
