# Plan 005: ConfigPanel Origin-Aware Spring Entrance

**Commit**: b832907  
**Severity**: HIGH (Physicality & Origin)  
**Location**: `src/components/ConfigPanel.tsx`

---

## Problem

ConfigPanel animates from center (`y: 20`) but trigger is top-right gear icon. Violates **Spatial consistency** (Apple #7): *"Anchor interactions to their source. A menu, popover, or sheet should originate from the element that triggered it."*

Current code:
```tsx
<motion.div
  className="config-panel"
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 20 }}
>
```

---

## Solution

1. Pass trigger element ref from parent (App.tsx)
2. Compute `transform-origin` at trigger position
3. Spring from `scale: 0.95, opacity: 0` at origin
4. Animate `backdrop-filter` blur: `0px → 20px`
5. Exit reverses along same path

---

## Exact Changes

### 1. `src/components/ConfigPanel.tsx`

**Current props**:
```tsx
interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Record<string, string>) => void;
  initialConfig: Record<string, string>;
}
```

**Target props**:
```tsx
interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Record<string, string>) => void;
  initialConfig: Record<string, string>;
  triggerRef?: React.RefObject<HTMLButtonElement | null>; // NEW
}
```

**Current animation** (lines ~927-965):
```tsx
return (
  <motion.div
    className="config-panel"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
  >
```

**Target**:
```tsx
import { useReducedMotion, getSpring } from '@/lib/motion';

const ConfigPanel = ({ isOpen, onClose, onSave, initialConfig, triggerRef }: ConfigPanelProps) => {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [transformOrigin, setTransformOrigin] = useState('top right');
  
  // Compute transform-origin from trigger position
  useEffect(() => {
    if (!triggerRef?.current || !panelRef.current) return;
    
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    
    // Origin relative to panel top-left
    const originX = triggerRect.right - panelRect.left;
    const originY = triggerRect.top - panelRect.top;
    
    setTransformOrigin(`${originX}px ${originY}px`);
  }, [triggerRef, isOpen]);
  
  const spring = getSpring('slow', reduced);
  const fastSpring = getSpring('fast', reduced);
  
  if (!isOpen) return null;
  
  return (
    <motion.div
      ref={panelRef}
      className="config-panel"
      style={{ 
        transformOrigin,
        // Ensure panel positions near trigger
        top: triggerRef?.current ? `${triggerRef.current.getBoundingClientRect().top}px` : undefined,
        right: triggerRef?.current ? `${window.innerWidth - triggerRef.current.getBoundingClientRect().right}px` : undefined,
      } as React.CSSProperties}
      initial={{ opacity: 0, scale: 0.95, filter: 'blur(0px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(20px)' }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(0px)' }}
      transition={{
        opacity: spring,
        scale: spring,
        filter: fastSpring, // blur animates faster
      }}
    >
```

**Note**: The panel is `position: fixed` in CSS. Need to adjust positioning to anchor near trigger.

### 2. `src/styles/index.css` — Update `.config-panel`

**Current**:
```css
.config-panel {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  /* ... */
}
```

**Target**: Remove fixed position, let JS control position:
```css
.config-panel {
  position: fixed;
  /* bottom/right removed — controlled by inline style */
  background: rgba(20,20,20,0.95);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 1.25rem;
  width: 320px;
  backdrop-filter: blur(20px);
  z-index: 100;
  /* Transform origin set inline */
}
```

### 3. `src/App.tsx` — Pass trigger ref

**Current**:
```tsx
<button onClick={() => setShowConfig(true)}>⚙️</button>

<ConfigPanel
  isOpen={showConfig}
  onClose={() => setShowConfig(false)}
  onSave={handleConfigSave}
  initialConfig={config}
/>
```

**Target**:
```tsx
const configTriggerRef = useRef<HTMLButtonElement>(null);

// ...

<button 
  ref={configTriggerRef}
  onClick={() => setShowConfig(true)}
>⚙️</button>

<ConfigPanel
  isOpen={showConfig}
  onClose={() => setShowConfig(false)}
  onSave={handleConfigSave}
  initialConfig={config}
  triggerRef={configTriggerRef}
/>
```

---

## Verification

1. **Open panel**: Click gear → panel scales from gear icon position (top-right)
2. **Close panel**: Click outside/close → panel scales back to gear icon
3. **Resize window**: Trigger position updates, panel re-anchors
4. **Reduced motion**: Panel appears instantly (Plan 004)
5. **Blur animation**: `backdrop-filter` animates `0px → 20px` on enter, `20px → 0px` on exit

---

## Scope Boundaries

- Only ConfigPanel entrance/exit animation
- Requires trigger ref from parent
- Position logic in component (could be extracted to hook)

---

## Dependencies

- Plan 003 (tokens) — uses `getSpring('slow')`
- Plan 004 (reduced-motion) — uses `useReducedMotion`

---

## Status

📋 Planned — ready for execution