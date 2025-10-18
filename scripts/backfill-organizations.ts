#!/usr/bin/env tsx

/**
 * Backfill script: Create default organizations for existing users
 *
 * For each user without any membership:
 * - Create Organization named "{UserName}'s workspace" with unique slug
 * - Create Membership as admin
 * - Set User.defaultOrganizationId
 *
 * Idempotent: skips users who already have memberships
 *
 * Usage: npx tsx scripts/backfill-organizations.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Generate a slug from a name
 * Converts to lowercase, replaces spaces with hyphens, removes special chars
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-")      // Replace spaces with hyphens
    .replace(/-+/g, "-")       // Replace multiple hyphens with single hyphen
    .substring(0, 50);          // Max 50 chars
}

/**
 * Generate a random alphanumeric suffix
 */
function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Check if slug exists
 */
async function slugExists(slug: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { slug },
  });
  return !!org;
}

/**
 * Generate a unique slug, appending random suffix if needed
 */
async function generateUniqueSlug(baseName: string): Promise<string> {
  let slug = generateSlug(baseName);

  // Check if slug is available
  if (!(await slugExists(slug))) {
    return slug;
  }

  // If taken, try with random suffix
  let attempts = 0;
  while (attempts < 10) {
    const suffixedSlug = `${slug}-${randomSuffix()}`;
    if (!(await slugExists(suffixedSlug))) {
      return suffixedSlug;
    }
    attempts++;
  }

  // Fallback: use timestamp
  return `${slug}-${Date.now()}`;
}

async function main(): Promise<void> {
  console.log("Starting organization backfill for existing users...\n");

  // Find all users without memberships
  const usersWithoutOrgs = await prisma.user.findMany({
    where: {
      memberships: {
        none: {},
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (usersWithoutOrgs.length === 0) {
    console.log("✓ No users need backfilling. All users have organizations.");
    return;
  }

  console.log(`Found ${usersWithoutOrgs.length} user(s) without organizations.\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const user of usersWithoutOrgs) {
    try {
      // Generate organization name
      const userName = user.name || user.email.split("@")[0];
      const orgName = `${userName}'s workspace`;

      // Generate unique slug
      const slug = await generateUniqueSlug(`${userName}-workspace`);

      console.log(`Processing user: ${user.email}`);
      console.log(`  Creating organization: "${orgName}" (slug: ${slug})`);

      // Create organization, membership, and update user in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create organization
        const org = await tx.organization.create({
          data: {
            name: orgName,
            slug,
            createdById: user.id,
          },
        });

        // Create admin membership
        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: "admin",
          },
        });

        // Set as default organization
        await tx.user.update({
          where: { id: user.id },
          data: { defaultOrganizationId: org.id },
        });

        return org;
      });

      console.log(`  ✓ Created organization ${result.id}\n`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ Failed to create organization for ${user.email}:`);
      console.error(`    ${error instanceof Error ? error.message : String(error)}\n`);
      errorCount++;
    }
  }

  console.log("\nBackfill complete!");
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
}

main()
  .catch((error) => {
    console.error("Fatal error during backfill:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
