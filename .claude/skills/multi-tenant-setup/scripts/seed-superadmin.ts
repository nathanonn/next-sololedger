/**
 * Seed Superadmin User
 *
 * Creates or promotes a user to superadmin role.
 * Run this script after setting up multi-tenant support to create your first superadmin.
 *
 * Usage:
 *   npx tsx scripts/seed-superadmin.ts <email>
 *
 * Example:
 *   npx tsx scripts/seed-superadmin.ts admin@example.com
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function seedSuperadmin(email: string) {
  try {
    console.log(`\n🔍 Looking for user: ${email}`)

    // Find or create user
    let user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, role: true, name: true }
    })

    if (!user) {
      console.log(`\n📝 User not found. Creating new user...`)

      user = await db.user.create({
        data: {
          email: email.toLowerCase(),
          role: 'superadmin',
          emailVerifiedAt: new Date()
        },
        select: { id: true, email: true, role: true, name: true }
      })

      console.log(`✅ Created new superadmin user:`)
      console.log(`   Email: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`\n⚠️  Note: User has no password. Use dev signin or set via email OTP flow.`)
    } else if (user.role === 'superadmin') {
      console.log(`\n✅ User is already a superadmin:`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Name: ${user.name || 'Not set'}`)
      console.log(`   ID: ${user.id}`)
    } else {
      console.log(`\n⬆️  Promoting user to superadmin...`)

      user = await db.user.update({
        where: { id: user.id },
        data: { role: 'superadmin' },
        select: { id: true, email: true, role: true, name: true }
      })

      console.log(`✅ Promoted user to superadmin:`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Previous role: user`)
      console.log(`   New role: ${user.role}`)
    }

    // Log audit event
    await db.auditLog.create({
      data: {
        action: 'superadmin_seeded',
        userId: user.id,
        email: user.email,
        metadata: {
          source: 'seed-superadmin script'
        }
      }
    })

    console.log(`\n📋 Audit log created`)
    console.log(`\n✨ Done!\n`)
  } catch (error) {
    console.error(`\n❌ Error:`, error)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

// Parse command line args
const email = process.argv[2]

if (!email) {
  console.error(`\n❌ Error: Email required`)
  console.log(`\nUsage: npx tsx scripts/seed-superadmin.ts <email>`)
  console.log(`Example: npx tsx scripts/seed-superadmin.ts admin@example.com\n`)
  process.exit(1)
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!emailRegex.test(email)) {
  console.error(`\n❌ Error: Invalid email format`)
  console.log(`\nPlease provide a valid email address.\n`)
  process.exit(1)
}

// Run
seedSuperadmin(email)
