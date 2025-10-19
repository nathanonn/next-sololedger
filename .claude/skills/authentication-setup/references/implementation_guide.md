# Implementation Guide

Step-by-step guide to implementing the authentication system with key file locations and code patterns.

## File Structure Overview

```
app/
├── (public)/
│   └── login/
│       └── page.tsx                    # Email OTP + dev password signin
├── (protected)/
│   ├── layout.tsx                      # Protected layout wrapper
│   ├── dashboard/
│   │   └── page.tsx                    # Example protected page
│   └── settings/
│       └── profile/
│           └── page.tsx                # Password management + signout
└── api/
    └── auth/
        ├── request-otp/
        │   └── route.ts                # POST: Send OTP email
        ├── verify-otp/
        │   └── route.ts                # POST: Verify OTP + create session
        ├── dev-signin/
        │   └── route.ts                # POST: Dev password signin
        ├── signout/
        │   └── route.ts                # POST: Clear session
        ├── refresh/
        │   └── route.ts                # GET: Rotate tokens
        └── profile/
            ├── set-password/
            │   └── route.ts            # POST: Set initial password
            └── change-password/
                └── route.ts            # POST: Change existing password

lib/
├── db.ts                               # Prisma client singleton
├── env.ts                              # Zod environment validation
├── jwt.ts                              # JWT for Node.js runtime
├── jwt-edge.ts                         # JWT for Edge runtime
├── csrf.ts                             # CSRF origin validation
├── rate-limit.ts                       # OTP rate limiting
├── email.ts                            # Email via Resend
├── validators.ts                       # Zod schemas + password strength
├── auth.ts                             # OTP, passwords, audit logging
└── auth-helpers.ts                     # getCurrentUser, token refresh

middleware.ts                           # Edge auth guard (JWT verification)
prisma/
├── schema.prisma                       # Database models
└── migrations/                         # Auto-generated migrations

scripts/
└── seed-superadmin.ts                  # Superadmin seeding script
```

## Implementation Steps

### Step 1: Dependencies and Database

See `dependencies.md` for installation commands.

After installing dependencies:

1. Set up database schema (see `database_schema.md`)
2. Run `npx prisma generate`
3. Run `npx prisma migrate dev --name init_auth`

### Step 2: Environment Variables

Copy `.env.example` to `.env` and configure (see `environment_variables.md`).

**Minimum required for development:**
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
JWT_SECRET=$(openssl rand -base64 32)
JWT_ACCESS_COOKIE_NAME=__access
JWT_REFRESH_COOKIE_NAME=__session
APP_URL=http://localhost:3000
ALLOWED_EMAILS=your-email@example.com
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
ENABLE_DEV_PASSWORD_SIGNIN=true
```

### Step 3: Core Library Files

#### lib/db.ts

Prisma client singleton to avoid creating multiple instances:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

#### lib/env.ts

Environment validation with Zod (catches missing vars at startup):

```typescript
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_COOKIE_NAME: z.string().default('__access'),
  JWT_REFRESH_COOKIE_NAME: z.string().default('__session'),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),
  APP_URL: z.string().url(),
  ALLOWED_EMAILS: z.string().min(1),
  AUTH_ALLOWLIST_ENABLED: z.string().default('true'),
  AUTH_SIGNUP_ENABLED: z.string().default('true'),
  ENABLE_DEV_PASSWORD_SIGNIN: z.string().optional(),
  // ... add other vars
})

export const env = envSchema.parse(process.env)
```

#### lib/jwt.ts (Node.js runtime)

JWT signing and verification for Node.js API routes:

```typescript
import { SignJWT, jwtVerify } from 'jose'
import { env } from './env'

const secret = new TextEncoder().encode(env.JWT_SECRET)

export type JWTPayload = {
  sub: string        // User ID
  email: string
  role: string
  tokenVersion: number
}

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .setIssuedAt()
    .sign(secret)
}

export async function signRefreshToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('14d')
    .setIssuedAt()
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as JWTPayload
}
```

#### lib/jwt-edge.ts (Edge runtime)

Minimal JWT verification for Edge middleware (signature only, no DB check):

```typescript
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function verifyTokenEdge(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}
```

#### lib/csrf.ts

CSRF protection via Origin/Referer validation:

```typescript
import { env } from './env'

export function isRequestOriginValid(request: Request): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  const allowedOrigins = [
    new URL(env.APP_URL).origin,
    ...(env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || []),
  ]

  // Development: allow localhost
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3001')
  }

  const requestOrigin = origin || (referer ? new URL(referer).origin : null)

  return requestOrigin ? allowedOrigins.includes(requestOrigin) : false
}
```

### Step 4: Authentication Logic Files

#### lib/email.ts

Send OTP emails via Resend:

```typescript
import { Resend } from 'resend'
import { env } from './env'

