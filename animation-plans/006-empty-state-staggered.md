# Plan 006: Empty State Staggered Entrance (Delight Budget)

**Commit**: b832907  
**Severity**: LOW (Missed Opportunity - Delight)  
**Location**: `src/components/TrackList.tsx` (empty state), `src/App.tsx`

---

## Problem

Empty state (no tracks loaded) appears instantly with zero motion. This is a **rare/first-time** moment — the user's first impression — and the **only place** where generous, delightful animation is appropriate per Apple's "delight budget."

---

## Solution

Staggered **Pop in** entrance:
1. Container fades in + slides up (spring 0.4s)
2. "Load Audio Files" button: delay 60ms, scale 0.9 → 1.05 → 1.0 (damping 0.8)
3. "Load Music Folder" button: delay 120ms, same spring

Only on first mount (not on every filter change).

---

## Exact Changes

### 1. `src/components/TrackList.tsx` — Add entrance animation to empty state

**Current** (lines ~3274-3350):
```tsx
{filtered.length === 0 ? (
  <div className="empty-state" style={{ padding: '2rem' }}>
    <IconMusic stroke={2} size={32} />
    <p className="text-sm">No tracks loaded</p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button onClick={onLoadFiles} ...>Load Audio Files</button>
      <button onClick={onLoadFolder} ...>Load Music Folder</button>
    </div>
  </div>
) : (
```

**Target** — wrap in `motion.div` with `AnimatePresence`:
```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, getSpring } from '@/lib/motion';

// Inside component:
const reduced = useReducedMotion();
const containerSpring = getSpring('slower', reduced); // 0.5s for delight
const buttonSpring = getSpring('slow', reduced); // 0.35s with damping 0.8 for pop

// Override button spring for pop feel
const popSpring = reduced ? { duration: 0.01 } : { 
  type: 'spring' as const, 
  damping: 0.8, 
  duration: 0.35 
};

{filtered.length === 0 ? (
  <AnimatePresence mode="wait">
    <motion.div
      key="empty-state"
      className="empty-state"
      style={{ padding: '2rem' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={containerSpring}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={containerSpring}
      >
        <IconMusic stroke={2} size={32} />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={containerSpring}
        className="text-sm"
      >
        No tracks loaded
      </motion.p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <motion.button
          onClick={onLoadFiles}
          style={{...}}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...popSpring, delay: 0.06 }}
        >
          Load Audio Files
        </motion.button>
        <motion.button
          onClick={onLoadFolder}
          style={{...}}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...popSpring, delay: 0.12 }}
        >
          Load Music Folder
        </motion.button>
      </div>
    </motion.div>
  </AnimatePresence>
) : (
```

**Key details**:
- Only animates on **mount** (key="empty-state" stable)
- `AnimatePresence` handles exit if tracks load (though unlikely)
- Stagger via `delay`: 60ms, 120ms
- `damping: 0.8` = slight overshoot (pop feel) — allowed because **rare frequency**
- Respects reduced-motion via `getSpring`

### 2. `src/App.tsx` — TrackList already handles empty state, no changes needed

---

## Verification

1. **First launch**: Empty state should cascade in — icon → text → button 1 → button 2
2. **Load tracks**: Empty state exits (fade up), track list enters
3. **Reduced motion**: All instant
4. **Feel-check**: Delightful but not distracting — happens once per session

---

## Scope Boundaries

- Only TrackList empty state
- No changes to track list items (those are high-frequency, stay subtle)
- One-time mount animation only

---

## Dependencies

- Plan 003 (tokens) — uses `getSpring`
- Plan 004 (reduced-motion) — uses `useReducedMotion`

---

## Status

📋 Planned — ready for execution