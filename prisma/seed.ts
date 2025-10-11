#!/usr/bin/env tsx
/**
 * Prisma Database Seed
 * Creates the first user account with password
 *
 * Usage:
 *   SEED_EMAIL=admin@example.com SEED_PASSWORD=yourpassword npm run seed
 *
 * Or run interactively:
 *   npm run seed
 */

import { PrismaClient } from "@prisma/client/index.js";
import bcrypt from "bcrypt";
import readline from "readline";

const prisma = new PrismaClient();

async function promptInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function promptPassword(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Hide password input
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    let password = "";
    process.stdin.on("data", (char) => {
      const charStr = char.toString("utf8");
      if (charStr === "\n" || charStr === "\r" || charStr === "\u0004") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\n");
        rl.close();
        resolve(password);
      } else if (charStr === "\u0003") {
        process.exit();
      } else if (charStr === "\u007f") {
        // Backspace
        password = password.slice(0, -1);
        process.stdout.write("\b \b");
      } else {
        password += charStr;
        process.stdout.write("*");
      }
    });
  });
}

async function main() {
  console.log("🌱 Seeding database...\n");

  // Get email and password from environment or prompt
  let email = process.env.SEED_EMAIL;
  let password = process.env.SEED_PASSWORD;
  let name = process.env.SEED_NAME;

  if (!email) {
    email = await promptInput("Email: ");
  }

  if (!email || !email.trim()) {
    console.error("❌ Email is required");
    process.exit(1);
  }

  email = email.toLowerCase().trim();

  if (!password) {
    password = await promptPassword("Password: ");
  }

  if (!password || password.length < 8) {
    console.error("❌ Password must be at least 8 characters");
    process.exit(1);
  }

  if (!name) {
    name = await promptInput("Name (optional): ");
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log(`\n⚠️  User ${email} already exists.`);
    const update = await promptInput("Update password? (y/N): ");

    if (update.toLowerCase() !== "y") {
      console.log("✅ Seed cancelled");
      return;
    }

    // Update existing user
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        emailVerifiedAt: new Date(),
        ...(name && name.trim() ? { name: name.trim() } : {}),
      },
    });

    console.log(`✅ Updated user: ${email}`);
  } else {
    // Create new user
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        emailVerifiedAt: new Date(),
        role: "user",
        sessionVersion: 1,
        ...(name && name.trim() ? { name: name.trim() } : {}),
      },
    });

    console.log(`✅ Created user: ${user.email}`);
  }

  console.log("\n🎉 Seed complete!");
  console.log("\nNext steps:");
  console.log("  1. Add this email to ALLOWED_EMAILS in .env");
  console.log("  2. Set ENABLE_DEV_PASSWORD_SIGNIN=true in .env");
  console.log("  3. Visit http://localhost:3000/login");
  console.log("  4. Sign in with your email and password\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
