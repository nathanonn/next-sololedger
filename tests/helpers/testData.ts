/**
 * Shared test data fixtures
 */

/**
 * Test organizations
 */
export const testOrganizations = {
  acme: {
    id: "org-acme-id",
    name: "Acme Corp",
    slug: "acme",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  },
  techstart: {
    id: "org-techstart-id",
    name: "TechStart Inc",
    slug: "techstart",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  },
};

/**
 * Test users
 */
export const testUsers = {
  john: {
    id: "user-john-id",
    email: "john@example.com",
    name: "John Doe",
    role: "USER",
    emailVerifiedAt: new Date("2025-01-01"),
    passwordHash: "$2b$12$hashedpassword",
    sessionVersion: 1,
    defaultOrganizationId: testOrganizations.acme.id,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  },
  jane: {
    id: "user-jane-id",
    email: "jane@example.com",
    name: "Jane Smith",
    role: "ADMIN",
    emailVerifiedAt: new Date("2025-01-01"),
    passwordHash: "$2b$12$hashedpassword",
    sessionVersion: 1,
    defaultOrganizationId: testOrganizations.acme.id,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  },
  superadmin: {
    id: "user-superadmin-id",
    email: "admin@example.com",
    name: "Super Admin",
    role: "SUPERADMIN",
    emailVerifiedAt: new Date("2025-01-01"),
    passwordHash: "$2b$12$hashedpassword",
    sessionVersion: 1,
    defaultOrganizationId: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  },
};

/**
 * Test memberships
 */
export const testMemberships = {
  johnAcme: {
    id: "membership-john-acme",
    userId: testUsers.john.id,
    organizationId: testOrganizations.acme.id,
    role: "MEMBER",
    createdAt: new Date("2025-01-01"),
  },
  janeAcme: {
    id: "membership-jane-acme",
    userId: testUsers.jane.id,
    organizationId: testOrganizations.acme.id,
    role: "ADMIN",
    createdAt: new Date("2025-01-01"),
  },
  johnTechstart: {
    id: "membership-john-techstart",
    userId: testUsers.john.id,
    organizationId: testOrganizations.techstart.id,
    role: "MEMBER",
    createdAt: new Date("2025-01-01"),
  },
};

/**
 * Test organization settings
 */
export const testOrgSettings = {
  acme: {
    organizationId: testOrganizations.acme.id,
    baseCurrency: "USD",
    dateFormat: "MM_DD_YYYY",
    decimalSeparator: "DOT",
    thousandsSeparator: "COMMA",
    fiscalYearStartMonth: 1,
    updatedAt: new Date("2025-01-01"),
  },
  techstart: {
    organizationId: testOrganizations.techstart.id,
    baseCurrency: "EUR",
    dateFormat: "DD_MM_YYYY",
    decimalSeparator: "COMMA",
    thousandsSeparator: "DOT",
    fiscalYearStartMonth: 1,
    updatedAt: new Date("2025-01-01"),
  },
};

/**
 * Test API keys
 */
export const testApiKeys = {
  johnAcme: {
    id: "apikey-john-acme",
    userId: testUsers.john.id,
    organizationId: testOrganizations.acme.id,
    name: "Production API Key",
    prefix: "sk_prod",
    secretHash: "$2b$12$hashedapikeysecret",
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date("2025-01-01"),
  },
  johnExpired: {
    id: "apikey-john-expired",
    userId: testUsers.john.id,
    organizationId: testOrganizations.acme.id,
    name: "Expired API Key",
    prefix: "sk_exp",
    secretHash: "$2b$12$hashedexpiredkey",
    expiresAt: new Date("2024-12-31"),
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date("2024-01-01"),
  },
  johnRevoked: {
    id: "apikey-john-revoked",
    userId: testUsers.john.id,
    organizationId: testOrganizations.acme.id,
    name: "Revoked API Key",
    prefix: "sk_rev",
    secretHash: "$2b$12$hashedrevokedkey",
    expiresAt: null,
    revokedAt: new Date("2025-01-15"),
    lastUsedAt: null,
    createdAt: new Date("2024-01-01"),
  },
};

/**
 * Test categories
 */
export const testCategories = {
  revenue: {
    id: "cat-revenue-id",
    organizationId: testOrganizations.acme.id,
    name: "Revenue",
    type: "INCOME",
    parentId: null,
    displayOrder: 1,
    active: true,
    deletedAt: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  },
  expenses: {
    id: "cat-expenses-id",
    organizationId: testOrganizations.acme.id,
    name: "Operating Expenses",
    type: "EXPENSE",
    parentId: null,
    displayOrder: 2,
    active: true,
    deletedAt: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  },
};

/**
 * Test accounts
 */
export const testAccounts = {
  checkingAccount: {
    id: "acc-checking-id",
    organizationId: testOrganizations.acme.id,
    name: "Business Checking",
    type: "BANK_ACCOUNT",
    currency: "USD",
    displayOrder: 1,
    active: true,
    deletedAt: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  },
};

/**
 * Test vendors
 */
export const testVendors = {
  acmeSupplier: {
    id: "vendor-supplier-id",
    organizationId: testOrganizations.acme.id,
    name: "Acme Supplier",
    nameLower: "acme supplier",
    email: "supplier@acme.com",
    phone: null,
    website: null,
    active: true,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  },
};

/**
 * Test clients
 */
export const testClients = {
  bigCustomer: {
    id: "client-customer-id",
    organizationId: testOrganizations.acme.id,
    name: "Big Customer Inc",
    nameLower: "big customer inc",
    email: "contact@bigcustomer.com",
    phone: null,
    website: null,
    active: true,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  },
};

/**
 * Test transactions
 */
export const testTransactions = {
  income: {
    id: "txn-income-id",
    organizationId: testOrganizations.acme.id,
    userId: testUsers.john.id,
    type: "INCOME",
    status: "POSTED",
    amountBase: 1000.0,
    currencyBase: "USD",
    amountSecondary: null,
    currencySecondary: null,
    amountOriginal: 1000.0,
    currencyOriginal: "USD",
    exchangeRateToBase: 1.0,
    date: new Date("2025-01-15"),
    description: "Invoice payment",
    categoryId: testCategories.revenue.id,
    accountId: testAccounts.checkingAccount.id,
    clientId: testClients.bigCustomer.id,
    clientName: testClients.bigCustomer.name,
    vendorId: null,
    vendorName: null,
    notes: null,
    deletedAt: null,
    createdAt: new Date("2025-01-15"),
    updatedAt: new Date("2025-01-15"),
  },
  expense: {
    id: "txn-expense-id",
    organizationId: testOrganizations.acme.id,
    userId: testUsers.john.id,
    type: "EXPENSE",
    status: "POSTED",
    amountBase: 500.0,
    currencyBase: "USD",
    amountSecondary: null,
    currencySecondary: null,
    amountOriginal: 500.0,
    currencyOriginal: "USD",
    exchangeRateToBase: 1.0,
    date: new Date("2025-01-10"),
    description: "Office supplies",
    categoryId: testCategories.expenses.id,
    accountId: testAccounts.checkingAccount.id,
    clientId: null,
    clientName: null,
    vendorId: testVendors.acmeSupplier.id,
    vendorName: testVendors.acmeSupplier.name,
    notes: null,
    deletedAt: null,
    createdAt: new Date("2025-01-10"),
    updatedAt: new Date("2025-01-10"),
  },
};
