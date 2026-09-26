import { useState, useCallback } from 'react';

export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): T {
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      if (timer) clearTimeout(timer);
      setTimer(setTimeout(() => fn(...args), delay));
    },
    [fn, delay, timer],
  ) as T;

  return debounced;
}
