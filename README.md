# Next.js SaaS Boilerplate

A production-ready Next.js 15 boilerplate with **email OTP authentication**, JWT sessions, and a **resizable dashboard shell**. Built with TypeScript, Tailwind CSS v4, shadcn/ui, and Prisma.

## Features

### Authentication System
- ✅ **Email OTP** primary flow via Resend
- ✅ **JWT sessions** with access + refresh token rotation
- ✅ **Rate limiting** (per-email & per-IP)
- ✅ **CSRF protection** (Origin/Referer validation)
- ✅ **Email allowlist** enforcement
- ✅ **Audit logging** for all auth events
- ✅ **Password management** with zxcvbn strength validation
- ✅ **Session versioning** for global invalidation
- ✅ **Dev mode** password signin for testing
- ✅ **Optional hCaptcha** gating after rate limit threshold

### Dashboard Shell
- ✅ **Resizable sidebar** (15-35% width, collapsible to icon-only)
- ✅ **Two-level navigation** (Sections → Pages)
- ✅ **Mobile drawer** with full sidebar content
- ✅ **Per-user persistence** in localStorage
- ✅ **Active route highlighting**
- ✅ **Profile dropdown** with sign out

### Developer Experience
- ✅ **TypeScript strict mode**
- ✅ **Tailwind CSS v4** with shadcn/ui components
- ✅ **Prisma ORM** with local PostgreSQL
- ✅ **Hot reload** with Turbopack
- ✅ **ESLint** configured
- ✅ **Server-first architecture**

## Quick Start

### 1. Prerequisites

- Node.js 18+
- PostgreSQL 15+
- npm or yarn

### 2. Installation

```bash
# Clone or download this repository
cd next-shadcn-ui-boilerplate

# Install dependencies
npm install

# Install required shadcn/ui components
npx shadcn@latest add card tabs separator sheet dropdown-menu avatar scroll-area toast input button label
```

### 3. Database Setup

```bash
# Create PostgreSQL database
createdb nextboilerplate

# Connect to database and enable pgvector
psql -d nextboilerplate -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Copy environment file
cp .env.example .env

# Edit .env and configure DATABASE_URL
# DATABASE_URL=postgresql://user:password@localhost:5432/nextboilerplate
```

### 4. Environment Configuration

Edit `.env` and set the required variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nextboilerplate

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-32-plus-character-secret-here

# Email Allowlist (comma-separated)
ALLOWED_EMAILS=your-email@example.com,admin@example.com

# App URL
APP_URL=http://localhost:3000

# Optional: Resend for production email delivery
RESEND_API_KEY=re_your_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Optional: Dev mode password signin
ENABLE_DEV_PASSWORD_SIGNIN=true
```

See `.env.example` for all available options.

### 5. Database Migration

```bash
# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev
```

### 6. Create First User (Optional)

You can create the first user account with a password using the seed script:

```bash
# Install tsx if not already installed
npm install

# Run seed interactively (will prompt for email, password, and name)
npm run seed

# Or use environment variables
SEED_EMAIL=admin@example.com SEED_PASSWORD=yourpassword SEED_NAME="Admin" npm run seed
```

**Important**: After creating your user:
1. Add the email to `ALLOWED_EMAILS` in your `.env` file
2. Set `ENABLE_DEV_PASSWORD_SIGNIN=true` in your `.env` file to enable password login in development

The seed script is idempotent - running it multiple times with the same email will prompt you to update the password if the user already exists.

### 7. Start Development Server

```bash
npm run dev
```

Visit **http://localhost:3000/login** to test the authentication system.

> **Tip**: If you created a user with the seed script, you can sign in using the "Password (Dev)" tab on the login page (make sure `ENABLE_DEV_PASSWORD_SIGNIN=true` is set).

## Testing Authentication

### Email OTP Flow (Recommended)

1. Navigate to http://localhost:3000/login
2. Enter an email from your `ALLOWED_EMAILS` list
3. Check your **terminal/console** for the OTP code (in development, codes are logged instead of emailed)
4. Enter the 6-digit code to sign in
5. You'll be redirected to `/dashboard`

### Dev Password Signin (Development Only)

1. First, sign in with OTP to create your user account
2. Navigate to `/settings/profile`
3. Set a password using the "Set Password" form
4. Sign out
5. On the login page, click the **"Password (Dev)"** tab
6. Sign in with your email and password

> **Note**: Dev password signin is only available when `NODE_ENV=development` and `ENABLE_DEV_PASSWORD_SIGNIN=true`.

## Project Structure

```
app/
├── (public)/
│   └── login/page.tsx           # Email OTP + dev password signin
├── (protected)/
│   ├── layout.tsx               # Protected layout with DashboardShell
│   ├── dashboard/page.tsx       # Example dashboard page
│   └── settings/
│       └── profile/page.tsx     # Profile settings & password management
└── api/auth/
    ├── request-otp/route.ts     # Send OTP via email
    ├── verify-otp/route.ts      # Verify OTP and create session
    ├── dev-signin/route.ts      # Dev-only password signin
    ├── signout/route.ts         # Clear session cookies
    ├── refresh/route.ts         # Token rotation
    └── profile/
        ├── set-password/        # Set password (no current required)
        └── change-password/     # Change password (requires current)

