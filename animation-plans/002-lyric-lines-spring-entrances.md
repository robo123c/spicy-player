# Plan 002: Migrate Lyric Line Enter/Exit to Springs

**Commit**: b832907  
**Severity**: HIGH (Interruptibility)  
**Location**: `src/components/LyricsView.tsx:1591-2016`

---

## Problem

Lyric lines use fixed-duration transitions on mount/unmount:

```tsx
// LyricsView.tsx:2016
<motion.div
  initial={{ opacity: isPlayed ? 0.3 : 0.6, y: 0 }}
  animate={{
    opacity: isActive ? 1 : isPlayed ? 0.3 : 0.6,
    y: isActive ? 0 : 0,
    scale: isActive ? 1.02 : 1,
  }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
>
```

**Why this breaks**: Not interruptible. Rapid track changes or seeking queue animations.

---

## Solution

Replace with spring config. Lines enter/exit occasionally (per track), so standard spring is fine.

---

## Exact Changes

### `src/components/LyricsView.tsx`

**Current** (lines ~1591-2016):
```tsx
<AnimatePresence mode="wait">
  {lines.map((line, idx) => {
    const isActive = idx === activeIndex;
    const isPreActive = idx === activeIndex - 1;
    const isPlayed = idx < activeIndex;

    return (
      <motion.div
        key={idx}
        className="lyric-line"
        onClick={() => { onSeek?.(line.startTime); }}
        initial={{ opacity: isPlayed ? 0.3 : 0.6, y: 0 }}
        animate={{
          opacity: isActive ? 1 : isPlayed ? 0.3 : 0.6,
          y: isActive ? 0 : 0,
          scale: isActive ? 1.02 : 1,
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ paddingLeft: '0.5em', paddingRight: '0.5em' }}
      >
```

**Target**:
```tsx
const lineSpring = {
  type: 'spring' as const,
  damping: 1.0,
  duration: 0.35,
};

<AnimatePresence mode="wait">
  {lines.map((line, idx) => {
    const isActive = idx === activeIndex;
    const isPreActive = idx === activeIndex - 1;
    const isPlayed = idx < activeIndex;

    // Entrance: fade in + slide up from below
    // Exit: fade out + slide up (symmetric path)
    const initial = isPlayed 
      ? { opacity: 0.3, y: 0, scale: 1 }
      : { opacity: 0, y: 8, scale: 0.98 };
    
    const animate = isActive
      ? { opacity: 1, y: 0, scale: 1.02 }
      : isPlayed
        ? { opacity: 0.3, y: 0, scale: 1 }
        : { opacity: 0.6, y: 0, scale: 1 };
    
    const exit = { opacity: 0, y: -8, scale: 0.98 };

    return (
      <motion.div
        key={idx}
        className="lyric-line"
        onClick={() => { onSeek?.(line.startTime); }}
        initial={initial}
        animate={animate}
        exit={exit}
        transition={{
          opacity: lineSpring,
          y: lineSpring,
          scale: { ...lineSpring, duration: 0.25 },
        }}
        style={{ paddingLeft: '0.5em', paddingRight: '0.5em' }}
      >
```

**Key changes**:
- `initial` differentiated: played lines start at `opacity: 0.3`, new lines enter from `opacity: 0, y: 8`
- `exit` goes `y: -8` (symmetric: enter from +8, exit to -8)
- All transitions use spring config
- Active line gets slight scale (1.02) with spring

---

## Verification

1. **Track change**: Switch tracks rapidly → lines should smoothly retarget, no queue buildup
2. **Seek**: Click lyric line to seek → active line transitions smoothly
3. **Reduced motion**: With `prefers-reduced-motion: reduce`, transitions become near-instant (Plan 004)
4. **Performance**: Profile during track change — no "Animation frame fired" spikes

---

## Scope Boundaries

- Only `LyricsView.tsx` line-level `motion.div` transitions
- Word-level animations separate (Plan 001)

---

## Dependencies

- Plan 003 (shared tokens) — spring duration references token
- Plan 004 (reduced-motion) — spring respects global setting

---

## Status

📋 Planned — ready for execution