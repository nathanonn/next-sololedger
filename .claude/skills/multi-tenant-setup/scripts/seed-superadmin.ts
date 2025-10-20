/**
 * Seed Superadmin Script
 *
 * Creates or promotes a user to superadmin role.
 * Run with: tsx scripts/seed-superadmin.ts
 *
 * SECURITY: Restrict access to this script in production.
 * Consider deleting or securing this file after initial setup.
 */

import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const db = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve)
  })
}

async function main() {
  console.log('=== Superadmin Seed Script ===\n')

  // Get email
  const email = await question('Enter email address for superadmin: ')
  if (!email || !email.includes('@')) {
    console.error('Invalid email address')
    process.exit(1)
  }

  // Check if user exists
  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, name: true }
  })

  if (existingUser) {
    console.log(`\nUser found: ${existingUser.email}`)
    console.log(`Current role: ${existingUser.role}`)

    if (existingUser.role === 'superadmin') {
      console.log('\nThis user is already a superadmin. No changes needed.')
      process.exit(0)
    }

    const confirm = await question('\nPromote this user to superadmin? (yes/no): ')
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Aborted.')
      process.exit(0)
    }

    // Promote to superadmin
    await db.user.update({
      where: { id: existingUser.id },
      data: { role: 'superadmin' }
    })

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'superadmin_promoted',
        userId: existingUser.id,
        email: existingUser.email,
        metadata: {
          previousRole: existingUser.role,
          promotedAt: new Date().toISOString()
        }
      }
    })

    console.log('\n✅ User promoted to superadmin successfully!')
    console.log(`Email: ${existingUser.email}`)
    console.log(`Role: superadmin`)
  } else {
    console.log(`\nNo user found with email: ${email}`)
    const createNew = await question('Create new superadmin user? (yes/no): ')

    if (createNew.toLowerCase() !== 'yes') {
      console.log('Aborted.')
      process.exit(0)
    }

    const name = await question('Enter name (optional, press Enter to skip): ')

    // Create new superadmin user
    const newUser = await db.user.create({
      data: {
        email,
        name: name || null,
        role: 'superadmin',
        emailVerifiedAt: new Date() // Auto-verify superadmin
      }
    })

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'superadmin_created',
        userId: newUser.id,
        email: newUser.email,
        metadata: {
          createdAt: new Date().toISOString()
        }
      }
    })

    console.log('\n✅ Superadmin user created successfully!')
    console.log(`Email: ${newUser.email}`)
    console.log(`Name: ${newUser.name || '(none)'}`)
    console.log(`Role: superadmin`)
    console.log('\nNote: This user can now sign in via OTP or dev password (if enabled).')
    console.log('Remember to add this email to ALLOWED_EMAILS in your .env file.')
  }

  rl.close()
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