components/
├── ui/                          # shadcn/ui components (auto-generated)
└── features/
    └── dashboard/
        ├── dashboard-shell.tsx  # Resizable dashboard shell
        └── sidebar.tsx          # Two-level navigation sidebar

lib/
├── db.ts                        # Prisma client singleton
├── env.ts                       # Environment validation with Zod
├── jwt.ts                       # JWT signing/verification (Node)
├── jwt-edge.ts                  # JWT signature check (Edge)
├── csrf.ts                      # CSRF origin validation
├── rate-limit.ts                # Rate limiting logic
├── email.ts                     # Email sending via Resend
├── validators.ts                # Zod schemas + password strength
├── auth.ts                      # OTP, password hashing, audit
├── auth-helpers.ts              # getCurrentUser, token refresh
└── utils.ts                     # cn helper, etc.

prisma/
├── schema.prisma                # Database models
└── migrations/                  # Database migrations

middleware.ts                    # Edge middleware for route protection
```

## Customization

### Adding Pages to Dashboard

Edit `app/(protected)/layout.tsx`:

```tsx
const sections = [
  { id: "main", label: "Main", icon: <Home /> },
  { id: "analytics", label: "Analytics", icon: <BarChart /> },
  { id: "settings", label: "Settings", icon: <Settings /> },
]

const pages = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", sectionId: "main" },
  { id: "reports", label: "Reports", href: "/analytics/reports", sectionId: "analytics" },
  { id: "profile", label: "Profile", href: "/settings/profile", sectionId: "settings" },
]
```

Create corresponding page files:

```bash
mkdir -p app/\(protected\)/analytics/reports
touch app/\(protected\)/analytics/reports/page.tsx
```

### Adding shadcn/ui Components

```bash
# Add any component from shadcn/ui
npx shadcn@latest add <component-name>

# Examples:
npx shadcn@latest add table
npx shadcn@latest add dialog
npx shadcn@latest add select
```

Components are added to `components/ui/` and can be imported:

```tsx
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
```

### Customizing Email Templates

Edit `lib/email.ts` to customize OTP email templates:

```tsx
export async function sendOtpEmail({ to, code, expiresAt }: SendOtpEmailParams) {
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `Your verification code: ${code}`,
    html: `
      <!-- Customize your HTML template here -->
      <div style="...">
        <p>Your code is: <strong>${code}</strong></p>
      </div>
    `,
    text: `Your verification code is: ${code}`,
  })
}
```

### Adding Database Models

1. Edit `prisma/schema.prisma`:

```prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("posts")
}
```

2. Update the `User` model to include the relation:

```prisma
model User {
  // ... existing fields
  posts     Post[]
}
```

3. Create and apply migration:

```bash
npx prisma migrate dev --name add_posts_model
```

### Customizing Rate Limits

Edit `lib/rate-limit.ts`:

```tsx
// Adjust limits
const emailCount15m = await db.otpRequest.count({
  where: {
    email,
    requestedAt: { gte: fifteenMinutesAgo },
  },
})

// Change threshold (default: 3 per 15 minutes)
if (emailCount15m >= 5) {  // Increase to 5
  return { allowed: false, requiresCaptcha: false }
}
```

### Customizing JWT Expiration

Edit `lib/jwt.ts`:

```tsx
// Access token expiration (default: 1 hour)
.setExpirationTime("2h")  // Change to 2 hours

// Refresh token expiration (default: 14 days)
.setExpirationTime("30d")  // Change to 30 days
```

Update cookie `maxAge` accordingly:

```tsx
maxAge: 60 * 60 * 2,  // 2 hours for access
maxAge: 60 * 60 * 24 * 30,  // 30 days for refresh
```

### Enabling hCaptcha

1. Sign up at https://www.hcaptcha.com
2. Get your site key and secret key
3. Update `.env`:

```bash
HCAPTCHA_ENABLED=true
HCAPTCHA_SITE_KEY=your_site_key
HCAPTCHA_SECRET_KEY=your_secret_key
```

4. Install hCaptcha React component:

```bash
npm install @hcaptcha/react-hcaptcha
```

5. Update `app/(public)/login/page.tsx` to integrate the hCaptcha widget (placeholder included in code).

## Development Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm start            # Serve production build
npm run lint         # Run ESLint
npm run seed         # Create/update first user account

# Prisma
npx prisma generate                   # Generate client after schema changes
npx prisma migrate dev --name <desc>  # Create + apply migration
npx prisma studio                     # Open database GUI
npx prisma db push                    # Push schema without migration (dev only)
npx prisma db seed                    # Run seed script (same as npm run seed)

# shadcn/ui
npx shadcn@latest add <component>     # Add UI component
```

