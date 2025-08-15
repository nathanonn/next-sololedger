# Next.js Project Rules and Standards

This document defines the comprehensive rules, standards, and best practices for this Next.js 15.3.4 application.
**Database integration has been updated to use Neon Postgres (cloud) with Prisma and pgvector** — no local DB.

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Project Structure](#project-structure)
3. [Code Style and Conventions](#code-style-and-conventions)
4. [Component Architecture](#component-architecture)
5. [Data Management](#data-management)
6. [AI Integration](#ai-integration)
7. [Routing and Navigation](#routing-and-navigation)
8. [Performance Optimization](#performance-optimization)
9. [Testing Strategy](#testing-strategy)
10. [Security Practices](#security-practices)
11. [Error Handling](#error-handling)
12. [Accessibility Standards](#accessibility-standards)

---

## Technology Stack

### Core Framework

- **Next.js 15.3.4** - React framework with App Router
- **React 19** - UI library
- **TypeScript 5.x** - Type-safe JavaScript

### State Management

- **React Context + useReducer** - For complex client-side state
- **Server State** - Leverage Server Components for server-side state
- **Tanstack Query** - For advanced server state management when needed

### Routing

- **Next.js App Router** - File-based routing system
- **Parallel Routes** - For complex layouts
- **Intercepting Routes** - For modals and overlays

### UI Components & Styling

- **Shadcn UI** - Primary component library
- **Radix UI** - Unstyled, accessible components (used by Shadcn)
- **Tailwind CSS** - Utility-first CSS framework
- **CSS Modules** - For component-specific styles when needed
- **clsx** - For conditional class names
- **tailwind-merge** - For merging Tailwind classes

### Icons

- **Lucide React** - ONLY icon library allowed
- No Font Awesome, Material Icons, or other icon libraries

### Data Layer (Updated)

- **Neon Postgres (Cloud)** — primary database (no local DB)
- **Prisma ORM** — type-safe ORM
- **pgvector** — vector embeddings & similarity search
- **Zod** — schema validation for forms and API

> We use Neon’s serverless Postgres with connection pooling and pgvector. Prisma connects via the **Neon serverless driver + Prisma driver adapter** (Edge) or standard Postgres (Node), depending on runtime. ([Neon][1])

### API & Network

- **Axios** — HTTP client for external APIs
- **Server Actions** — For form submissions and mutations
- **Route Handlers** — For REST API endpoints

### AI Integration

- **AI SDK** — Unified interface for AI providers
- **Google Generative AI** — Primary AI provider (Gemini models)
- **Zod** — Schema validation for structured AI outputs
- Provider-agnostic design for future flexibility

### Authentication

- **JWT (JSON Web Tokens)** — Stored in HTTP-only cookies
- **bcrypt** — Password hashing
- **jose** — JWT creation and verification

### Development Tools

- **ESLint** — Code linting
- **Prettier** — Code formatting

---

## Project Structure

```
next-ideatree/

   
   
   
   
   
   

   
   
   
   

   
   
   
   



   
   




    
```

---

## Code Style and Conventions

### General Principles

- Write concise, technical TypeScript code with accurate examples
- Use functional and declarative programming patterns; avoid classes
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)
- Keep functions small and focused on a single responsibility

### TypeScript Usage

- Use TypeScript for ALL code files
- Prefer interfaces over types for object shapes
- Avoid enums; use const objects with `as const` assertion
- Use strict mode TypeScript configuration
- Define explicit return types for functions

```typescript
// Good - Interface
interface UserData {
  id: string;
  name: string;
  email: string;
}

// Good - Const assertion instead of enum
const UserRole = {
  ADMIN: "admin",
  USER: "user",
  GUEST: "guest",
} as const;

type UserRole = (typeof UserRole)[keyof typeof UserRole];
```

### Naming Conventions

- **Directories**: lowercase with dashes (e.g., `auth-wizard`)
- **Files**: lowercase with dashes (e.g., `auth-wizard.tsx`)
- **Components**: PascalCase for component names
- **Functions**: camelCase for function names
- **Constants**: UPPER_SNAKE_CASE for constants
- **Interfaces/Types**: PascalCase with descriptive names

### File Structure

Components should follow this structure:

```typescript
// 1. Imports
import { useState } from "react";
import { Button } from "@/components/ui/button";

// 2. Types/Interfaces
interface AuthWizardProps {
  onComplete: (data: UserData) => void;
}

// 3. Main component (named export preferred)
export function AuthWizard({ onComplete }: AuthWizardProps) {
  // Component logic
}

// 4. Sub-components (if needed)
function StepIndicator({ currentStep }: { currentStep: number }) {
  // Sub-component logic
}

// 5. Helper functions
function validateEmail(email: string): boolean {
  // Helper logic
}

// 6. Static content/constants
const WIZARD_STEPS = ["Email", "Password", "Profile"] as const;
```

### Syntax Rules

- Use `function` keyword for pure functions
- Use arrow functions for callbacks and inline functions
- Avoid unnecessary curly braces in conditionals
- Use early returns to reduce nesting
- Destructure props and state when possible

```typescript
// Good - Pure function
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Good - Early return
function validateUser(user: User) {
  if (!user.email) return false;
  if (!user.password) return false;
  return true;
}

// Good - Concise conditional
const message = isLoading ? "Loading..." : "Ready";
```

---

## Component Architecture

### Server Components vs Client Components

#### Server Components (Default)

Use Server Components for:

- Data fetching
- Accessing backend resources directly
- Keeping sensitive information on the server
- Static content that doesn't need interactivity

```typescript
// app/products/page.tsx - Server Component
export default async function ProductsPage() {
  const products = await prisma.product.findMany();

  return (
    <div>
      <h1>Products</h1>
      <ProductList products={products} />
    </div>
  );
}
```

#### Client Components

Use Client Components (`'use client'`) for:

- Interactivity (onClick, onChange, etc.)
- State management (useState, useReducer)
- Browser APIs (localStorage, window)
- Third-party libraries that use browser APIs
- Custom hooks

```typescript
// components/features/product-filter.tsx
"use client";

import { useState } from "react";

export function ProductFilter({ onFilter }: ProductFilterProps) {
  const [filters, setFilters] = useState<FilterState>({});

  // Interactive component logic
}
```

### Component Guidelines

1. Start with Server Components
2. Add `'use client'` only when necessary
3. Keep Client Components small and focused
4. Pass serializable props between server and client
5. Use Suspense boundaries for async components

---

## Data Management

### Data Fetching Patterns

#### Server-Side Data Fetching

```typescript
// Parallel data fetching
export default async function DashboardPage() {
  const [user, stats, recentActivity] = await Promise.all([
    getUser(),
    getStats(),
    getRecentActivity(),
  ]);

  return <Dashboard user={user} stats={stats} activity={recentActivity} />;
}
```

#### Caching Strategies

```typescript
// Force cache (default)
const data = await fetch(url, { cache: "force-cache" });

// Revalidate after 1 hour
const data = await fetch(url, { next: { revalidate: 3600 } });

// No cache
const data = await fetch(url, { cache: "no-store" });
```

### State Management Rules

1. Use Server Components for server state
2. React Context for cross-component client state
3. Local state for component-specific state
4. Form state with React Hook Form or native forms
5. URL state for shareable application state

### **Neon Postgres Integration (Prisma + pgvector) — Updated Guidelines**

> We ONLY use the **cloud** database (Neon). No local DB. Migrations run against Neon. SSL is required. ([Neon][2], [GitHub][3])

#### Environment

Create `.env`:

```bash
# Use pooled URL for serverless runtimes (notice "-pooler")
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxxxx-pooler.REGION.aws.neon.tech/DB?sslmode=require"

# (Optional) Direct URL for Prisma Migrate if needed
# DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxxxx.REGION.aws.neon.tech/DB?sslmode=require"
```

- Prefer the **pooled** (`-pooler`) URL for serverless usage. SSL must be enabled via `sslmode=require`. ([Neon][1])

#### Prisma Setup

```bash
npm i prisma @prisma/client
npx prisma init --datasource-provider postgresql
```

`prisma/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"] // keep for Neon adapter (Edge)
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // If you prefer a separate direct connection for Migrate:
  // directUrl = env("DIRECT_URL")
}
```

> The **Prisma driver adapter** enables Prisma to use the **Neon serverless driver** (Edge/Workers) for low-latency HTTP/WebSocket connections. ([Neon][1], [Prisma][4])

#### Runtime Options

**A) Edge/Workers (recommended for Edge routes)**

```bash
npm i @prisma/adapter-neon @neondatabase/serverless ws
npm i -D @types/ws
```

`lib/prisma.ts`:

```ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Enable WebSocket in Node; on Edge you can also use fetch with: neonConfig.poolQueryViaFetch = true
neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });

const globalForPrisma = global as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

> This uses the Neon **serverless driver** with Prisma’s **adapter**, suitable for Edge/serverless environments. ([Neon][1])

**B) Node runtime (standard API routes / route handlers)**

Use the pooled `DATABASE_URL`. Optionally enable **Prisma Accelerate** for global pooling/caching:

```bash
npm i @prisma/extension-accelerate
```

`lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };
const base = globalForPrisma.prisma ?? new PrismaClient();

export const prisma = base.$extends(withAccelerate());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

> Accelerate provides pooled, globally cached access and integrates via `@prisma/extension-accelerate`. Configure an Accelerate connection string if using it. ([Prisma][5], [npm][6])

#### Migrations (Cloud-only)

- We run **all Prisma migrations directly against Neon**.
- If required by your Prisma version, set `DIRECT_URL` for Migrate; otherwise `migrate deploy` on `DATABASE_URL` works with pooled URL.

```bash
npx prisma migrate dev --name init
# or in CI/production:
npx prisma migrate deploy
```

#### pgvector Enablement & Schema

Enable pgvector once per database:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Example table with embeddings (1536 dims) and an HNSW cosine index:

```sql
CREATE TABLE "Document" (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  embedding VECTOR(1536)
);

CREATE INDEX IF NOT EXISTS "Document_embedding_hnsw_cos"
ON "Document"
USING hnsw (embedding vector_cosine_ops);
```

> Neon includes pgvector; use `<=>` for cosine distance. HNSW often provides strong recall/speed tradeoffs for semantic search. ([Neon][7], [GitHub][8])

Reflect schema in Prisma:

```bash
npx prisma db pull
```

You’ll see:

```prisma
model Document {
  id        BigInt     @id @default(autoincrement())
  title     String
  content   String?
  embedding Unsupported("vector")?
}
```

> Prisma currently treats `vector` as `Unsupported("vector")`; use raw SQL for inserts/queries. ([Neon][1])

#### Inserting Embeddings (example)

```ts
// app/api/docs/ingest/route.ts
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

export const runtime = "edge"; // or omit for Node

export async function POST(req: Request) {
  const { title, content } = await req.json();
  const t = `${title}\n\n${content ?? ""}`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const {
    data: [e],
  } = await openai.embeddings.create({
    model: "text-embedding-3-small", // 1536 dims
    input: t,
  });

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Document"(title, content, embedding) VALUES ($1, $2, $3::vector)`,
    title,
    content ?? null,
    JSON.stringify(e.embedding)
  );

  return Response.json({ ok: true }, { status: 201 });
}
```

#### Similarity Search (cosine)

```ts
// app/api/docs/search/route.ts
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

export const runtime = "edge";

export async function POST(req: Request) {
  const { query, k = 5 } = await req.json();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const {
    data: [qv],
  } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT id, title, content,
           1 - (embedding <=> $1::vector) AS cosine_similarity
    FROM "Document"
    ORDER BY embedding <=> $1::vector
    LIMIT $2
    `,
    JSON.stringify(qv.embedding),
    k
  );

  return Response.json({ results: rows });
}
```

> `<=>` is the pgvector **cosine** distance operator (lower is closer). You can also use `<->` (L2) or `<#>` (inner product). ([Neon][9])

### Prisma Best Practices

```typescript
// Always use typed queries
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { posts: true },
});

// Use transactions for related operations
const [userCreated, profile] = await prisma.$transaction([
  prisma.user.create({ data: userData }),
  prisma.profile.create({ data: profileData }),
]);

// Implement proper error handling
try {
  const result = await prisma.user.create({ data });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle specific Prisma errors
  }
}
```

**Neon-specific tips**

- Prefer pooled connection strings (`-pooler`).
- Ensure `sslmode=require`.
- For cold-start sensitive paths, consider `connect_timeout` in the URL.
- Edge routes: use **Neon serverless driver + Prisma adapter**.
- Node routes: pooled URL; optionally **Accelerate** for global pooling/caching. ([Neon][2], [Prisma][5])

---

## AI Integration

### AI Provider Setup

#### Installation

```bash
# Core AI SDK and Google provider
npm install ai @ai-sdk/google zod

# Future providers (when needed)
# npm install @ai-sdk/openai @ai-sdk/anthropic
```

#### Environment Configuration

```bash
# .env.local
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key-here

# Future providers
# OPENAI_API_KEY=your-openai-key
# ANTHROPIC_API_KEY=your-anthropic-key
```

#### Provider Initialization

```typescript
// lib/ai/provider.ts
import { google } from "@ai-sdk/google";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Default provider using environment variable
export const aiProvider = google;

// Custom provider for specific configurations
export const customProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Model aliases for easy switching
export const models = {
  fast: "gemini-2.5-flash",
  smart: "gemini-2.5-pro",
} as const;

// Provider-agnostic model getter
export function getModel(type: keyof typeof models) {
  return aiProvider(models[type]);
}
```

### Model Usage Guidelines

#### Available Gemini Models

- **gemini-2.5-pro** — Best for complex reasoning and creative tasks
- **gemini-2.5-flash** — Optimized for speed and cost-efficiency

#### Model Selection Criteria

```typescript
const fastModel = getModel("fast"); // simple/real-time
const smartModel = getModel("smart"); // complex/code/content
```

### Implementation Patterns

#### Server Component Usage

```typescript
// app/ai-content/page.tsx
import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";

export default async function AIContentPage() {
  const { text } = await generateText({
    model: getModel("smart"),
    system: "You are a helpful assistant",
    prompt: "Explain the benefits of server components",
    temperature: 0.7,
    maxTokens: 500,
  });

  return (
    <div className="prose">
      <h1>AI Generated Content</h1>
      <div>{text}</div>
    </div>
  );
}
```

#### Client Component with Streaming

```typescript
// components/ai/chat-interface.tsx
"use client";

import { useChat } from "ai/react";

export function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({ api: "/api/chat" });

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`mb-4 ${m.role === "user" ? "text-right" : "text-left"}`}
          >
            <div
              className={`inline-block p-3 rounded-lg ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="text-center text-muted-foreground">
            AI is thinking...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          className="w-full p-2 border rounded"
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
```

#### API Route Handler

```typescript
// app/api/chat/route.ts
import { streamText } from "ai";
import { getModel } from "@/lib/ai/provider";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = await streamText({
      model: getModel("fast"),
      messages,
      system: "You are a helpful assistant. Be concise and friendly.",
      temperature: 0.7,
      maxTokens: 1000,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
```

#### Structured Output Generation

```typescript
// app/api/generate-structured/route.ts
import { generateObject } from "ai";
import { getModel } from "@/lib/ai/provider";
import { z } from "zod";

const ProductSchema = z.object({
  name: z.string(),
  description: z.string(),
  features: z.array(z.string()),
  price: z.number(),
  category: z.string(),
});

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const { object } = await generateObject({
    model: getModel("smart"),
    schema: ProductSchema,
    prompt,
  });

  return Response.json(object);
}
```

#### Vision/Multimodal Support

```typescript
// app/api/analyze-image/route.ts
import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";

export async function POST(req: Request) {
  const formData = await req.formData();
  const image = formData.get("image") as File;

  const imageData = await image.arrayBuffer();
  const base64 = Buffer.from(imageData).toString("base64");

  const { text } = await generateText({
    model: getModel("smart"),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this image" },
          { type: "image", image: `data:${image.type};base64,${base64}` },
        ],
      },
    ],
  });

  return Response.json({ analysis: text });
}
```

### Best Practices

#### Provider Abstraction

```typescript
// lib/ai/registry.ts
import { createProviderRegistry } from "ai";
import { google } from "@ai-sdk/google";

export const registry = createProviderRegistry({ google });

export function getRegistryModel(provider: string, model: string) {
  return registry.languageModel(`${provider}:${model}`);
}
```

#### Error Handling

```typescript
// lib/ai/error-handler.ts
import { APICallError } from "ai";

export async function handleAIOperation<T>(operation: () => Promise<T>) {
  try {
    const data = await operation();
    return { data };
  } catch (error) {
    if (error instanceof APICallError) {
      if (error.statusCode === 429)
        return { error: "Rate limit exceeded. Please try again later." };
      if (error.statusCode === 401)
        return { error: "Invalid API key configuration" };
    }
    console.error("AI operation error:", error);
    return { error: "Failed to process AI request" };
  }
}
```

#### Rate Limiting

```typescript
// lib/ai/rate-limiter.ts
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.statusCode === 429) {
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
```

#### Security Guidelines

1. **Never expose API keys to the client**

   ```typescript
   // BAD
   const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

   // GOOD
   const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
   ```

2. **Validate all AI inputs** (use Zod)

3. **Implement content filtering** if applicable

4. **Use server-only modules** for sensitive operations

---

## Routing and Navigation

### File-Based Routing Structure

```
app/

   
      
   
       

   
   
   
       

    
        
```

### Navigation Best Practices

- Use `<Link>` component for client-side navigation
- Implement loading states with `loading.tsx`
- Handle errors with `error.tsx` boundaries
- Use `notFound()` for 404 scenarios
- Prefetch important routes

```typescript
import Link from "next/link";

// Good - Client-side navigation with prefetch
<Link href="/dashboard" prefetch={true}>
  Dashboard
</Link>;

// Good - Programmatic navigation
import { useRouter } from "next/navigation";
const router = useRouter();
router.push("/dashboard");
```

---

## Performance Optimization

### Image Optimization

```typescript
import Image from "next/image";

<Image
  src="/hero.webp"
  alt="Hero image"
  width={1200}
  height={600}
  priority={true}
  placeholder="blur"
  blurDataURL={shimmerDataUrl}
/>;
```

### Font Optimization

```typescript
// app/layout.tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
```

### Code Splitting

```typescript
import dynamic from "next/dynamic";

const HeavyComponent = dynamic(() => import("@/components/heavy-component"), {
  loading: () => <ComponentSkeleton />,
  ssr: false, // If component uses browser APIs
});
```

---

## Testing Strategy

### Testing Stack

- **Jest** — Unit and integration testing
- **React Testing Library** — Component testing
- **Playwright** — E2E testing
- **MSW** — API mocking

### Testing Structure

```
__tests__/




```

### Testing Rules

1. Write tests for critical user paths
2. Test edge cases and error states
3. Keep tests focused and independent
4. Use descriptive test names
5. Mock external dependencies

```typescript
// Example component test
import { render, screen } from "@testing-library/react";
import { ProductCard } from "@/components/product-card";

describe("ProductCard", () => {
  it("displays product information correctly", () => {
    const product = { id: "1", name: "Test Product", price: 99.99 };
    render(<ProductCard product={product} />);

    expect(screen.getByText("Test Product")).toBeInTheDocument();
    expect(screen.getByText("$99.99")).toBeInTheDocument();
  });
});
```

---

## Security Practices

### Authentication Rules

1. Store JWT in HTTP-only cookies
2. Implement refresh token rotation
3. Use secure password hashing (bcrypt)
4. Validate all inputs with Zod
5. Implement rate limiting

```typescript
// lib/auth/jwt.ts
import { SignJWT, jwtVerify } from "jose";

export async function createToken(payload: TokenPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secret);
}
```

### Security Headers

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}
```

### Environment Variables (Updated)

- Use `NEXT_PUBLIC_` prefix only for client-safe variables
- Never commit `.env` files
- Document all variables in `.env.example`
- Use strong, unique values for secrets

#### Database Configuration

```bash
# .env.example
# Neon (pooled) - REQUIRED
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxxxx-pooler.REGION.aws.neon.tech/DB?sslmode=require"

# Optional direct URL for Prisma Migrate
# DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxxxx.REGION.aws.neon.tech/DB?sslmode=require"
```

> Neon requires SSL; keep `sslmode=require`. Use pooled URLs for serverless. ([Neon][2])

#### AI Service Configuration

```bash
# Server-side only
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-api-key

# Future providers
# OPENAI_API_KEY=your-openai-api-key
# ANTHROPIC_API_KEY=your-anthropic-api-key
```

**AI Environment Variable Guidelines**

1. Never prefix AI keys with `NEXT_PUBLIC_`
2. Validate AI configuration at startup
3. Use separate keys per environment (dev/prod)

---

## Error Handling

### Error Boundaries

```typescript
// app/error.tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="error-container">
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### API Error Handling

```typescript
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export async function POST(request: Request) {
  try {
    // Handle request
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### AI-Specific Error Handling

```typescript
// lib/ai/errors.ts
import { APICallError } from "ai";

export enum AIErrorCode {
  RATE_LIMIT = "AI_RATE_LIMIT",
  INVALID_KEY = "AI_INVALID_KEY",
  MODEL_ERROR = "AI_MODEL_ERROR",
  SAFETY_BLOCK = "AI_SAFETY_BLOCK",
  CONTEXT_LENGTH = "AI_CONTEXT_LENGTH",
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: AIErrorCode,
    public statusCode: number = 500,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

export function handleAIError(error: unknown): AIServiceError {
  if (error instanceof APICallError) {
    switch (error.statusCode) {
      case 429:
        return new AIServiceError(
          "AI rate limit exceeded. Please try again later.",
          AIErrorCode.RATE_LIMIT,
          429,
          true
        );
      case 401:
        return new AIServiceError(
          "Invalid AI API key configuration",
          AIErrorCode.INVALID_KEY,
          401,
          false
        );
      case 400:
        if (error.message.includes("safety")) {
          return new AIServiceError(
            "Content blocked by safety filters",
            AIErrorCode.SAFETY_BLOCK,
            400,
            false
          );
        }
        if (error.message.includes("context length")) {
          return new AIServiceError(
            "Input exceeds maximum context length",
            AIErrorCode.CONTEXT_LENGTH,
            400,
            false
          );
        }
        break;
    }
  }

  return new AIServiceError(
    "An error occurred while processing your AI request",
    AIErrorCode.MODEL_ERROR,
    500,
    true
  );
}
```

#### Client-Side AI Error Handling

```typescript
// hooks/use-ai-error.ts
export function useAIError() {
  const handleError = useCallback((error: any) => {
    if (error.code === "AI_RATE_LIMIT") {
      toast.error("Too many requests. Please wait a moment.");
    } else if (error.code === "AI_SAFETY_BLOCK") {
      toast.warning("Content was blocked by safety filters.");
    } else if (error.code === "AI_CONTEXT_LENGTH") {
      toast.error("Your input is too long. Please shorten it.");
    } else if (error.retryable) {
      toast.error("Temporary issue. Please try again.");
    } else {
      toast.error("An error occurred. Please contact support.");
    }
  }, []);

  return { handleError };
}
```

---

## Accessibility Standards

### WCAG 2.1 Level AA Compliance

1. Proper heading hierarchy
2. Sufficient color contrast (4.5:1 for normal text)
3. Keyboard navigation support
4. ARIA labels where needed
5. Form validation and error messages
6. Focus management

### Accessibility Implementation

```typescript
// Use semantic HTML
<nav aria-label="Main navigation">
  <ul>
    <li><Link href="/home">Home</Link></li>
  </ul>
</nav>

// Proper form labeling
<label htmlFor="email">
  Email Address
  <input id="email" type="email" required aria-describedby="email-error" />
</label>
{errors.email && (
  <span id="email-error" role="alert">{errors.email.message}</span>
)}
```

---

**This is a living document.** Update as patterns evolve, especially around Prisma’s vector type support and Neon features.