const resend = new Resend(env.RESEND_API_KEY)

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const expiryMinutes = parseInt(env.OTP_EXP_MINUTES || '10')

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: email,
    subject: `Your verification code: ${code}`,
    html: `
      <h1>Verification Code</h1>
      <p>Your code is: <strong>${code}</strong></p>
      <p>This code expires in ${expiryMinutes} minutes.</p>
    `,
    text: `Your verification code is: ${code}\n\nThis code expires in ${expiryMinutes} minutes.`,
  })
}
```

#### lib/rate-limit.ts

OTP request rate limiting:

```typescript
import { db } from './db'

const RATE_LIMITS = {
  emailPer15Min: 3,
  emailPer24Hours: 10,
  ipPer15Min: 5,
}

export async function checkRateLimit(email: string, ip?: string): Promise<{ allowed: boolean; requiresCaptcha: boolean }> {
  const now = new Date()
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Email rate limits
  const emailRecent = await db.otpRequest.count({
    where: { email, requestedAt: { gte: fifteenMinutesAgo } },
  })

  const emailDaily = await db.otpRequest.count({
    where: { email, requestedAt: { gte: oneDayAgo } },
  })

  if (emailRecent >= RATE_LIMITS.emailPer15Min || emailDaily >= RATE_LIMITS.emailPer24Hours) {
    return { allowed: false, requiresCaptcha: true }
  }

  // IP rate limit
  if (ip) {
    const ipRecent = await db.otpRequest.count({
      where: { ip, requestedAt: { gte: fifteenMinutesAgo } },
    })

    if (ipRecent >= RATE_LIMITS.ipPer15Min) {
      return { allowed: false, requiresCaptcha: true }
    }
  }

  // Check if captcha should be required (2+ requests in 15 min)
  const requiresCaptcha = emailRecent >= 2 || (ip && await db.otpRequest.count({
    where: { ip, requestedAt: { gte: fifteenMinutesAgo } },
  }) >= 2)

  return { allowed: true, requiresCaptcha }
}
```

#### lib/validators.ts

Zod schemas and password validation:

```typescript
import { z } from 'zod'
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core'
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common'
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en'

zxcvbnOptions.setOptions({
  translations: zxcvbnEnPackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
})

export const requestOtpSchema = z.object({
  email: z.string().email(),
  next: z.string().optional(),
  hcaptchaToken: z.string().optional(),
})

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  next: z.string().optional(),
})

export const setPasswordSchema = z.object({
  password: z.string().min(8),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export function validatePasswordStrength(password: string): { valid: boolean; feedback?: string } {
  if (process.env.SKIP_PASSWORD_VALIDATION === 'true' && process.env.NODE_ENV === 'development') {
    return { valid: true }
  }

  const result = zxcvbn(password)

  if (result.score < 3) {
    return {
      valid: false,
      feedback: result.feedback.warning || 'Password is too weak. Use a longer, more complex password.',
    }
  }

  return { valid: true }
}
```

#### lib/auth.ts

Core authentication functions (OTP, passwords, audit):

```typescript
import { db } from './db'
import bcrypt from 'bcrypt'
import { env } from './env'

const BCRYPT_ROUNDS = parseInt(env.BCRYPT_ROUNDS || '12')

export async function createOtpToken(email: string): Promise<string> {
  const otpLength = parseInt(env.OTP_LENGTH || '6')
  const code = Math.floor(10 ** (otpLength - 1) + Math.random() * 9 * 10 ** (otpLength - 1)).toString()
  const otpHash = await bcrypt.hash(code, BCRYPT_ROUNDS)
  const expiresAt = new Date(Date.now() + parseInt(env.OTP_EXP_MINUTES || '10') * 60 * 1000)

  // Consume existing unconsumed tokens for this email
  await db.otpToken.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  })

  await db.otpToken.create({
    data: { email, otpHash, expiresAt },
  })

  return code
}

export async function verifyOtpToken(email: string, code: string): Promise<boolean> {
  const token = await db.otpToken.findFirst({
    where: {
      email,
      consumedAt: null,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!token) return false

  const isValid = await bcrypt.compare(code, token.otpHash)

  if (!isValid) {
    // Increment attempts; consume after 5 attempts
    const newAttempts = token.attempts + 1
    await db.otpToken.update({
      where: { id: token.id },
      data: {
        attempts: newAttempts,
        ...(newAttempts >= 5 ? { consumedAt: new Date() } : {}),
      },
    })
    return false
  }

  // Consume token on success
  await db.otpToken.update({
    where: { id: token.id },
    data: { consumedAt: new Date() },
  })

  return true
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function auditLog(data: {
  action: string
  userId?: string
  email?: string
  ip?: string
  metadata?: Record<string, any>
}): Promise<void> {
  await db.auditLog.create({ data })
}
```

### Step 5: Helper Functions

#### lib/auth-helpers.ts

Session management helpers:

```typescript
import { cookies } from 'next/headers'
import { db } from './db'
import { verifyToken } from './jwt'
import { env } from './env'

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(env.JWT_ACCESS_COOKIE_NAME)?.value
    const refreshToken = cookieStore.get(env.JWT_REFRESH_COOKIE_NAME)?.value

    if (!accessToken && !refreshToken) return null

    const token = accessToken || refreshToken
    if (!token) return null

    const payload = await verifyToken(token)

    const user = await db.user.findUnique({
      where: { id: payload.sub },
    })

    if (!user || user.sessionVersion !== payload.tokenVersion) {
      return null
    }

    return user
  } catch {
    return null
  }
}

export function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = cookies()
  const isProduction = process.env.NODE_ENV === 'production'

  cookieStore.set(env.JWT_ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  })

  cookieStore.set(env.JWT_REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 14, // 14 days
  })
}

