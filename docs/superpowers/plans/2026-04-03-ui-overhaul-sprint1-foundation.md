# UI Overhaul Sprint 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Tailwind CSS v4 + shadcn/ui, configure M3 desaturated teal theme, create base components, verify build works with the Chrome extension.

**Architecture:** Tailwind v4 (Vite plugin, no config file) with CSS variables for M3 tokens. shadcn/ui components installed via CLI, restyled with M3 overrides in the CSS layer. Existing styles.css replaced by Tailwind globals + component styles.

**Tech Stack:** Tailwind CSS v4, shadcn/ui (latest), Radix UI, Lucide icons, Inter + JetBrains Mono fonts (bundled via CSS @font-face from CDN or local).

**Spec:** `docs/superpowers/specs/2026-04-03-ui-overhaul-design.md`

---

## File Structure

### New Files
- `src/sidepanel/globals.css` — Tailwind directives + M3 CSS custom properties + base styles
- `src/sidepanel/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `src/sidepanel/components/ui/button.tsx` — shadcn Button with M3 overrides
- `src/sidepanel/components/ui/card.tsx` — shadcn Card with M3 outlined style
- `src/sidepanel/components/ui/badge.tsx` — shadcn Badge with trigger-color variants
- `src/sidepanel/components/ui/toggle-group.tsx` — shadcn ToggleGroup for segmented buttons
- `src/sidepanel/components/ui/scroll-area.tsx` — shadcn ScrollArea
- `src/sidepanel/components/ui/tooltip.tsx` — shadcn Tooltip
- `components.json` — shadcn/ui project configuration

### Modified Files
- `package.json` — Add tailwindcss, @tailwindcss/vite, radix-ui, class-variance-authority, clsx, tailwind-merge, lucide-react
- `vite.config.ts` — Add Tailwind Vite plugin
- `tsconfig.json` — Add `@/` path alias for sidepanel imports
- `src/sidepanel/main.tsx` — Import new globals.css instead of styles.css
- `src/sidepanel/index.html` — Add Inter + JetBrains Mono font links

### Removed Files
- `src/sidepanel/styles.css` — Replaced by globals.css (deleted in Task 6 after migration)

---

### Task 1: Install Tailwind CSS v4 + Vite Plugin

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install Tailwind CSS v4 and Vite plugin**

```bash
cd /Users/Braeden-ai/Developer/PointDev
bun add -d tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Add Tailwind plugin to Vite config**

In `vite.config.ts`, add the import and plugin:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.json'
import { resolve } from 'path'

