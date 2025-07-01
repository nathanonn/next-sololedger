# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IdeaTree is an AI-powered brainstorming assistant built with Next.js 15.3.4, React 19, and TypeScript. It helps users explore and develop ideas through a visual tree structure with AI-generated content.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Install dependencies
npm install

# Initialize Prisma (if not done)
npx prisma init --datasource-provider sqlite

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15.3.4 with App Router and Turbopack
- **UI**: React 19 + Shadcn UI (Radix primitives) + Tailwind CSS v4
- **State**: React Context + useReducer
- **Database**: Prisma ORM with SQLite
- **AI**: AI SDK with Google Generative AI (Gemini models)
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React (exclusively)

### Project Structure
```
app/           # Next.js pages and layouts (App Router)
components/    # React components
  ui/         # Shadcn UI components (40+ pre-configured)
hooks/        # Custom React hooks
lib/          # Utilities and configurations
  utils.ts    # cn() utility for className merging
notes/        # Project documentation
  rules.md    # Comprehensive coding standards (MUST READ)
  requirements.md # Product requirements
```

### Component Architecture
- Use Server Components by default
- Add `'use client'` only when needed (forms, interactivity)
- Follow functional programming (no classes)
- TypeScript required for all files

### Key Patterns
1. **Server Components First**: Default to RSC, client components only for interactivity
2. **Data Flow**: Top-down props, Context for global state
3. **Error Handling**: Error boundaries + fallback UI
4. **Loading States**: Suspense boundaries with loading.tsx files
5. **Forms**: Controlled with React Hook Form + Zod schemas

### AI Integration
- Use AI SDK with Google provider
- Models: gemini-1.5-flash (fast), gemini-1.5-pro (quality)
- Implement streaming responses for better UX
- Follow rate limiting best practices

### Environment Variables
Create `.env.local` with:
```
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
GEX_ACCESS_TOKEN=optional_gex_token
```

### Coding Standards
- **Naming**: PascalCase (components), camelCase (functions), UPPER_SNAKE (constants)
- **Imports**: Absolute imports using @/ alias
- **State**: Prefer Server Components, minimize client state
- **Accessibility**: WCAG 2.1 Level AA compliance required
- **Icons**: Use only Lucide React icons
- **Auto-save**: Implement for all user data

### Critical Rules
1. Never use class components or class syntax
2. Always use TypeScript with strict typing
3. Implement keyboard navigation (Tab, arrows, Enter, Escape)
4. Follow Server Component patterns from rules.md
5. Use Prisma for all database operations
6. Implement proper error boundaries
7. Test with screen readers for accessibility

For detailed implementation patterns and rules, refer to:
- `notes/rules.md` - Comprehensive coding standards (1198 lines)
- `notes/requirements.md` - Product requirements and user workflows