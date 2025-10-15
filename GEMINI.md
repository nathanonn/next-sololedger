# Project Overview

This is a Next.js 15 boilerplate for building SaaS applications. It comes with a production-ready setup that includes email OTP authentication, JWT sessions, and a resizable dashboard shell. The project is built with TypeScript, Tailwind CSS v4, shadcn/ui, and Prisma.

## Key Technologies

*   **Framework:** Next.js 15
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS v4
*   **UI Components:** shadcn/ui
*   **ORM:** Prisma
*   **Authentication:** Email OTP, JWT sessions

## Architecture

The project follows a server-first architecture. It uses Next.js App Router with a clear separation of public and protected routes. The backend logic for authentication and API endpoints is located in the `app/api` directory. The frontend components are organized into `components/ui` for shadcn/ui components and `components/features` for application-specific components.

# Building and Running

## Prerequisites

*   Node.js 18+
*   PostgreSQL 15+
*   npm or yarn

## Installation and Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Set up the database:**
    *   Create a PostgreSQL database.
    *   Copy the `.env.example` file to `.env` and configure the `DATABASE_URL`.
    *   Run the database migrations:
        ```bash
        npx prisma migrate dev
        ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

## Key Commands

*   `npm run dev`: Start the development server.
*   `npm run build`: Create a production build.
*   `npm start`: Serve the production build.
*   `npm run lint`: Run ESLint to check for code quality issues.
*   `npm run seed`: Create a new user account.
*   `npx prisma generate`: Generate the Prisma client.
*   `npx prisma migrate dev`: Create and apply database migrations.
*   `npx prisma studio`: Open the Prisma Studio to view and manage data.

# Development Conventions

*   **Coding Style:** The project uses ESLint to enforce a consistent coding style.
*   **Testing:** The `README.md` does not specify a testing framework, so it is recommended to add one (e.g., Jest, Vitest) for writing unit and integration tests.
*   **Commits:** The `README.md` does not specify a commit message convention, but it is recommended to use a convention like Conventional Commits.
*   **Branching:** The `README.md` does not specify a branching strategy, but it is recommended to use a strategy like GitFlow.