export default defineConfig({
  plugins: [tailwindcss(), react(), crx({ manifest })],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@': resolve(__dirname, 'src/sidepanel'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
```

- [ ] **Step 3: Add `@/` path alias to tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@/*": ["src/sidepanel/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Verify build still works**

```bash
bun run build
```

Expected: Build succeeds. Tailwind isn't used yet, so no visual change.

- [ ] **Step 5: Verify tests still pass**

```bash
bun run test
```

Expected: 1188 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock vite.config.ts tsconfig.json
git commit -m "chore: install Tailwind CSS v4 with Vite plugin, add @/ path alias"
```

---

### Task 2: Create M3 Theme CSS with Tailwind

**Files:**
- Create: `src/sidepanel/globals.css`

- [ ] **Step 1: Create globals.css with Tailwind directives and M3 tokens**

```css
@import "tailwindcss";

@theme {
  /* M3 Desaturated Teal palette */
  --color-primary: #1d9972;
  --color-primary-container: #eefdf6;
  --color-on-primary: #ffffff;
  --color-on-primary-container: #16503f;

  --color-surface: #f8fafb;
  --color-surface-variant: #f1f4f6;
  --color-on-surface: #1e293b;
  --color-on-surface-variant: #4b5563;

  --color-outline: #e4e8ec;
  --color-outline-variant: #d5f9e8;
  --color-muted: #888888;

  --color-error: #d64545;
  --color-error-container: #fef4f4;
  --color-on-error: #ffffff;
  --color-on-error-container: #962e2e;

  --color-warning: #f59e0b;

  --color-code-bg: #1a1a2e;

  /* Shape tokens */
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Typography */
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", "Fira Code", monospace;
}

/* Dark mode overrides */
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #4dd4a3;
    --color-primary-container: rgba(29, 153, 114, 0.15);
    --color-on-primary: #022c22;
    --color-on-primary-container: #a7f3d0;

    --color-surface: #1a1a2e;
    --color-surface-variant: #2a2a3e;
    --color-on-surface: #e2e8f0;
    --color-on-surface-variant: #9ca3af;

    --color-outline: rgba(255, 255, 255, 0.08);
    --color-outline-variant: rgba(29, 153, 114, 0.2);

    --color-error-container: rgba(214, 69, 69, 0.15);
    --color-on-error-container: #fca5a5;

    --color-code-bg: #0f0f1a;
  }
}

/* Base styles */
body {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface);
  background: var(--color-surface);
  padding: 12px;
  line-height: 1.5;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Recording dot pulse animation */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.animate-pulse-dot {
  animation: pulse 1.5s infinite;
}
```

- [ ] **Step 2: Verify build with new CSS**

```bash
bun run build
```

Expected: Build succeeds. globals.css is not imported anywhere yet.

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/globals.css
git commit -m "feat: add M3 desaturated teal theme tokens in Tailwind v4 CSS"
```

---

### Task 3: Install shadcn/ui Dependencies and Configure

**Files:**
- Modify: `package.json`
- Create: `components.json`
- Create: `src/sidepanel/lib/utils.ts`

- [ ] **Step 1: Install shadcn/ui dependencies**

```bash
cd /Users/Braeden-ai/Developer/PointDev
bun add radix-ui class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 2: Create the cn() utility**

Create `src/sidepanel/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: Create components.json for shadcn CLI**

Create `components.json` in project root:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/sidepanel/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 4: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 5: Verify tests**

```bash
bun run test
```

Expected: 1188 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock components.json src/sidepanel/lib/utils.ts
git commit -m "chore: install shadcn/ui dependencies, create cn() utility and components.json"
```

---

### Task 4: Add Base UI Components via shadcn CLI

**Files:**
- Create: `src/sidepanel/components/ui/button.tsx`
- Create: `src/sidepanel/components/ui/card.tsx`
- Create: `src/sidepanel/components/ui/badge.tsx`
- Create: `src/sidepanel/components/ui/toggle-group.tsx`
- Create: `src/sidepanel/components/ui/scroll-area.tsx`
- Create: `src/sidepanel/components/ui/tooltip.tsx`

- [ ] **Step 1: Install components via shadcn CLI**

```bash
cd /Users/Braeden-ai/Developer/PointDev
npx shadcn@latest add button card badge toggle-group scroll-area tooltip
```

When prompted, accept defaults. The CLI will create files in `src/sidepanel/components/ui/`.

- [ ] **Step 2: Verify components were created**

```bash
ls src/sidepanel/components/ui/
```

Expected: `button.tsx`, `card.tsx`, `badge.tsx`, `toggle-group.tsx`, `scroll-area.tsx`, `tooltip.tsx` (and any dependencies like `toggle.tsx`).

- [ ] **Step 3: Verify build**

```bash
bun run build
```

Expected: Build succeeds. Components aren't used yet but should compile.

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/components/ui/ src/sidepanel/lib/
git commit -m "feat: add shadcn/ui base components (button, card, badge, toggle-group, scroll-area, tooltip)"
```

---

### Task 5: Apply M3 Style Overrides to Button Component

**Files:**
- Modify: `src/sidepanel/components/ui/button.tsx`
- Create: `tests/sidepanel/components/ui/button.test.tsx`

- [ ] **Step 1: Write test for Button variants**

Create `tests/sidepanel/components/ui/button.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '../../src/sidepanel/components/ui/button'

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Start Capture</Button>)
    const btn = screen.getByRole('button', { name: 'Start Capture' })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('rounded-full')
  })

  it('renders destructive variant', () => {
    render(<Button variant="destructive">Stop Capture</Button>)
    const btn = screen.getByRole('button', { name: 'Stop Capture' })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('bg-error')
  })

  it('renders outline variant', () => {
    render(<Button variant="outline">New</Button>)
    const btn = screen.getByRole('button', { name: 'New' })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('border')
  })

  it('renders tonal variant', () => {
    render(<Button variant="tonal">Circle</Button>)
    const btn = screen.getByRole('button', { name: 'Circle' })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('bg-primary-container')
  })

  it('renders disabled state', () => {
    render(<Button disabled>Start Capture</Button>)
    const btn = screen.getByRole('button', { name: 'Start Capture' })
    expect(btn).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test tests/sidepanel/components/ui/button.test.tsx
```

Expected: FAIL — the default shadcn button won't have `rounded-full`, `bg-error`, or `bg-primary-container` classes.

- [ ] **Step 3: Override Button with M3 variants**

Replace the contents of `src/sidepanel/components/ui/button.tsx`:

```tsx
import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-40 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-on-primary rounded-full hover:bg-primary/90',
        destructive:
          'bg-error text-on-error rounded-full hover:bg-error/90',
        outline:
          'border border-outline bg-surface text-on-surface-variant rounded-full hover:bg-surface-variant',
        tonal:
          'bg-primary-container text-on-primary-container rounded-full hover:bg-primary-container/80',
        ghost:
          'text-on-surface-variant rounded-full hover:bg-surface-variant',
      },
      size: {
        default: 'h-10 px-5 py-2 text-sm',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-9 w-9',
        full: 'w-full h-11 px-5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test tests/sidepanel/components/ui/button.test.tsx
```

Expected: All 5 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
bun run test
```

Expected: All tests pass (1188 existing + 5 new).

- [ ] **Step 6: Commit**

```bash
git add src/sidepanel/components/ui/button.tsx tests/sidepanel/components/ui/button.test.tsx
git commit -m "feat: M3 button variants — filled, destructive, outline, tonal, ghost with pill shape"
```

---

### Task 6: Add Font Links and Switch to globals.css

**Files:**
- Modify: `src/sidepanel/index.html`
- Modify: `src/sidepanel/main.tsx`
- Remove: `src/sidepanel/styles.css` (after verifying nothing breaks)

- [ ] **Step 1: Add font links to index.html**

Replace `src/sidepanel/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PointDev</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Switch main.tsx to import globals.css**

Update `src/sidepanel/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './globals.css'

createRoot(document.getElementById('root')!).render(<App />)
```

- [ ] **Step 3: Verify build**

```bash
bun run build
```

Expected: Build succeeds. The sidepanel will look broken because styles.css classes are gone but globals.css doesn't define them yet. This is expected — we're replacing the UI in Sprint 2.

- [ ] **Step 4: Verify tests**

```bash
bun run test
```

Expected: All tests pass (tests don't depend on CSS).

- [ ] **Step 5: Keep styles.css as fallback for now**

Don't delete `styles.css` yet. The existing components still reference those classes. We'll remove it in Sprint 2 when we rewrite the components. For now, import both:

Update `src/sidepanel/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './globals.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)
```

- [ ] **Step 6: Verify the extension loads and renders**

```bash
bun run build
```

Load the unpacked extension from `dist/` and open the sidepanel. It should look the same as before (styles.css still active) but now with Inter and JetBrains Mono fonts applied.

- [ ] **Step 7: Commit**

```bash
git add src/sidepanel/index.html src/sidepanel/main.tsx src/sidepanel/globals.css
git commit -m "feat: switch to Tailwind globals.css with Inter + JetBrains Mono, keep styles.css as fallback"
```

---

### Task 7: Add M3 Badge Variants for Screenshot Triggers

**Files:**
- Modify: `src/sidepanel/components/ui/badge.tsx`
- Create: `tests/sidepanel/components/ui/badge.test.tsx`

- [ ] **Step 1: Write test for Badge trigger variants**

Create `tests/sidepanel/components/ui/badge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../../src/sidepanel/components/ui/badge'

describe('Badge', () => {
  it('renders default variant', () => {
    render(<Badge>Default</Badge>)
    expect(screen.getByText('Default')).toBeInTheDocument()
  })

  it('renders voice trigger variant', () => {
    render(<Badge variant="voice">Voice</Badge>)
    const badge = screen.getByText('Voice')
    expect(badge.className).toContain('bg-purple')
  })

  it('renders frame-diff trigger variant', () => {
    render(<Badge variant="frame-diff">Visual</Badge>)
    const badge = screen.getByText('Visual')
    expect(badge.className).toContain('bg-blue')
  })

  it('renders dwell trigger variant', () => {
    render(<Badge variant="dwell">Dwell</Badge>)
    const badge = screen.getByText('Dwell')
    expect(badge.className).toContain('bg-amber')
  })

  it('renders annotation trigger variant', () => {
    render(<Badge variant="annotation">Annotation</Badge>)
    const badge = screen.getByText('Annotation')
    expect(badge.className).toContain('bg-emerald')
  })

  it('renders status-ok variant', () => {
    render(<Badge variant="status-ok">Granted</Badge>)
    const badge = screen.getByText('Granted')
    expect(badge.className).toContain('text-primary')
  })

  it('renders status-error variant', () => {
    render(<Badge variant="status-error">Denied</Badge>)
    const badge = screen.getByText('Denied')
    expect(badge.className).toContain('text-error')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test tests/sidepanel/components/ui/badge.test.tsx
```

Expected: FAIL — default shadcn badge won't have trigger variants.

- [ ] **Step 3: Override Badge with M3 trigger variants**

Replace `src/sidepanel/components/ui/badge.tsx`:

```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-surface-variant text-on-surface-variant',
        voice: 'bg-purple-100 text-purple-700',
        'frame-diff': 'bg-blue-100 text-blue-700',
        dwell: 'bg-amber-100 text-amber-700',
        annotation: 'bg-emerald-100 text-emerald-700',
        multi: 'bg-pink-100 text-pink-700',
        'status-ok': 'text-primary text-[10px] font-medium',
        'status-error': 'text-error text-[10px] font-medium',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test tests/sidepanel/components/ui/badge.test.tsx
```

Expected: All 7 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
bun run test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/sidepanel/components/ui/badge.tsx tests/sidepanel/components/ui/badge.test.tsx
git commit -m "feat: M3 badge variants — screenshot triggers (voice, frame-diff, dwell, annotation, multi) and status indicators"
```

---

### Task 8: Create PermissionRow Component

**Files:**
- Create: `src/sidepanel/components/ui/permission-row.tsx`
- Create: `tests/sidepanel/components/ui/permission-row.test.tsx`

- [ ] **Step 1: Write test for PermissionRow**

Create `tests/sidepanel/components/ui/permission-row.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PermissionRow } from '../../src/sidepanel/components/ui/permission-row'

describe('PermissionRow', () => {
  it('renders ok status with green dot', () => {
    render(<PermissionRow name="Microphone" status="ok" label="Granted" />)
    expect(screen.getByText('Microphone')).toBeInTheDocument()
    expect(screen.getByText('Granted')).toBeInTheDocument()
  })

  it('renders error status with red dot', () => {
    render(<PermissionRow name="Active Tab" status="error" label="Restricted" />)
    expect(screen.getByText('Active Tab')).toBeInTheDocument()
    expect(screen.getByText('Restricted')).toBeInTheDocument()
  })

  it('renders action link when provided', () => {
    const onAction = vi.fn()
    render(
      <PermissionRow name="Microphone" status="error" label="Denied" action="Setup" onAction={onAction} />
    )
    const link = screen.getByText('Setup →')
    expect(link).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test tests/sidepanel/components/ui/permission-row.test.tsx
```

Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement PermissionRow**

Create `src/sidepanel/components/ui/permission-row.tsx`:

```tsx
import { cn } from '@/lib/utils'

export interface PermissionRowProps {
  name: string
  status: 'ok' | 'error'
  label: string
  action?: string
  onAction?: () => void
}

export function PermissionRow({ name, status, label, action, onAction }: PermissionRowProps) {
  const isError = status === 'error'

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border',
        isError ? 'bg-error-container border-error/20' : 'bg-white border-outline'
      )}
    >
      <div
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          isError ? 'bg-error' : 'bg-primary'
        )}
      />
      <span
        className={cn(
          'text-[11px] flex-1',
          isError ? 'text-on-error-container' : 'text-on-surface-variant'
        )}
      >
        {name}
      </span>
      {action && onAction ? (
        <button
          onClick={onAction}
          className="text-[10px] font-medium text-error underline cursor-pointer bg-transparent border-none p-0"
        >
          {action} →
        </button>
      ) : (
        <span
          className={cn(
            'text-[10px] font-medium',
            isError ? 'text-error' : 'text-primary'
          )}
        >
          {label}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test tests/sidepanel/components/ui/permission-row.test.tsx
```

Expected: All 3 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
bun run test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/sidepanel/components/ui/permission-row.tsx tests/sidepanel/components/ui/permission-row.test.tsx
git commit -m "feat: add PermissionRow component with ok/error states and action link"
```

---

### Task 9: Create SegmentedButton Component

**Files:**
- Create: `src/sidepanel/components/ui/segmented-button.tsx`
- Create: `tests/sidepanel/components/ui/segmented-button.test.tsx`

- [ ] **Step 1: Write test for SegmentedButton**

Create `tests/sidepanel/components/ui/segmented-button.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SegmentedButton } from '../../src/sidepanel/components/ui/segmented-button'

describe('SegmentedButton', () => {
  const options = [
    { value: 'text', label: 'Text' },
    { value: 'json', label: 'JSON' },
    { value: 'markdown', label: 'Markdown' },
  ]

  it('renders all options', () => {
    render(<SegmentedButton options={options} value="text" onChange={() => {}} />)
    expect(screen.getByText('Text')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText('Markdown')).toBeInTheDocument()
  })

  it('highlights active option', () => {
    render(<SegmentedButton options={options} value="json" onChange={() => {}} />)
    const active = screen.getByText('JSON')
    expect(active.className).toContain('bg-white')
  })

  it('calls onChange when option is clicked', () => {
    const onChange = vi.fn()
    render(<SegmentedButton options={options} value="text" onChange={onChange} />)
    fireEvent.click(screen.getByText('Markdown'))
    expect(onChange).toHaveBeenCalledWith('markdown')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test tests/sidepanel/components/ui/segmented-button.test.tsx
```

Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement SegmentedButton**

Create `src/sidepanel/components/ui/segmented-button.tsx`:

```tsx
import { cn } from '@/lib/utils'

export interface SegmentedOption {
  value: string
  label: string
}

export interface SegmentedButtonProps {
  options: SegmentedOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function SegmentedButton({ options, value, onChange, className }: SegmentedButtonProps) {
  return (
    <div className={cn('flex bg-surface-variant rounded-md p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 py-2 text-center text-[11px] font-medium rounded-lg transition-all cursor-pointer border-none',
            value === option.value
              ? 'bg-white text-on-surface shadow-sm'
              : 'bg-transparent text-muted hover:text-on-surface-variant'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test tests/sidepanel/components/ui/segmented-button.test.tsx
```

Expected: All 3 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
bun run test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/sidepanel/components/ui/segmented-button.tsx tests/sidepanel/components/ui/segmented-button.test.tsx
git commit -m "feat: add M3 SegmentedButton component for format tabs and engine toggle"
```

---

### Task 10: Final Verification and Production Build

**Files:** None new — verification only.

- [ ] **Step 1: Run full test suite**

```bash
bun run test
```

Expected: All tests pass (1188 existing + ~18 new).

- [ ] **Step 2: Production build**

```bash
bun run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Load extension and verify**

Load unpacked from `dist/` in chrome://extensions. Open sidepanel. Verify:
- Inter font is applied (compare letter shapes to before)
- Extension loads without console errors
- Existing UI still works (styles.css fallback is active)

- [ ] **Step 4: Verify all new components import correctly**

Create a quick smoke test — add to any existing test file temporarily:

```bash
bun run test tests/sidepanel/components/ui/
```

Expected: All component tests in ui/ pass.

- [ ] **Step 5: Commit any fixes**

If any fixes were needed, commit them:

```bash
git add -A
git commit -m "fix: sprint 1 final verification fixes"
```

---

## Sprint 1 Deliverables Checklist

- [ ] Tailwind CSS v4 installed and building
- [ ] M3 desaturated teal theme tokens in globals.css
- [ ] shadcn/ui configured with components.json
- [ ] `cn()` utility at `@/lib/utils`
- [ ] `@/` path alias working for sidepanel imports
- [ ] Inter + JetBrains Mono fonts loaded
- [ ] Button component with M3 variants (filled, destructive, outline, tonal, ghost)
- [ ] Badge component with trigger variants (voice, frame-diff, dwell, annotation, multi, status)
- [ ] PermissionRow component (ok/error states, action link)
- [ ] SegmentedButton component (M3 segmented style)
- [ ] Card, ScrollArea, Tooltip components installed (default shadcn, M3 override in Sprint 2)
- [ ] All existing 1188 tests still pass
- [ ] Production build succeeds
- [ ] Extension loads in Chrome

## Next Sprint

Sprint 2 (Sidepanel Redesign) will rewrite App.tsx and all sidepanel components using the foundation built here. A separate plan will be written for that sprint.
