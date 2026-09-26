# Plan 004: Global prefers-reduced-motion Support

**Commit**: b832907  
**Severity**: MEDIUM (Accessibility)  
**Location**: `src/styles/index.css`, `src/lib/motion.ts`, `src/main.tsx`, all components

---

## Problem

Zero reduced-motion support. All animations run at full speed regardless of user's OS accessibility setting. Violates WCAG 2.3.3 and Apple's accessibility guidelines.

---

## Solution

1. Global CSS override for CSS animations/transitions
2. Framer Motion `reducedMotion` config + `useReducedMotion` hook
3. Respect reduced-motion in all spring configs

---

## Exact Changes

### 1. `src/styles/index.css` — Global override (already in Plan 003)

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 2. `src/lib/motion.ts` — New file

```tsx
import { useEffect, useState } from 'react';
import { MotionProps } from 'framer-motion';

// Spring configs (perceptual durations)
export const springs = {
  fast: { type: 'spring' as const, damping: 1.0, duration: 0.15 },   // press/tap
  base: { type: 'spring' as const, damping: 1.0, duration: 0.25 },   // standard
  slow: { type: 'spring' as const, damping: 1.0, duration: 0.35 },   // panels, lines
  slower: { type: 'spring' as const, damping: 1.0, duration: 0.5 },  // marketing
};

// Easing curves (for non-spring CSS transitions)
export const easing = {
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  inOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
  drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
};

// Durations in ms
export const duration = {
  instant: 50,
  fast: 150,
  base: 250,
  slow: 350,
  slower: 500,
};

// Hook to detect reduced motion
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(media.matches);
    
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    media.addEventListener('change', handler);
    
    return () => media.removeEventListener('change', handler);
  }, []);
  
  return reduced;
}

// Helper: get spring config respecting reduced motion
export function getSpring(key: keyof typeof springs, reduced?: boolean): MotionProps['transition'] {
  if (reduced) return { duration: 0.01 };
  return springs[key];
}

// Helper: get transition object for multiple properties
export function getTransition(
  reduced: boolean,
  overrides?: Record<string, MotionProps['transition']>
): MotionProps['transition'] {
  if (reduced) return { duration: 0.01 };
  
  const base = springs.base;
  return {
    ...base,
    ...overrides,
  };
}
```

### 3. `src/main.tsx` — Framer Motion reducedMotion config

```tsx
import { MotionConfig } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion';

function AppWithMotionConfig() {
  const reduced = useReducedMotion();
  
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <App />
    </MotionConfig>
  );
}

// In main.tsx render:
<StrictMode>
  <AppWithMotionConfig />
</StrictMode>
```

**Note**: Framer Motion's `reducedMotion` prop on `MotionConfig`:
- `'always'` — all animations instant
- `'never'` — all animations run (default)
- `'user'` — respect OS setting (but we control via hook for consistency)

### 4. Update all components to use `useReducedMotion`

**Pattern** (apply to LyricsView, TrackList, PlayerControls, ConfigPanel):
```tsx
import { useReducedMotion, getSpring } from '@/lib/motion';

const MyComponent = () => {
  const reduced = useReducedMotion();
  const spring = getSpring('base', reduced);
  
  return <motion.div animate={{ x: 100 }} transition={spring} />;
};
```

**For per-property transitions** (LyricsView words):
```tsx
const reduced = useReducedMotion();
const wordSpring = getSpring('base', reduced);
const wordSpringFast = getSpring('fast', reduced);

return (
  <motion.span
    animate={{ scale, y, filter, opacity }}
    transition={{
      scale: wordSpring,
      y: wordSpring,
      filter: wordSpring,
      opacity: wordSpringFast,
    }}
  />
);
```

### 5. CSS-only components (ConfigPanel, buttons)

These automatically respect the global CSS override from step 1. No JS changes needed.

---

## Verification

1. **OS Setting**: System Preferences → Accessibility → Display → Reduce Motion → ON
2. **Reload app** → all animations should be near-instant (0.01ms)
3. **Toggle OFF** → animations return to normal
4. **Check specific**:
   - ConfigPanel open/close: instant
   - Lyric word transitions: instant
   - Progress bar: instant width change
   - Hover states: instant background change
   - Pulse glow on play button: disabled (animation-duration: 0.01ms)

---

## Scope Boundaries

- Global CSS override
- New `src/lib/motion.ts`
- Framer Motion config wrapper
- Component updates to use hook (can be incremental)

---

## Dependencies

- Plan 003 (tokens) — uses same spring configs
- Enables Plan 001, 002, 005 reduced-motion compliance

---

## Status

📋 Planned — ready for execution