## Deployment

### Environment Variables for Production

Ensure these are set in your production environment:

```bash
# Required
DATABASE_URL=postgresql://...
JWT_SECRET=<strong-32-plus-char-secret>
APP_URL=https://yourdomain.com
ALLOWED_EMAILS=user@example.com,admin@example.com

# Email (required for OTP)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Optional
HCAPTCHA_ENABLED=true
HCAPTCHA_SITE_KEY=...
HCAPTCHA_SECRET_KEY=...
```

### Deployment Checklist

- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Configure production `DATABASE_URL`
- [ ] Update `APP_URL` to production domain
- [ ] Set up Resend API key for email delivery
- [ ] Update `ALLOWED_EMAILS` with real user emails
- [ ] Set `ENABLE_DEV_PASSWORD_SIGNIN=false` (or remove)
- [ ] Enable `HCAPTCHA_ENABLED=true` if using captcha
- [ ] Run `npx prisma migrate deploy` in production
- [ ] Test authentication flows thoroughly

### Recommended Platforms

- **Vercel**: Zero-config deployment for Next.js
- **Railway**: Easy PostgreSQL + app hosting
- **Fly.io**: Full control with Docker deployment

## Security Features

### What's Included

- ✅ **HTTP-only cookies** for token storage
- ✅ **CSRF protection** via Origin/Referer validation
- ✅ **Rate limiting** per email and IP
- ✅ **Email allowlist** to restrict signup
- ✅ **Password hashing** with bcrypt (12 rounds)
- ✅ **Password strength** validation with zxcvbn
- ✅ **Audit logging** for all auth events
- ✅ **Session versioning** for global invalidation
- ✅ **Token rotation** on refresh
- ✅ **Optional hCaptcha** for bot protection

### Best Practices

1. **Never commit `.env`** — it's in `.gitignore`
2. **Rotate JWT_SECRET** periodically in production
3. **Monitor audit logs** for suspicious activity
4. **Keep dependencies updated** — run `npm audit`
5. **Use HTTPS** in production (required for secure cookies)
6. **Set up database backups**
7. **Review `ALLOWED_EMAILS`** regularly
8. **Enable hCaptcha** if facing abuse

## Troubleshooting

### OTP Code Not Received

**In Development**:
- Check your terminal/console — OTP codes are logged in dev mode
- Look for: `=== OTP Email (Development) ===`

**In Production**:
- Verify `RESEND_API_KEY` is set correctly
- Check Resend dashboard for delivery status
- Ensure `RESEND_FROM_EMAIL` domain is verified
- Check spam folder

### Authentication Fails

- Verify email is in `ALLOWED_EMAILS` list
- Check database connection (`DATABASE_URL`)
- Ensure `JWT_SECRET` is 32+ characters
- Check browser cookies are enabled
- Clear cookies and try again

### Database Migration Errors

```bash
# Reset database (development only, deletes all data)
npx prisma migrate reset

# If migrations are out of sync
npx prisma migrate resolve --rolled-back "migration_name"
npx prisma migrate deploy
```

### TypeScript Errors

```bash
# Regenerate Prisma client
npx prisma generate

# Check for ESM compatibility
# Ensure tsconfig.json has: "moduleResolution": "bundler"
```

## Architecture Decisions

### Why Email OTP?

- No password to forget or leak
- One-time use codes (more secure than magic links)
- Works across devices seamlessly
- Lower support burden

### Why JWT in Cookies?

- HTTP-only prevents XSS attacks
- Secure flag prevents MITM attacks
- SameSite prevents CSRF attacks
- Automatic refresh via middleware

### Why Local PostgreSQL?

- Full control over data
- No vendor lock-in
- Lower latency
- Cost-effective for development

### Why Prisma?

- Type-safe database access
- Automatic migrations
- Great DX with Prisma Studio
- Works with edge and serverless

## Contributing

This is a boilerplate — fork and customize it for your needs!

## License

MIT License - use this however you want.

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [Resend Email API](https://resend.com/docs)

## Support

- **Issues**: Open an issue in this repository
- **Documentation**: See `notes/skills/` for detailed implementation guides
- **Community**: Share your improvements and customizations

---

Built with ❤️ using Next.js 15, React 19, TypeScript, Tailwind CSS v4, and shadcn/ui.
