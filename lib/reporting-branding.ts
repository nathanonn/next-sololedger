/**
 * Organization branding helpers for reports
 * Server-side only (Node runtime)
 */

import { db } from "@/lib/db";

export interface OrgBranding {
  displayName: string;
  logoUrl: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
}

/**
 * Get organization branding information for report headers
 * @param orgId - Organization ID
 * @returns Branding information including logo, business name, and contact details
 */
export async function getOrgBranding(orgId: string): Promise<OrgBranding> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      logoUrl: true,
      settings: {
        select: {
          address: true,
          email: true,
          phone: true,
          taxId: true,
        },
      },
    },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  return {
    displayName: org.name,
    logoUrl: org.logoUrl ?? null,
    address: org.settings?.address ?? null,
    email: org.settings?.email ?? null,
    phone: org.settings?.phone ?? null,
    taxId: org.settings?.taxId ?? null,
  };
}
