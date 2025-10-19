# Environment Variables

Complete reference for all environment variables required by the authentication system.

## Required Variables

### Database

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

PostgreSQL connection string. Must be PostgreSQL 15+ with pgvector extension enabled.

### JWT Configuration

```bash
JWT_SECRET=your-secret-key-min-32-chars
```

**Generate with:**
```bash
openssl rand -base64 32
```

**Security:** Must be ≥32 characters. Never commit to version control.

```bash
JWT_ACCESS_COOKIE_NAME=__access
JWT_REFRESH_COOKIE_NAME=__session
```

Names for the HTTP-only cookies that store JWT tokens.
- Access token: Short-lived (~1 hour)
- Refresh token: Long-lived (~14 days)

### Email Configuration (Resend)

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**Setup:**
1. Sign up at https://resend.com
2. Add and verify your domain
3. Create an API key
4. Use a `noreply@` or `auth@` email address from your verified domain

### Application URL

```bash
APP_URL=http://localhost:3000
```

Base URL for CSRF validation. In production, use your actual domain (e.g., `https://app.example.com`).

### Email Allowlist

```bash
ALLOWED_EMAILS=user1@example.com,user2@example.com,admin@example.com
```

Comma-separated list of emails allowed to sign up/sign in (when `AUTH_ALLOWLIST_ENABLED=true`).
- Normalized to lowercase for comparison
- Exact match required (no wildcards)

## Feature Toggles

### Authentication Controls

```bash
AUTH_ALLOWLIST_ENABLED=true
```

**Default:** `true`
- `true`: Only emails in `ALLOWED_EMAILS` can sign up/sign in
- `false`: Any email can sign up/sign in
- Superadmins bypass this check regardless of setting

```bash
AUTH_SIGNUP_ENABLED=true
```

**Default:** `true`
- `true`: New users can create accounts
- `false`: Only existing users can sign in (blocks new signups)
- Superadmins bypass this restriction

### Development Features

```bash
ENABLE_DEV_PASSWORD_SIGNIN=true
```

**Default:** `false`

Enables password-based signin at `/login` (Password tab) for development.
- Only works when `NODE_ENV=development`
- Returns 404 in production for security
- Useful for testing without email setup

```bash
SKIP_PASSWORD_VALIDATION=true
```

**Default:** `false`

Development-only toggle to bypass zxcvbn password strength validation in the set-password route.
- Only affects `set-password` endpoint (not `change-password`)
- Ignored in production

## Optional Variables

### Multi-Tenant Settings

```bash
ORG_CREATION_ENABLED=false
ORG_CREATION_LIMIT=1
```

**Defaults:** `false`, `1`
- `ORG_CREATION_ENABLED`: Allow users to create organizations
- `ORG_CREATION_LIMIT`: Maximum organizations per user
- Superadmins bypass both restrictions

### Rate Limiting & CAPTCHA

```bash
HCAPTCHA_ENABLED=false
HCAPTCHA_SITE_KEY=xxxxx
HCAPTCHA_SECRET_KEY=0xyyyyy
```

**Setup:**
1. Sign up at https://www.hcaptcha.com
2. Create a site
3. Get site key (public) and secret key (private)
4. Set `HCAPTCHA_ENABLED=true`

**Behavior:**
- After ≥2 OTP requests in 15 minutes (per email or IP), CAPTCHA is required
- API returns `{ ok: false, requiresCaptcha: true }`
- Client must include `hcaptchaToken` in subsequent requests

### CSRF Protection

```bash
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

Comma-separated additional origins allowed for CSRF validation.
- `APP_URL` is always allowed
- Localhost variants (`:3000`, `:3001`) are allowed in development
- Can be full URLs or hostnames

### Superadmin Seeding

```bash
SEED_EMAIL=admin@example.com
```

Email to use when running the superadmin seed script.

## Tunable Parameters

### OTP Configuration

```bash
OTP_EXP_MINUTES=10
OTP_LENGTH=6
```

**Defaults:** `10`, `6`
- `OTP_EXP_MINUTES`: OTP expiration time (recommended: 5-15)
- `OTP_LENGTH`: Number of digits in OTP code (min: 4, max: 8)

### Password Hashing

```bash
BCRYPT_ROUNDS=12
```

**Default:** `12`

Number of bcrypt rounds for password hashing.
- Min: 10, Max: 15
- Higher = more secure but slower
- 12 is a good balance for modern hardware

## Complete .env Example

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/myapp

# JWT
JWT_SECRET=<generate-with-openssl-rand-base64-32>
JWT_ACCESS_COOKIE_NAME=__access
JWT_REFRESH_COOKIE_NAME=__session

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App
APP_URL=http://localhost:3000

# Auth
ALLOWED_EMAILS=user@example.com,admin@example.com
AUTH_ALLOWLIST_ENABLED=true
AUTH_SIGNUP_ENABLED=true

# Development
NODE_ENV=development
ENABLE_DEV_PASSWORD_SIGNIN=true
SKIP_PASSWORD_VALIDATION=false

# Optional: CAPTCHA
HCAPTCHA_ENABLED=false
HCAPTCHA_SITE_KEY=
HCAPTCHA_SECRET_KEY=

# Optional: Multi-tenant
ORG_CREATION_ENABLED=false
ORG_CREATION_LIMIT=1

# Optional: Tuning
OTP_EXP_MINUTES=10
OTP_LENGTH=6
BCRYPT_ROUNDS=12
```

## Validation

The application validates all environment variables at startup using Zod (see `lib/env.ts`).
Invalid or missing required variables will cause the application to fail fast with clear error messages.
