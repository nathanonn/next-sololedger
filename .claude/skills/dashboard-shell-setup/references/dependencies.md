# Dependencies

All dependencies required for implementing the dashboard shell with resizable sidebar.

## Runtime Dependencies

Install with your preferred package manager:

```bash
npm install react-resizable-panels lucide-react
```

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react-resizable-panels` | latest | Resizable panel layout system |
| `lucide-react` | latest | Icon library (only icon lib allowed) |

### shadcn/ui Components

The dashboard shell uses several shadcn/ui components. Install them with:

```bash
npx shadcn@latest add button
npx shadcn@latest add sheet
npx shadcn@latest add dropdown-menu
npx shadcn@latest add avatar
npx shadcn@latest add scroll-area
```

**Required shadcn components:**
- `Button` - Navigation items, menu triggers, toggle buttons
- `Sheet` - Mobile drawer for sidebar
- `DropdownMenu` - User menu and organization switcher
- `Avatar` - User profile display
- `ScrollArea` - Scrollable navigation lists

**Optional shadcn components** (for enhanced features):
- `Dialog` - Modals and confirmations
- `Command` - Command palette integration
- `Tooltip` - Enhanced collapsed sidebar tooltips

## Framework Requirements

The dashboard shell is built for:
- **Next.js:** 15.x (App Router required)
- **React:** 19.x
- **TypeScript:** 5.x (strict mode recommended)

## Tailwind CSS

The implementation relies on Tailwind CSS utility classes. Ensure your `tailwind.config.ts` includes:

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // shadcn/ui theme variables
    },
  },
  plugins: [],
}
export default config
```

## CSS Variables (shadcn/ui)

The dashboard shell uses CSS variables for theming. Ensure your `globals.css` includes shadcn/ui variables:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... other dark mode variables */
  }
}
```

## Type Definitions

All components are fully typed with TypeScript. No additional @types packages are needed beyond what comes with the core dependencies.

## Browser Compatibility

The dashboard shell requires:
- **localStorage:** For persisting sidebar state
- **CSS Grid and Flexbox:** For layout
- **ResizeObserver:** For panel resizing (provided by react-resizable-panels)
- **Modern ES features:** Supported by Next.js transpilation

Tested and compatible with:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Development Dependencies

No additional development dependencies are required beyond your Next.js setup. The implementation uses standard React patterns and TypeScript.

## Optional: Dark Mode

The dashboard shell fully supports dark mode through shadcn/ui's theming system. To enable dark mode:

1. Install next-themes:
   ```bash
   npm install next-themes
   ```

2. Wrap your app with ThemeProvider (see shadcn/ui docs)

3. The dashboard shell will automatically adapt to the theme

## Accessibility Features

The implementation uses Radix UI primitives (via shadcn/ui) which provide:
- Keyboard navigation
- Screen reader support
- Focus management
- ARIA attributes

No additional accessibility libraries are required.

## Performance Considerations

The dashboard shell is optimized for performance:
- Client-side state uses React hooks
- Server components for data fetching
- Minimal re-renders through proper memoization
- LocalStorage operations are debounced
- Navigation state persists across page transitions

## Installation Checklist

- [ ] Install react-resizable-panels
- [ ] Install lucide-react
- [ ] Add required shadcn/ui components (Button, Sheet, DropdownMenu, Avatar, ScrollArea)
- [ ] Verify Tailwind CSS configuration
- [ ] Ensure shadcn/ui CSS variables are in globals.css
- [ ] (Optional) Install next-themes for dark mode
- [ ] (Optional) Add Command component for command palette