export function clearAuthCookies() {
  const cookieStore = cookies()
  cookieStore.delete(env.JWT_ACCESS_COOKIE_NAME)
  cookieStore.delete(env.JWT_REFRESH_COOKIE_NAME)
}
```

### Step 6: Middleware

#### middleware.ts

Edge middleware for route protection:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyTokenEdge } from './lib/jwt-edge'

const PUBLIC_PATHS = ['/', '/login', '/api/auth', '/_next', '/favicon.ico', '/assets']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Check auth
  const accessToken = request.cookies.get(process.env.JWT_ACCESS_COOKIE_NAME || '__access')?.value
  const refreshToken = request.cookies.get(process.env.JWT_REFRESH_COOKIE_NAME || '__session')?.value

  const token = accessToken || refreshToken

  if (!token) {
    return NextResponse.redirect(new URL(`/login?next=${pathname}`, request.url))
  }

  const payload = await verifyTokenEdge(token)

  if (!payload) {
    return NextResponse.redirect(new URL(`/login?next=${pathname}`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

### Step 7: API Routes

See the file structure overview for route locations. Each route should:
1. Export `export const runtime = "nodejs"` (required for database access)
2. Validate CSRF with `isRequestOriginValid(request)`
3. Parse request body with Zod schemas
4. Call auth functions from `lib/auth.ts`
5. Create audit logs for important events
6. Return appropriate status codes and messages

**Key patterns:**

```typescript
// POST /api/auth/request-otp/route.ts
export const runtime = "nodejs"

export async function POST(req: Request) {
  if (!isRequestOriginValid(req)) {
    return Response.json({ error: 'Invalid origin' }, { status: 403 })
  }

  const body = await req.json()
  const data = requestOtpSchema.parse(body)

  // Check rate limit, create OTP, send email, audit log
  // ...

  return Response.json({ ok: true })
}
```

### Step 8: UI Pages

#### app/(public)/login/page.tsx

Login page with Email OTP and Dev Password tabs (use shadcn/ui components).

**Key features:**
- Tabs for Email OTP (default) and Password (dev only)
- Two-step OTP flow: enter email → enter code
- React Hook Form + Zod validation
- Toast notifications with Sonner
- Conditional hCaptcha rendering

#### app/(protected)/layout.tsx

Protected layout that wraps all authenticated pages:

```typescript
import { getCurrentUser } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}
```

#### app/(protected)/settings/profile/page.tsx

Profile page with:
- Account information display
- Set password (if none) or Change password (if exists)
- Sign out button

### Step 9: Testing

**Manual testing checklist:**
- ✅ Email OTP flow (request → receive → verify → login)
- ✅ Dev password signin (development only, 404 in production)
- ✅ Email allowlist enforcement
- ✅ Rate limiting (test multiple OTP requests)
- ✅ CSRF rejection (modify Origin header)
- ✅ Middleware redirection (access protected route without auth)
- ✅ Set password → verify JWT rotation
- ✅ Change password → verify current password check
- ✅ Sign out → verify cookie cleared
- ✅ Audit logs created for all events

### Step 10: Production Checklist

Before deploying:
- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET` (≥32 chars)
- [ ] Configure production `APP_URL`
- [ ] Set up Resend with verified domain
- [ ] Configure `ALLOWED_EMAILS` or disable allowlist
- [ ] Disable `ENABLE_DEV_PASSWORD_SIGNIN`
- [ ] Enable `HCAPTCHA_*` for rate limit protection
- [ ] Review audit logs regularly
- [ ] Set up database backups
- [ ] Test email deliverability

## Common Issues

**OTP emails not sending:**
- Verify `RESEND_API_KEY` is valid
- Check domain is verified in Resend dashboard
- Look for errors in application logs

**JWT verification failures:**
- Ensure `JWT_SECRET` is the same across all instances
- Check cookie settings (httpOnly, secure, sameSite)
- Verify token hasn't expired

**Rate limiting issues:**
- Clear old `OtpRequest` records regularly (cron job)
- Adjust rate limits via environment variables if needed

**Middleware redirect loops:**
- Ensure `/login` and `/api/auth/*` are in PUBLIC_PATHS
- Check Edge runtime compatibility of dependencies
