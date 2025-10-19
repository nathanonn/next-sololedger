# Dependencies

All runtime and development dependencies required for the authentication system.

## Runtime Dependencies

Install with your preferred package manager:

```bash
npm install @prisma/client bcrypt jose resend zod @zxcvbn-ts/core @zxcvbn-ts/language-common @zxcvbn-ts/language-en
```

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@prisma/client` | latest | Database ORM client |
| `bcrypt` | latest | Password hashing (bcrypt algorithm) |
| `jose` | latest | JWT signing/verification (ESM-compatible) |
| `resend` | latest | Email sending service |
| `zod` | latest | Schema validation |

### Password Strength

| Package | Version | Purpose |
|---------|---------|---------|
| `@zxcvbn-ts/core` | latest | Password strength estimation |
| `@zxcvbn-ts/language-common` | latest | Common password dictionary |
| `@zxcvbn-ts/language-en` | latest | English language support |

## Development Dependencies

```bash
npm install -D prisma @types/bcrypt
```

| Package | Version | Purpose |
|---------|---------|---------|
| `prisma` | latest | Database migrations & codegen |
| `@types/bcrypt` | latest | TypeScript types for bcrypt |

## Package.json Script

Add to `package.json` to automatically generate Prisma client after installation:

```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

## TypeScript Configuration

Ensure your `tsconfig.json` includes these settings for compatibility:

```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "moduleResolution": "Bundler"
  }
}
```

**Why:**
- `esModuleInterop`: Allows proper importing of bcrypt
- `moduleResolution: "Bundler"` or `"NodeNext"`: Required for `jose` (ESM module)

## Native Module Build Requirements

The `bcrypt` package is a native Node.js module that requires compilation during installation.

### Local Development

Ensure you have:
- Node.js toolchain (node-gyp)
- Python 3.x
- C++ compiler (gcc/clang on Linux/Mac, Visual Studio Build Tools on Windows)

Most development environments have these by default.

### CI/CD

For Docker or CI environments, ensure the base image includes build tools:

**Debian/Ubuntu:**
```dockerfile
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++
```

**Alpine:**
```dockerfile
RUN apk add --no-cache \
    python3 \
    make \
    g++
```

## Prisma Post-Install

After any Prisma schema changes, regenerate the client:

```bash
npx prisma generate
```

This is automatically handled by the `postinstall` script above.

## Version Compatibility

All packages are compatible with:
- **Node.js:** 18.x or later
- **Next.js:** 15.x
- **React:** 19.x
- **TypeScript:** 5.x

## Optional: Email Template Libraries

The current implementation renders email HTML/text inline without a dedicated templating library.

If you want to use React Email in the future:

```bash
npm install @react-email/components @react-email/render
```

This is **not required** for the current implementation.
