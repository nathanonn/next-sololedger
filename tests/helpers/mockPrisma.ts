/**
 * Mock Prisma client for testing
 */

import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { PrismaClient } from "@prisma/client";

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>();

/**
 * Reset all Prisma mocks before each test
 */
export function resetPrismaMock() {
  mockReset(prismaMock);
}

/**
 * Type helper for Prisma mock
 */
export type PrismaMock = DeepMockProxy<PrismaClient>;

/**
 * Configure mock user find response
 */
export function mockUserFind(user: unknown) {
  prismaMock.user.findUnique.mockResolvedValue(user as never);
  return prismaMock;
}

/**
 * Configure mock API key find response
 */
export function mockApiKeyFind(apiKey: unknown) {
  prismaMock.apiKey.findUnique.mockResolvedValue(apiKey as never);
  return prismaMock;
}

/**
 * Configure mock organization find response
 */
export function mockOrganizationFind(organization: unknown) {
  prismaMock.organization.findUnique.mockResolvedValue(organization as never);
  prismaMock.organization.findFirst.mockResolvedValue(organization as never);
  return prismaMock;
}

/**
 * Configure mock membership find response
 */
export function mockMembershipFind(membership: unknown) {
  prismaMock.membership.findFirst.mockResolvedValue(membership as never);
  return prismaMock;
}

/**
 * Configure mock organization settings response
 */
export function mockOrganizationSettings(settings: unknown) {
  prismaMock.organizationSettings.findUnique.mockResolvedValue(settings as never);
  return prismaMock;
}

/**
 * Configure standard auth scenario (user + organization + membership)
 */
export function mockStandardAuthScenario(
  user: unknown,
  organization: unknown,
  membership: unknown
) {
  mockUserFind(user);
  mockOrganizationFind(organization);
  mockMembershipFind(membership);
  return prismaMock;
}
