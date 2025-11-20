/**
 * Setup & Configuration Tools for SoloLedger MCP Server
 *
 * Provides comprehensive setup and configuration including:
 * - Categories (income/expense organization)
 * - Accounts (payment methods, bank accounts)
 * - Vendors (expense payees)
 * - Clients (income payers)
 * - Organization settings
 * - Business and financial settings
 */

import { z } from "zod";
import { APIClient } from "../api-client.js";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  ReorderCategoriesSchema,
  CategoryUsageFilterSchema,
  DeleteCategoryWithReassignmentSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
  AccountBalancesFilterSchema,
  CreateVendorSchema,
  UpdateVendorSchema,
  MergeVendorSchema,
  VendorFilterSchema,
  CreateClientSchema,
  UpdateClientSchema,
  MergeClientSchema,
  ClientFilterSchema,
  UpdateOrganizationSchema,
  UpdateBusinessSettingsSchema,
  UpdateFinancialSettingsSchema,
} from "../types.js";

export function registerSetupTools(server: any, client: APIClient) {
  const orgSlug = client.getOrgSlug();

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  server.tool(
    "categories_list",
    "List all income and expense categories. Returns hierarchical list with parent-child relationships, colors, icons, and activity status. Ordered by type, sortOrder, and name.",
    {},
    async () => {
      const result = await client.get(`/api/orgs/${orgSlug}/categories`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "categories_create",
    "Create a new income or expense category. Supports parent-child hierarchy. If parentId provided, parent must have same type as child.",
    {
      name: z.string().min(1).max(255).describe("Category name (1-255 chars)"),
      type: z.enum(["INCOME", "EXPENSE"]).describe("Category type"),
      parentId: z
        .string()
        .optional()
        .nullable()
        .describe("Parent category ID (must have same type)"),
      color: z.string().max(50).optional().nullable().describe("Color code (max 50 chars)"),
      icon: z.string().max(50).optional().nullable().describe("Icon name (max 50 chars)"),
      includeInPnL: z
        .boolean()
        .optional()
        .describe("Include in P&L reports (default true)"),
      active: z.boolean().optional().describe("Active status (default true)"),
    },
    async (args: z.infer<typeof CreateCategorySchema>) => {
      const result = await client.post(`/api/orgs/${orgSlug}/categories`, args);
      return {
        content: [
          {
            type: "text",
            text: `Created ${args.type.toLowerCase()} category: ${args.name}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "categories_update",
    "Update a category. All fields optional. Cannot be its own parent. Parent type must match category type.",
    {
      categoryId: z.string().describe("Category ID to update"),
      name: z.string().min(1).max(255).optional().describe("Category name"),
      type: z.enum(["INCOME", "EXPENSE"]).optional().describe("Category type"),
      parentId: z.string().optional().nullable().describe("Parent category ID"),
      color: z.string().max(50).optional().nullable().describe("Color code"),
      icon: z.string().max(50).optional().nullable().describe("Icon name"),
      includeInPnL: z.boolean().optional().describe("Include in P&L reports"),
      active: z.boolean().optional().describe("Active status"),
    },
    async (args: { categoryId: string } & z.infer<typeof UpdateCategorySchema>) => {
      const { categoryId, ...data } = args;
      const result = await client.patch(
        `/api/orgs/${orgSlug}/categories/${categoryId}`,
        data
      );
      return {
        content: [
          {
            type: "text",
            text: `Updated category ${categoryId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "categories_reorder",
    "Reorder categories within their groups (type, parentId). Provide array of {id, sortOrder} pairs. Categories are reordered only within their respective groups.",
    {
      categories: z
        .array(
          z.object({
            id: z.string().describe("Category ID"),
            sortOrder: z.number().int().min(0).describe("New sort order (0+)"),
          })
        )
        .describe("Array of category ID and sortOrder pairs"),
    },
    async (args: z.infer<typeof ReorderCategoriesSchema>) => {
      const result = await client.post(
        `/api/orgs/${orgSlug}/categories/reorder`,
        args
      );
      return {
        content: [
          {
            type: "text",
            text: `Reordered ${args.categories.length} categories\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "categories_usage",
    "Get category usage analytics: transaction count, total amount, last used date. Only counts POSTED transactions. Optional date range filter (default: last 12 months).",
    {
      from: z
        .string()
        .optional()
        .describe("Start date (ISO format, default: 12 months ago)"),
      to: z.string().optional().describe("End date (ISO format, default: now)"),
    },
    async (args: z.infer<typeof CategoryUsageFilterSchema>) => {
      const result = await client.get(
        `/api/orgs/${orgSlug}/categories/usage`,
        args
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "categories_seed",
    "Seed default income and expense categories for a new organization. Useful during onboarding. Returns count of categories created.",
    {},
    async () => {
      const result = await client.post(`/api/orgs/${orgSlug}/categories/seed`);
      return {
        content: [
          {
            type: "text",
            text: `Seeded default categories\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "categories_delete_with_reassignment",
    "Delete a category and reassign all its transactions to another category. New category must have same type (INCOME or EXPENSE). Returns count of transactions reassigned.",
    {
      categoryId: z.string().describe("Category ID to delete"),
      newCategoryId: z
        .string()
        .describe("Category ID to reassign transactions to (must have same type)"),
    },
    async (
      args: { categoryId: string } & z.infer<typeof DeleteCategoryWithReassignmentSchema>
    ) => {
      const { categoryId, ...data } = args;
      const result = await client.post(
        `/api/orgs/${orgSlug}/categories/${categoryId}/delete-with-reassignment`,
        data
      );
      return {
        content: [
          {
            type: "text",
            text: `Deleted category ${categoryId} and reassigned transactions\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // ACCOUNTS
  // =========================================================================

  server.tool(
    "accounts_list",
    "List all accounts (payment methods, bank accounts). Returns accounts with default flag and active status. Ordered by isDefault desc, name asc. Requires admin or superadmin role.",
    {},
    async () => {
      const result = await client.get(`/api/orgs/${orgSlug}/accounts`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "accounts_create",
    "Create a new account. Setting isDefault=true clears the flag from other accounts. Requires admin or superadmin role.",
    {
      name: z.string().min(1).max(255).describe("Account name (1-255 chars)"),
      description: z
        .string()
        .max(1000)
        .optional()
        .nullable()
        .describe("Account description (max 1000 chars)"),
      isDefault: z.boolean().optional().describe("Set as default account (default false)"),
      active: z.boolean().optional().describe("Active status (default true)"),
    },
    async (args: z.infer<typeof CreateAccountSchema>) => {
      const result = await client.post(`/api/orgs/${orgSlug}/accounts`, args);
      return {
        content: [
          {
            type: "text",
            text: `Created account: ${args.name}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "accounts_update",
    "Update an account. All fields optional. Setting isDefault=true clears the flag from other accounts. Requires admin or superadmin role.",
    {
      accountId: z.string().describe("Account ID to update"),
      name: z.string().min(1).max(255).optional().describe("Account name"),
      description: z.string().max(1000).optional().nullable().describe("Account description"),
      isDefault: z.boolean().optional().describe("Set as default account"),
      active: z.boolean().optional().describe("Active status"),
    },
    async (args: { accountId: string } & z.infer<typeof UpdateAccountSchema>) => {
      const { accountId, ...data } = args;
      const result = await client.patch(
        `/api/orgs/${orgSlug}/accounts/${accountId}`,
        data
      );
      return {
        content: [
          {
            type: "text",
            text: `Updated account ${accountId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "accounts_balances",
    "Get account balances for a date range. Calculation: (Income - Expense) per account. Only counts POSTED transactions. Optional date range (default: last 30 days).",
    {
      from: z.string().optional().describe("Start date (ISO format, default: 30 days ago)"),
      to: z.string().optional().describe("End date (ISO format, default: now)"),
    },
    async (args: z.infer<typeof AccountBalancesFilterSchema>) => {
      const result = await client.get(
        `/api/orgs/${orgSlug}/accounts/balances`,
        args
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // =========================================================================
  // VENDORS
  // =========================================================================

  server.tool(
    "vendors_list",
    "List vendors (expense payees) with optional search and transaction totals. If date range provided, includes transaction count and total amount for that period (POSTED EXPENSE transactions only).",
    {
      query: z.string().optional().describe("Search vendor name (case-insensitive)"),
      from: z
        .string()
        .optional()
        .describe("Start date for totals (ISO format, requires 'to')"),
      to: z.string().optional().describe("End date for totals (ISO format, requires 'from')"),
    },
    async (args: z.infer<typeof VendorFilterSchema>) => {
      const result = await client.get(`/api/orgs/${orgSlug}/vendors`, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "vendors_create",
    "Create a new vendor. Name must be unique (case-insensitive).",
    {
      name: z.string().min(1).max(255).describe("Vendor name (1-255 chars, unique)"),
      email: z.string().email().optional().nullable().describe("Email address"),
      phone: z.string().optional().nullable().describe("Phone number"),
      notes: z.string().optional().nullable().describe("Additional notes"),
    },
    async (args: z.infer<typeof CreateVendorSchema>) => {
      const result = await client.post(`/api/orgs/${orgSlug}/vendors`, args);
      return {
        content: [
          {
            type: "text",
            text: `Created vendor: ${args.name}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "vendors_update",
    "Update a vendor. All fields optional.",
    {
      vendorId: z.string().describe("Vendor ID to update"),
      name: z.string().min(1).max(255).optional().describe("Vendor name"),
      email: z.string().email().optional().nullable().describe("Email address"),
      phone: z.string().optional().nullable().describe("Phone number"),
      notes: z.string().optional().nullable().describe("Additional notes"),
    },
    async (args: { vendorId: string } & z.infer<typeof UpdateVendorSchema>) => {
      const { vendorId, ...data } = args;
      const result = await client.patch(
        `/api/orgs/${orgSlug}/vendors/${vendorId}`,
        data
      );
      return {
        content: [
          {
            type: "text",
            text: `Updated vendor ${vendorId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "vendors_merge",
    "Merge two vendors: reassign all transactions from source to target, then delete source vendor. Returns count of transactions merged.",
    {
      sourceVendorId: z.string().describe("Vendor ID to merge from (will be deleted)"),
      targetVendorId: z.string().describe("Vendor ID to merge into (will receive transactions)"),
    },
    async (args: z.infer<typeof MergeVendorSchema>) => {
      const result = await client.post(`/api/orgs/${orgSlug}/vendors/merge`, args);
      return {
        content: [
          {
            type: "text",
            text: `Merged vendor ${args.sourceVendorId} into ${args.targetVendorId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // CLIENTS
  // =========================================================================

  server.tool(
    "clients_list",
    "List clients (income payers) with optional search and transaction totals. If date range provided, includes transaction count and total amount for that period (POSTED INCOME transactions only).",
    {
      query: z.string().optional().describe("Search client name (case-insensitive)"),
      from: z
        .string()
        .optional()
        .describe("Start date for totals (ISO format, requires 'to')"),
      to: z.string().optional().describe("End date for totals (ISO format, requires 'from')"),
    },
    async (args: z.infer<typeof ClientFilterSchema>) => {
      const result = await client.get(`/api/orgs/${orgSlug}/clients`, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "clients_create",
    "Create a new client. Name must be unique (case-insensitive).",
    {
      name: z.string().min(1).max(255).describe("Client name (1-255 chars, unique)"),
      email: z.string().email().optional().nullable().describe("Email address"),
      phone: z.string().optional().nullable().describe("Phone number"),
      notes: z.string().optional().nullable().describe("Additional notes"),
    },
    async (args: z.infer<typeof CreateClientSchema>) => {
      const result = await client.post(`/api/orgs/${orgSlug}/clients`, args);
      return {
        content: [
          {
            type: "text",
            text: `Created client: ${args.name}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "clients_update",
    "Update a client. All fields optional.",
    {
      clientId: z.string().describe("Client ID to update"),
      name: z.string().min(1).max(255).optional().describe("Client name"),
      email: z.string().email().optional().nullable().describe("Email address"),
      phone: z.string().optional().nullable().describe("Phone number"),
      notes: z.string().optional().nullable().describe("Additional notes"),
    },
    async (args: { clientId: string } & z.infer<typeof UpdateClientSchema>) => {
      const { clientId, ...data } = args;
      const result = await client.patch(
        `/api/orgs/${orgSlug}/clients/${clientId}`,
        data
      );
      return {
        content: [
          {
            type: "text",
            text: `Updated client ${clientId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "clients_merge",
    "Merge two clients: reassign all transactions from source to target, then delete source client. Returns count of transactions merged.",
    {
      sourceClientId: z.string().describe("Client ID to merge from (will be deleted)"),
      targetClientId: z.string().describe("Client ID to merge into (will receive transactions)"),
    },
    async (args: z.infer<typeof MergeClientSchema>) => {
      const result = await client.post(`/api/orgs/${orgSlug}/clients/merge`, args);
      return {
        content: [
          {
            type: "text",
            text: `Merged client ${args.sourceClientId} into ${args.targetClientId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // ORGANIZATION
  // =========================================================================

  server.tool(
    "organization_get",
    "Get organization details: ID, name, slug, creation date. Requires admin or superadmin role.",
    {},
    async () => {
      const result = await client.get(`/api/orgs/${orgSlug}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "organization_update",
    "Update organization name or slug. Slug changes require superadmin role. Slug must be unique and follow format rules (lowercase, alphanumeric + hyphens). Requires admin or superadmin role.",
    {
      name: z.string().min(1).max(255).optional().describe("Organization name (1-255 chars)"),
      slug: z
        .string()
        .optional()
        .describe("Organization slug (superadmin only, unique, lowercase, alphanumeric + hyphens)"),
    },
    async (args: z.infer<typeof UpdateOrganizationSchema>) => {
      const result = await client.patch(`/api/orgs/${orgSlug}`, args);
      return {
        content: [
          {
            type: "text",
            text: `Updated organization\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "organization_complete_onboarding",
    "Mark organization onboarding as complete. Validates that at least 1 active income category and 1 active expense category exist. Returns updated organization.",
    {},
    async () => {
      const result = await client.post(
        `/api/orgs/${orgSlug}/complete-onboarding`
      );
      return {
        content: [
          {
            type: "text",
            text: `Completed onboarding\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  // =========================================================================
  // SETTINGS
  // =========================================================================

  server.tool(
    "settings_business_get",
    "Get business settings: business type, address, phone, email, tax ID. Returns null if not yet configured.",
    {},
    async () => {
      const result = await client.get(
        `/api/orgs/${orgSlug}/settings/business`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "settings_business_update",
    "Update business settings. businessName and businessType required. If businessType='Other', businessTypeOther is required. Requires admin or superadmin role.",
    {
      businessName: z.string().min(1).max(255).describe("Business name (1-255 chars)"),
      businessType: z
        .enum(["Freelance", "Consulting", "Agency", "SaaS", "Other"])
        .describe("Business type"),
      businessTypeOther: z
        .string()
        .optional()
        .nullable()
        .describe("Custom business type (required if businessType='Other')"),
      address: z.string().max(1000).optional().nullable().describe("Business address (max 1000 chars)"),
      phone: z.string().max(50).optional().nullable().describe("Phone number (max 50 chars)"),
      email: z.string().email().optional().nullable().describe("Email address"),
      taxId: z.string().max(100).optional().nullable().describe("Tax ID (max 100 chars)"),
    },
    async (args: z.infer<typeof UpdateBusinessSettingsSchema>) => {
      const result = await client.patch(
        `/api/orgs/${orgSlug}/settings/business`,
        args
      );
      return {
        content: [
          {
            type: "text",
            text: `Updated business settings\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "settings_financial_get",
    "Get financial settings: base currency, fiscal year start month, date format, decimal/thousands separators, soft-closed period. Available to all members (need formatting settings).",
    {},
    async () => {
      const result = await client.get(
        `/api/orgs/${orgSlug}/settings/financial`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "settings_financial_update",
    "Update financial settings. All fields required. baseCurrency auto-uppercased. fiscalYearStartMonth: 1-12 (1=January). Decimal and thousands separators must be different. Requires admin or superadmin role.",
    {
      baseCurrency: z
        .string()
        .length(3)
        .describe("Base currency code (3 chars, e.g., USD)"),
      fiscalYearStartMonth: z
        .number()
        .int()
        .min(1)
        .max(12)
        .describe("Fiscal year start month (1-12, 1=January)"),
      dateFormat: z
        .enum(["DD_MM_YYYY", "MM_DD_YYYY", "YYYY_MM_DD"])
        .describe("Date format"),
      decimalSeparator: z.enum(["DOT", "COMMA"]).describe("Decimal separator"),
      thousandsSeparator: z
        .enum(["COMMA", "DOT", "SPACE", "NONE"])
        .describe("Thousands separator (must differ from decimal)"),
    },
    async (args: z.infer<typeof UpdateFinancialSettingsSchema>) => {
      const result = await client.patch(
        `/api/orgs/${orgSlug}/settings/financial`,
        args
      );
      return {
        content: [
          {
            type: "text",
            text: `Updated financial settings\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }
  );
}
