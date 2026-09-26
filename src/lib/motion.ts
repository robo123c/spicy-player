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
