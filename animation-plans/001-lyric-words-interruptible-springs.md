# Plan 001: Migrate Lyric Word Animations to Interruptible Springs

**Commit**: b832907  
**Severity**: HIGH (Interruptibility)  
**Location**: `src/components/LyricsView.tsx`, `src/lib/lyricsParser.ts`

---

## Problem

Lyric words animate `scale`, `y`, `blur`, `opacity` on every `currentTime` update (~60fps) using fixed-duration Framer Motion transitions:

```tsx
// LyricsView.tsx:3358
<motion.span
  animate={{
    scale: style.scale,
    y: style.yOffset,
    filter: `blur(${style.blur}px)`,
    opacity: style.opacity,
  }}
  transition={{ duration: 0.15, ease: 'easeOut' }}
>
```

**Why this breaks**: Fixed `duration` animations cannot be interrupted. At 60fps, Framer Motion queues a new 150ms animation every frame → massive animation queue, dropped frames, jank. The spring must animate from the *current presentation value* with *velocity handoff*.

---

## Solution

Replace fixed-duration with **critically damped spring** (`damping: 1.0`) that retargets smoothly from current value. Use Framer Motion's spring which is interruptible by default.

---

## Exact Changes

### 1. Update `src/components/LyricsView.tsx`

**Current** (lines ~2797-3360):
```tsx
const style = computeWordStyle(word, currentTime);
const statusClass = style.status === 'Active' ? 'Active'
  : style.status === 'Sung' ? 'Sung' : 'NotSung';

return (
  <motion.span
    key={wi}
    className={`lyric-word gradient-text ${statusClass}`}
    style={{
      '--gradient-position': style.status === 'Active' ? '100%' : '-20%',
    } as React.CSSProperties}
    animate={{
      scale: style.scale,
      y: style.yOffset,
      filter: `blur(${style.blur}px)`,
      opacity: style.opacity,
    }}
    transition={{ duration: 0.15, ease: 'easeOut' }}
  >
    {word.text}{' '}
  </motion.span>
);
```

**Target**:
```tsx
const style = computeWordStyle(word, currentTime);
const statusClass = style.status === 'Active' ? 'Active'
  : style.status === 'Sung' ? 'Sung' : 'NotSung';

// Spring config: critically damped, fast response
const wordSpring = {
  type: 'spring' as const,
  damping: 1.0,
  duration: 0.25, // perceptual duration ~250ms
};

return (
  <motion.span
    key={wi}
    className={`lyric-word gradient-text ${statusClass}`}
    style={{
      '--gradient-position': style.status === 'Active' ? '100%' : '-20%',
    } as React.CSSProperties}
    animate={{
      scale: style.scale,
      y: style.yOffset,
      filter: `blur(${style.blur}px)`,
      opacity: style.opacity,
    }}
    transition={{
      scale: wordSpring,
      y: wordSpring,
      filter: wordSpring,
      opacity: { ...wordSpring, duration: 0.2 }, // opacity slightly faster
    }}
  >
    {word.text}{' '}
  </motion.span>
);
```

**Key changes**:
- `transition` is now an object with per-property spring configs
- `damping: 1.0` = critically damped (no overshoot)
- `duration: 0.25` = perceptual duration (spring settles ~250ms)
- Framer Motion spring **automatically animates from current value** — fully interruptible
- No `velocity` prop needed; spring carries velocity through retarget

### 2. Update `src/lib/lyricsParser.ts` — `computeWordStyle`

**Current** returns discrete values per frame. **No change needed** — the function already computes correct target values. The spring will interpolate smoothly between frames.

**But**: The current progress calculation uses hardcoded thresholds. Verify the progress math produces smooth 0→1 curves for spring targeting.

**Current `computeWordStyle`** (lines ~6222-6700):
```ts
const progress = status === 'Active'
  ? clamp((currentTime - word.startTime) / (word.endTime - word.startTime), 0, 1)
  : 0;
```

This is correct — linear progress 0→1 during word lifetime. Spring will handle easing.

---

## Verification

### Feel-check (required)
1. **Slow motion**: Open DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce" → verify words still animate but faster (spring respects reduced-motion via global token, see Plan 004)
2. **Frame-by-frame**: Record performance profile during playback → check for "Animation frame fired" spikes. Should be flat.
3. **Interrupt test**: Rapidly seek back/forth during a word → word should smoothly retarget, not queue animations.
4. **Real device**: Test on actual hardware (not headless) — verify 60fps sustained.

### Automated checks
- `npm run build` passes
- `npx tsc --noEmit` passes
- No Framer Motion warnings in console ("Animation was interrupted" is expected and good)

---

## Scope Boundaries

- **Only** `LyricsView.tsx` word `motion.span` transitions
- **Only** spring config change — no layout, no new components
- `computeWordStyle` unchanged (already correct)
- Line-level animations (Plan 002) separate

---

## Dependencies

- Plan 003 (shared tokens) — spring duration should reference token
- Plan 004 (reduced-motion) — spring should respect global setting

---

## Status

📋 Planned — ready for execution