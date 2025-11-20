// IMPORTANT: Set environment variables BEFORE any imports
// This ensures lib/env.ts validation passes
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long-for-security";
process.env.JWT_ACCESS_COOKIE_NAME = "__test_access";
process.env.JWT_REFRESH_COOKIE_NAME = "__test_session";
process.env.ALLOWED_EMAILS = "test@example.com";
process.env.APP_URL = "http://localhost:3000";
process.env.RESEND_API_KEY = "re_test_key";
process.env.RESEND_FROM_EMAIL = "test@test.com";

import "@testing-library/jest-dom/vitest";
import { afterEach, afterAll, vi } from "vitest";

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Cleanup after all tests
afterAll(() => {
  vi.restoreAllMocks();
});
