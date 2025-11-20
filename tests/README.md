# Testing Guide

This directory contains automated tests for the Bearer Token Authentication system and related functionality.

## Test Structure

```
tests/
├── helpers/           # Test utilities and mocks
│   ├── mockRequest.ts    # Mock Next.js Request objects
│   ├── mockUser.ts       # User factories and fixtures
│   ├── mockApiKey.ts     # API key and JWT token generators
│   ├── mockPrisma.ts     # Prisma database mocking
│   └── testData.ts       # Shared test data fixtures
├── unit/             # Unit tests
│   └── lib/
│       ├── auth-helpers.test.ts  # Authentication core (17 tests)
│       └── csrf.test.ts          # CSRF validation (11 tests, 4 skipped)
├── integration/      # Integration tests (placeholder)
├── edge-cases/       # Edge case tests (placeholder)
└── setup.ts         # Global test setup

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Test Framework

- **Vitest**: Fast, modern test framework with native ESM support
- **Testing Library**: React testing utilities
- **vitest-mock-extended**: Deep mocking for Prisma and complex objects
- **happy-dom**: Lightweight DOM implementation

## Writing Tests

### Basic Structure

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/tests/helpers/mockPrisma";

// Mock database BEFORE imports
vi.mock("@/lib/db", () => ({
  db: prismaMock,
}));

import { yourFunction } from "@/lib/your-module";

describe("yourFunction", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("should do something", () => {
    // Arrange
    const input = "test";

    // Act
    const result = yourFunction(input);

    // Assert
    expect(result).toBe("expected");
  });
});
```

### Using Test Helpers

#### Mock Request

```typescript
import { mockBearerRequest, mockCookieRequest, mockRequest } from "@/tests/helpers/mockRequest";

// Bearer token request
const request = mockBearerRequest("your_token_here");

// Cookie-based request
const request = mockCookieRequest("access_token");

// Custom request
const request = mockRequest({
  method: "POST",
  url: "http://localhost:3000/api/test",
  headers: { "content-type": "application/json" },
  body: { foo: "bar" },
});
```

#### Mock User

```typescript
import { mockUser, mockApiKeyUser, mockCookieUser } from "@/tests/helpers/mockUser";

// Basic user
const user = mockUser({ id: "user-123", email: "test@example.com" });

// API key authenticated user
const user = mockApiKeyUser("org-id");

// Cookie authenticated user
const user = mockCookieUser();
```

#### Mock API Keys

```typescript
import {
  generateTestBearerToken,
  generateTestCookieToken,
  mockApiKey,
  mockExpiredApiKey
} from "@/tests/helpers/mockApiKey";

// Generate valid Bearer token
const token = await generateTestBearerToken("user-id", "org-id");

// Generate cookie-based token
const token = await generateTestCookieToken("user-id");

// Mock API key database record
const apiKey = mockApiKey({ userId: "user-123", organizationId: "org-123" });
const expiredKey = mockExpiredApiKey();
```

#### Mock Prisma

```typescript
import { prismaMock, mockUserFind, mockOrganizationFind } from "@/tests/helpers/mockPrisma";

// Mock user lookup
mockUserFind({ id: "user-123", email: "test@example.com" });

// Mock organization lookup
mockOrganizationFind({ id: "org-123", name: "Test Org" });

// Direct mock configuration
prismaMock.user.findUnique.mockResolvedValue(mockUser);
```

#### Test Data

```typescript
import { testUsers, testOrganizations, testApiKeys } from "@/tests/helpers/testData";

// Use pre-defined test data
const user = testUsers.john;
const org = testOrganizations.acme;
const apiKey = testApiKeys.johnAcme;
```

## Test Coverage

Current coverage focuses on:

### Authentication Core (auth-helpers.ts) - 100%
- ✅ Bearer token extraction from Authorization header
- ✅ Cookie-based authentication fallback
- ✅ API key validation (expired, revoked, not found)
- ✅ Session version mismatch handling
- ✅ Organization scoping for API keys
- ✅ User lookup and validation

### CSRF Protection (csrf.ts) - ~64%
- ✅ Bearer token requests bypass CSRF
- ✅ Invalid origin rejection
- ✅ Empty/missing origin handling
- ⏭️ Skipped: ENV-dependent tests (origin allowlist, localhost variants)

### Future Coverage

Planned test additions:

1. **lib/api-keys.ts** - API key generation and validation
2. **lib/jwt.ts** - JWT signing and verification
3. **Integration tests** - Full request/response cycles
   - API key exchange flow
   - Transaction CRUD with Bearer tokens
   - Report generation with API keys
4. **Edge cases** - Complex scenarios
   - Token expiration mid-request
   - Concurrent API key usage
   - Organization access violations

## Troubleshooting

### Tests Failing Due to Environment Variables

Environment variables are set in `tests/setup.ts` BEFORE any imports. If you see env validation errors:

1. Check `tests/setup.ts` has all required variables
2. Ensure variables are set at the top of the file (before imports)
3. Verify your test doesn't override `process.env` values

### Mock Not Working

Common issues:

1. **Mock defined after import**: Move `vi.mock()` before the import statement
2. **Mock reset not called**: Add `vi.clearAllMocks()` or `resetPrismaMock()` in `beforeEach`
3. **Wrong mock return value**: Check mock is returning the expected type

### Prisma Connection Errors

If you see "database credentials not valid" errors:

1. Ensure `vi.mock("@/lib/db")` is called BEFORE importing modules that use db
2. Import `prismaMock` from `@/tests/helpers/mockPrisma`
3. Configure mock responses for database queries

## Best Practices

1. **One assertion concept per test**: Test one thing at a time
2. **Use descriptive test names**: "should reject expired API key" not "test 1"
3. **Reset mocks**: Always reset mocks in `beforeEach`
4. **Use test data**: Prefer `testUsers.john` over inline fixtures
5. **Mock at the boundary**: Mock external dependencies (db, env), not internal functions
6. **Test behavior, not implementation**: Focus on inputs/outputs, not internals

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Manual workflow dispatch

GitHub Actions workflow: `.github/workflows/test.yml` (when added)

Required for merge:
- All tests passing
- No skipped tests without documentation
- Coverage above threshold (when configured)

## Adding New Tests

1. Create test file in appropriate directory (`unit/`, `integration/`, `edge-cases/`)
2. Follow naming convention: `<module>.test.ts`
3. Import required helpers from `@/tests/helpers/`
4. Mock external dependencies (database, env, etc.)
5. Write tests using AAA pattern (Arrange, Act, Assert)
6. Run tests locally: `npm run test:run`
7. Check coverage: `npm run test:coverage`

## Support

For issues or questions:
- Check existing tests in `tests/unit/lib/` for examples
- Review test helper source code in `tests/helpers/`
- Consult Vitest documentation: https://vitest.dev
- Ask in team chat or create an issue

---

Last updated: 2025-11-19
Test framework: Vitest v4.0.10
