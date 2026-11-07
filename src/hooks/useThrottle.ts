import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Returns a throttled value that updates at most once every intervalMs milliseconds.
 */
export function useThrottle<T>(value: T, intervalMs: number = 300): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef<number>(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= intervalMs) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, intervalMs - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, intervalMs]);

  return throttledValue;
}

/**
 * Returns a throttled callback that only fires at most once per intervalMs.
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  intervalMs: number = 300
): (...args: Parameters<T>) => void {
  const callbackRef = useRef<T>(callback);
  const lastRan = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = intervalMs - (now - lastRan.current);

      if (remaining <= 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        lastRan.current = now;
        callbackRef.current(...args);
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          lastRan.current = Date.now();
          timeoutRef.current = null;
          callbackRef.current(...args);
        }, remaining);
      }
    },
    [intervalMs]
  );
}
