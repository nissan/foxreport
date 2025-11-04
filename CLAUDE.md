# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16 application using the App Router architecture with React 19, TypeScript, and Tailwind CSS v4. The project is configured with shadcn/ui components (New York style) and uses pnpm as the package manager.

## Development Commands

```bash
# Start development server (runs on http://localhost:3000)
pnpm dev

# Build production bundle
pnpm build

# Start production server
pnpm start

# Run ESLint
pnpm lint
```

## Architecture & Key Patterns

### File Structure
- `app/` - Next.js App Router pages and layouts (file-based routing)
- `components/` - Reusable React components (will be created when adding shadcn/ui components)
- `lib/` - Utility functions and shared logic
- `public/` - Static assets

### TypeScript Configuration
- Path alias `@/*` maps to the project root (e.g., `@/components`, `@/lib/utils`)
- Strict mode is enabled
- Target: ES2017

### Styling & UI
- **Tailwind CSS v4** with PostCSS configuration
- Uses `@custom-variant dark` for dark mode styling
- Design system based on OKLCH color space for consistent colors
- shadcn/ui components configured with:
  - Style: `new-york`
  - Base color: `zinc`
  - CSS variables enabled
  - Icon library: `lucide-react`
  - Component aliases: `@/components`, `@/components/ui`, `@/lib/utils`

### Adding shadcn/ui Components
The project is configured for shadcn/ui. Add components using:
```bash
npx shadcn@latest add <component-name>
```

Components will be added to `components/ui/` with proper path aliases already configured.

### Utility Function Pattern
Use the `cn()` utility from `@/lib/utils` for conditional className merging:
```typescript
import { cn } from "@/lib/utils"

className={cn("base-classes", conditionalClass && "additional-classes")}
```

### Font Configuration
Uses Geist Sans and Geist Mono fonts from Google Fonts, loaded via `next/font` with CSS variables:
- `--font-geist-sans`
- `--font-geist-mono`

### CSS Architecture
- Tailwind imports with `tw-animate-css` for animations
- Theme tokens defined in `@theme inline` block using CSS custom properties
- Light/dark mode support via `.dark` class
- Base styles applied in `@layer base`

## Important Notes

- This is a new project bootstrapped from `create-next-app`
- Uses React Server Components (RSC) by default
- TypeScript strict mode is enabled - maintain type safety
- Tailwind v4 uses different configuration patterns than v3 (no `tailwind.config.js`)
