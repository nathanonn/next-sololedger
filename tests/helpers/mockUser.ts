/**
 * Mock user objects and factories for testing
 */

import type { CurrentUser } from "@/lib/auth-helpers";

export interface MockUserOptions {
  id?: string;
  email?: string;
  name?: string | null;
  role?: string;
  emailVerifiedAt?: Date | null;
  passwordHash?: string | null;
  sessionVersion?: number;
  defaultOrganizationId?: string | null;
  apiKeyOrganizationId?: string | null;
}

/**
 * Create a mock CurrentUser object
 */
export function mockUser(options: MockUserOptions = {}): CurrentUser {
  return {
    id: options.id || "test-user-id",
    email: options.email || "test@example.com",
    name: options.name !== undefined ? options.name : "Test User",
    role: options.role || "USER",
    emailVerifiedAt: options.emailVerifiedAt !== undefined ? options.emailVerifiedAt : new Date(),
    passwordHash: options.passwordHash !== undefined ? options.passwordHash : "$2b$12$hashedpassword",
    sessionVersion: options.sessionVersion || 1,
    defaultOrganizationId: options.defaultOrganizationId || null,
    apiKeyOrganizationId: options.apiKeyOrganizationId,
  };
}

/**
 * Create a mock user with cookie-based authentication (no API key)
 */
export function mockCookieUser(options: MockUserOptions = {}): CurrentUser {
  return mockUser({
    ...options,
    apiKeyOrganizationId: undefined, // Ensure no API key organization
  });
}

/**
 * Create a mock user with API key authentication
 */
export function mockApiKeyUser(
  organizationId: string,
  options: MockUserOptions = {}
): CurrentUser {
  return mockUser({
    ...options,
    apiKeyOrganizationId: organizationId,
  });
}

/**
 * Create a mock superadmin user
 */
export function mockSuperadminUser(options: MockUserOptions = {}): CurrentUser {
  return mockUser({
    ...options,
    role: "SUPERADMIN",
  });
}

/**
 * Create a mock admin user
 */
export function mockAdminUser(options: MockUserOptions = {}): CurrentUser {
  return mockUser({
    ...options,
    role: "ADMIN",
  });
}

/**
 * Create a mock regular user
 */
export function mockRegularUser(options: MockUserOptions = {}): CurrentUser {
  return mockUser({
    ...options,
    role: "USER",
  });
}

/**
 * Create a mock user without email verification
 */
export function mockUnverifiedUser(options: MockUserOptions = {}): CurrentUser {
  return mockUser({
    ...options,
    emailVerifiedAt: null,
  });
}

/**
 * Create a mock user without password (OTP-only)
 */
export function mockOtpOnlyUser(options: MockUserOptions = {}): CurrentUser {
  return mockUser({
    ...options,
    passwordHash: null,
  });
}
