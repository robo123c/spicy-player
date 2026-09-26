# Plan 003: Shared Easing/Duration Tokens

**Commit**: b832907  
**Severity**: HIGH (Cohesion & Tokens)  
**Location**: `src/styles/index.css`, all component files

---

## Problem

Ad-hoc durations and easings scattered across CSS and Framer Motion:
- CSS: `0.15s`, `0.2s`, `0.3s`, `0.5s`, `0.1s linear`
- Framer Motion: `duration: 0.15`, `0.2`, `0.35`, `ease: 'easeOut'`
- Single easing: `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind `ease-out`)

No token system → inconsistent feel, hard to globally adjust, impossible to implement reduced-motion correctly.

---

## Solution

Define CSS custom properties for all motion tokens. Migrate all components to reference tokens.

---

## Exact Changes

### 1. `src/styles/index.css` — Add token definitions

**Add to `@theme` block** (around line 540):
```css
@theme {
  --font-sans: "Space Grotesk", "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", sans-serif;
  --color-accent: #8b5cf6;
  --color-accent-glow: rgba(139, 92, 246, 0.4);
  
  /* Motion tokens */
  --ease-spring: cubic-bezier(0.4, 0, 0.2, 1);        /* Spring approximation for CSS */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);         /* Standard ease-out */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);     /* Symmetric for reversible */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);      /* Panel/sheet easing */
  
  --duration-instant: 50ms;      /* Press feedback */
  --duration-fast: 150ms;        /* Hover, small transitions */
  --duration-base: 250ms;        /* Standard UI */
  --duration-slow: 350ms;        /* Modals, drawers, panels */
  --duration-slower: 500ms;      /* Marketing, onboarding */
  
  /* Spring perceptual durations (for Framer Motion) */
  --spring-fast: 0.15;           /* Press/tap */
  --spring-base: 0.25;           /* Standard spring */
  --spring-slow: 0.35;           /* Panels, line entrances */
  --spring-slower: 0.5;          /* Marketing */
  
  --animate-fade-in: fade-in var(--duration-base) var(--ease-out);
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
}
```

### 2. `src/styles/index.css` — Reduced-motion overrides

**Add at end of file**:
```css
/* ── Reduced Motion ────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  /* Framer Motion spring override via CSS variable */
  :root {
    --spring-fast: 0;
    --spring-base: 0;
    --spring-slow: 0;
    --spring-slower: 0;
  }
}
```

### 3. Migrate Framer Motion components to use tokens

**Pattern for Framer Motion** (JavaScript can't read CSS vars directly at compile time):
```tsx
// Create shared constants file: src/lib/motion.ts
export const motionTokens = {
  // Spring configs
  springFast: { type: 'spring' as const, damping: 1.0, duration: 0.15 },
  springBase: { type: 'spring' as const, damping: 1.0, duration: 0.25 },
  springSlow: { type: 'spring' as const, damping: 1.0, duration: 0.35 },
  springSlower: { type: 'spring' as const, damping: 1.0, duration: 0.5 },
  
  // Easing for non-spring (CSS transitions)
  easeOut: 'cubic-bezier(0.23, 1, 0.32, 1)',
  easeInOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
  easeDrawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
  
  // Durations (ms)
  duration: {
    instant: 50,
    fast: 150,
    base: 250,
    slow: 350,
    slower: 500,
  },
};

// Reduced motion detection
export const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(media.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);
  return reduced;
};
```

**Usage in components**:
```tsx
import { motionTokens, useReducedMotion } from '@/lib/motion';

const MyComponent = () => {
  const reduced = useReducedMotion();
  const spring = reduced ? { duration: 0.01 } : motionTokens.springBase;
  
  return <motion.div animate={{ x: 100 }} transition={spring} />;
};
```

### 4. Migrate CSS transitions to tokens

**Current** (examples):
```css
.ctrl-btn { transition: all 0.2s ease; }
.track-item { transition: background 0.15s ease; }
.lyric-word { transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); }
.progress-fill { transition: width 0.1s linear; }
```

**Target**:
```css
.ctrl-btn { transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out); }
.track-item { transition: background var(--duration-fast) var(--ease-out); }
.lyric-word { transition: transform var(--duration-fast) var(--ease-spring), opacity var(--duration-fast) var(--ease-out); }
.progress-fill { transition: width var(--duration-instant) linear; }
```

**Note**: Avoid `transition: all` — specify properties explicitly for performance.

---

## Verification

1. **Build passes**: `npm run build`
2. **Token consistency**: Search for hardcoded durations/easings → should be minimal
3. **Reduced motion**: Toggle OS setting → all animations become near-instant
3. **Visual parity**: Compare before/after — motion feel identical

---

## Scope Boundaries

- Token definitions in `index.css`
- New `src/lib/motion.ts` for Framer Motion
- Migration of all components (can be done incrementally)
- No behavior changes — only tokenization

---

## Dependencies

- Enables Plan 001, 002, 004, 005 spring configs
- Required for Plan 004 reduced-motion implementation

---

## Status

📋 Planned — ready for execution