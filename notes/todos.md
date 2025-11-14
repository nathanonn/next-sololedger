# Prisma models & enums

```prisma
/// Enums

enum TransactionType {
  INCOME
  EXPENSE
}

enum TransactionStatus {
  DRAFT
  POSTED
}

enum CategoryType {
  INCOME
  EXPENSE
}

enum DateFormat {
  DD_MM_YYYY
  MM_DD_YYYY
  YYYY_MM_DD
}

enum DecimalSeparator {
  DOT        // "."
  COMMA      // ","
}

enum ThousandsSeparator {
  COMMA      // ","
  DOT        // "."
  SPACE      // " "
  NONE
}

/// Extend existing Organization model (example; merge into your actual model)

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique

  // ...existing fields/relations...

  settings  OrganizationSettings?

  accounts     Account[]
  categories   Category[]
  transactions Transaction[]
}

/// Sololedger-specific models

model OrganizationSettings {
  id                      String             @id @default(cuid())
  organizationId          String             @unique
  organization            Organization       @relation(fields: [organizationId], references: [id])

  // Business details
  businessType            String             // e.g. "Freelance", "Consulting", "Other"
  businessTypeOther       String?            // required in UI when businessType == "Other"
  address                 String?
  phone                   String?
  email                   String?
  taxId                   String?

  // Financial configuration
  baseCurrency            String             // ISO code, e.g. "MYR"
  fiscalYearStartMonth    Int                // 1–12
  dateFormat              DateFormat         @default(DD_MM_YYYY)
  decimalSeparator        DecimalSeparator   @default(DOT)
  thousandsSeparator      ThousandsSeparator @default(COMMA)

  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt
}

model Account {
  id             String        @id @default(cuid())
  organizationId String
  organization   Organization  @relation(fields: [organizationId], references: [id])

  name           String
  description    String?
  isDefault      Boolean       @default(false)
  active         Boolean       @default(true)

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  transactions   Transaction[]
}

model Category {
  id             String        @id @default(cuid())
  organizationId String
  organization   Organization  @relation(fields: [organizationId], references: [id])

  name           String
  type           CategoryType
  parentId       String?
  parent         Category?     @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children       Category[]    @relation("CategoryHierarchy")

  color          String?       // e.g. hex or Tailwind token
  icon           String?       // e.g. name of Lucide icon
  sortOrder      Int           @default(0)
  includeInPnL   Boolean       @default(true)
  active         Boolean       @default(true)

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  transactions   Transaction[]
}

model Transaction {
  id                  String           @id @default(cuid())
  organizationId      String
  organization        Organization     @relation(fields: [organizationId], references: [id])

  accountId           String
  account             Account          @relation(fields: [accountId], references: [id])

  categoryId          String
  category            Category         @relation(fields: [categoryId], references: [id])

  userId              String           // creator/last editor; relate to User if you have it
  // user             User            @relation(fields: [userId], references: [id])

  type                TransactionType
  status              TransactionStatus @default(POSTED)

  // Amount & FX
  amountOriginal      Decimal          @db.Decimal(18, 2)
  currencyOriginal    String           // ISO currency code of original transaction
  exchangeRateToBase  Decimal          @db.Decimal(18, 8) // rate *base = original * rate
  amountBase          Decimal          @db.Decimal(18, 2) // in organization's baseCurrency

  date                DateTime
  description         String

  // Optional fields for future expansion
  vendorName          String?
  tags                String?          // e.g. comma-separated or JSON in future
  notes               String?

  // Soft delete
  deletedAt           DateTime?

  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt
}
```

High-level Sololedger Roadmap (First Milestone)

1. Extend Prisma schema with Sololedger core
   - Add enums: TransactionType, TransactionStatus, CategoryType, DateFormat, DecimalSeparator, ThousandsSeparator.
   - Extend the existing Organization model with a relation to new OrganizationSettings, Account, Category, Transaction.
   - Add OrganizationSettings for business details and financial configuration (baseCurrency, fiscalYearStartMonth, date/number formats).
   - Add Account, Category, and Transaction models as the minimal ledger backbone.
   - Run `npx prisma migrate dev` to create the new tables.

2. Implement two-step onboarding for each business
   - Use/extend `app/onboarding/create-organization`:
     - Step 1 (Business details): Business name, Business type (with “Other” + free-text), address, phone, email, tax ID.
     - Step 2 (Financial configuration): Base currency, fiscal year start month (required); date and number formats (with previews).
   - Persist data into Organization and OrganizationSettings via appropriate API routes (e.g. under `app/api/orgs`).
   - Block completion of onboarding until required fields are filled.
   - After successful onboarding, redirect to the org’s dashboard (e.g. `/o/[orgSlug]/dashboard`).

3. Build basic Accounts and Categories management
   - Under the org scope (e.g. `/o/[orgSlug]/settings/accounts`):
     - List accounts for the business.
     - Create/edit forms with fields: name, description, isDefault, active.
     - Enforce single default account per organization in application logic.
   - Under `/o/[orgSlug]/settings/categories`:
     - List categories with type (income/expense), includeInPnL, active.
     - Simple create/edit forms with name + type + includeInPnL (color/icon/sortOrder can be optional for now).
     - Do not implement drag-and-drop or analytics yet.
   - Ensure at least one income and one expense category exist before allowing full use of transactions (show a friendly prompt if missing).

4. Implement Transactions page for manual entry and listing
   - Add `/o/[orgSlug]/transactions`:
     - Creation form:
       - Fields: type (income/expense), amount, currency, date, description, category, account, status (Draft/Posted).
       - Validate: amount > 0; date not in future (warning or block); category type matches transaction type.
       - For FX: if currency != baseCurrency, either require manual exchange rate entry or use a placeholder (e.g. rate = 1.0) clearly marked for later improvement.
       - Calculate and store amountBase = amountOriginal \* exchangeRateToBase.
     - List view:
       - Columns: date, description, type, category, account, amountBase, status.
       - Show Draft vs Posted badges.
       - Basic filters: date range, type, status (add more filters later).
       - Editing: open row to edit same fields (except id); enforce validations.
       - Deleting: implement soft delete by setting deletedAt; filter deleted rows out of normal views.

5. Create minimal per-business dashboard
   - Add `/o/[orgSlug]/dashboard` or reuse the existing dashboard shell:
     - Compute YTD (or selected range) totals in base currency, using Posted transactions only:
       - Income total.
       - Expense total.
       - Profit/Loss (income - expenses).
     - Show account balances:
       - Sum of Posted transactions per account in base currency.
     - Recent activity:
       - Last 10–20 transactions (including Draft/Posted with clear status).
   - Keep UI simple (cards + tables); charts and advanced filters can come later.

6. Polish UX, naming, and permissions
   - Use “Business” wording in user-facing copy (onboarding, dashboard, navigation), while keeping “organization” in internal code where convenient.
   - Ensure role-based behavior:
     - Owners/Admins can edit business settings and financial configuration.
     - Members can view and manage transactions (according to your requirements), but not change core business settings.
   - Hide or de-emphasize generic boilerplate sections (unrelated admin, AI, integrations) in the main UX until the Sololedger slice is mature.
