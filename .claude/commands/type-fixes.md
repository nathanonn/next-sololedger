- Run `npx tsc --noEmit --project tsconfig.json` to check for TypeScript errors
- If errors are found:
  a. Analyze each TypeScript error carefully
  b. Read the affected files and understand the type issues
  c. Apply appropriate type fixes (add type annotations, fix type mismatches, etc.)
  d. Save the fixed files
  e. Re-run `npx tsc --noEmit --project tsconfig.json` to verify fixes
  f. Repeat this process until no errors remain
- You can ignore errors are primarily missing implementations rather than fundamental type conflicts.
- Document any complex type fixes applied
