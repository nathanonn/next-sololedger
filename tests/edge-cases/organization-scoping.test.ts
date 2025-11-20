/**
 * Edge case tests for organization scoping
 * Tests API key organization restrictions and access violations
 */

import { describe, it, expect } from "vitest";
import { validateApiKeyOrgAccess } from "@/lib/auth-helpers";
import { mockApiKeyUser, mockCookieUser, mockUser } from "@/tests/helpers/mockUser";
import { testOrganizations } from "@/tests/helpers/testData";

describe("validateApiKeyOrgAccess", () => {
  describe("Cookie-based authentication (no restrictions)", () => {
    it("should allow access to any organization", () => {
      const user = mockCookieUser();
      const orgIds = [
        testOrganizations.acme.id,
        testOrganizations.techstart.id,
        "random-org-id",
        "another-org-id",
      ];

      orgIds.forEach((orgId) => {
        const hasAccess = validateApiKeyOrgAccess(user, orgId);
        expect(hasAccess).toBe(true);
      });
    });

    it("should allow access even with null apiKeyOrganizationId", () => {
      const user = mockUser({ apiKeyOrganizationId: null });
      const hasAccess = validateApiKeyOrgAccess(user, testOrganizations.acme.id);
      expect(hasAccess).toBe(true);
    });

    it("should allow access even with undefined apiKeyOrganizationId", () => {
      const user = mockUser({ apiKeyOrganizationId: undefined });
      const hasAccess = validateApiKeyOrgAccess(user, testOrganizations.acme.id);
      expect(hasAccess).toBe(true);
    });
  });

  describe("API key authentication (organization scoped)", () => {
    it("should allow access to scoped organization", () => {
      const user = mockApiKeyUser(testOrganizations.acme.id);
      const hasAccess = validateApiKeyOrgAccess(user, testOrganizations.acme.id);
      expect(hasAccess).toBe(true);
    });

    it("should deny access to different organization", () => {
      const user = mockApiKeyUser(testOrganizations.acme.id);
      const hasAccess = validateApiKeyOrgAccess(user, testOrganizations.techstart.id);
      expect(hasAccess).toBe(false);
    });

    it("should deny access to random organization", () => {
      const user = mockApiKeyUser(testOrganizations.acme.id);
      const hasAccess = validateApiKeyOrgAccess(user, "random-org-id");
      expect(hasAccess).toBe(false);
    });

    it("should be case-sensitive on organization ID", () => {
      const orgId = "org-ABC123";
      const user = mockApiKeyUser(orgId);

      expect(validateApiKeyOrgAccess(user, orgId)).toBe(true);
      expect(validateApiKeyOrgAccess(user, "org-abc123")).toBe(false);
      expect(validateApiKeyOrgAccess(user, "ORG-ABC123")).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string organization ID as cookie auth", () => {
      // Empty string is falsy in JavaScript, so treated as no scoping (cookie auth)
      const user = mockApiKeyUser("");

      // Since empty string is falsy, user is treated as cookie-based (no restrictions)
      expect(validateApiKeyOrgAccess(user, "")).toBe(true);
      expect(validateApiKeyOrgAccess(user, "some-org")).toBe(true);
      expect(validateApiKeyOrgAccess(user, "any-org")).toBe(true);
    });

    it("should handle very long organization IDs", () => {
      const longOrgId = "a".repeat(1000);
      const user = mockApiKeyUser(longOrgId);

      expect(validateApiKeyOrgAccess(user, longOrgId)).toBe(true);
      expect(validateApiKeyOrgAccess(user, "different-org")).toBe(false);
    });

    it("should handle special characters in organization ID", () => {
      const specialOrgId = "org-with-special-chars-!@#$%^&*()";
      const user = mockApiKeyUser(specialOrgId);

      expect(validateApiKeyOrgAccess(user, specialOrgId)).toBe(true);
      expect(validateApiKeyOrgAccess(user, "org-with-special-chars")).toBe(false);
    });
  });

  describe("Multiple organization scenarios", () => {
    it("should consistently deny access to all non-scoped orgs", () => {
      const scopedOrgId = testOrganizations.acme.id;
      const user = mockApiKeyUser(scopedOrgId);

      const otherOrgIds = [
        testOrganizations.techstart.id,
        "org-1",
        "org-2",
        "org-3",
        "org-4",
        "org-5",
      ];

      otherOrgIds.forEach((orgId) => {
        expect(validateApiKeyOrgAccess(user, orgId)).toBe(false);
      });
    });

    it("should allow only the exact scoped organization", () => {
      const scopedOrgId = "org-exact-match";
      const user = mockApiKeyUser(scopedOrgId);

      const similarOrgIds = [
        "org-exact-matc", // One char less
        "org-exact-match ", // Trailing space
        " org-exact-match", // Leading space
        "org-exact-match-2", // Extra suffix
        "ORG-EXACT-MATCH", // Different case
      ];

      similarOrgIds.forEach((orgId) => {
        expect(validateApiKeyOrgAccess(user, orgId)).toBe(false);
      });

      // Only exact match should work
      expect(validateApiKeyOrgAccess(user, scopedOrgId)).toBe(true);
    });
  });

  describe("Security scenarios", () => {
    it("should prevent organization hopping by changing scoped ID", () => {
      const user1 = mockApiKeyUser(testOrganizations.acme.id);
      const user2 = mockApiKeyUser(testOrganizations.techstart.id);

      // User 1 cannot access techstart
      expect(validateApiKeyOrgAccess(user1, testOrganizations.techstart.id)).toBe(false);

      // User 2 cannot access acme
      expect(validateApiKeyOrgAccess(user2, testOrganizations.acme.id)).toBe(false);

      // Each can only access their own
      expect(validateApiKeyOrgAccess(user1, testOrganizations.acme.id)).toBe(true);
      expect(validateApiKeyOrgAccess(user2, testOrganizations.techstart.id)).toBe(true);
    });

    it("should prevent null injection attempts", () => {
      // Attempt to bypass check with null
      const user = mockApiKeyUser(testOrganizations.acme.id);

      // These should all fail (not match the scoped org)
      expect(validateApiKeyOrgAccess(user, null as unknown as string)).toBe(false);
      expect(validateApiKeyOrgAccess(user, undefined as unknown as string)).toBe(false);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle API key switching organizations (requires new key)", () => {
      // User creates API key for org1
      const key1User = mockApiKeyUser("org1");
      expect(validateApiKeyOrgAccess(key1User, "org1")).toBe(true);
      expect(validateApiKeyOrgAccess(key1User, "org2")).toBe(false);

      // User creates API key for org2
      const key2User = mockApiKeyUser("org2");
      expect(validateApiKeyOrgAccess(key2User, "org1")).toBe(false);
      expect(validateApiKeyOrgAccess(key2User, "org2")).toBe(true);

      // Each key is scoped independently
      expect(validateApiKeyOrgAccess(key1User, "org1")).toBe(true);
      expect(validateApiKeyOrgAccess(key2User, "org2")).toBe(true);
    });

    it("should demonstrate cookie auth has no restrictions", () => {
      const cookieUser = mockCookieUser();

      // Can access any organization with cookie auth
      const allOrgs = ["org1", "org2", "org3", "org4", "org5"];
      allOrgs.forEach((orgId) => {
        expect(validateApiKeyOrgAccess(cookieUser, orgId)).toBe(true);
      });
    });

    it("should handle deleted organization scenario", () => {
      // API key scoped to organization that no longer exists
      const deletedOrgId = "deleted-org-123";
      const user = mockApiKeyUser(deletedOrgId);

      // Can still validate the scoping logic
      expect(validateApiKeyOrgAccess(user, deletedOrgId)).toBe(true);
      expect(validateApiKeyOrgAccess(user, "other-org")).toBe(false);

      // Note: Actual organization existence check happens in route handlers,
      // not in validateApiKeyOrgAccess
    });
  });
});
