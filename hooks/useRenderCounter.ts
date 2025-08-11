import { useEffect, useRef } from 'react';

type TrackValues = Record<string, unknown> | undefined;

function getChangedKeys(prev: Record<string, unknown>, next: Record<string, unknown>): string[] {
  const allKeys = new Set<string>([...Object.keys(prev), ...Object.keys(next)]);
  const changed: string[] = [];
  allKeys.forEach((key) => {
    if (prev[key] !== next[key]) {
      changed.push(key);
    }
  });
  return changed;
}

export function useRenderCounter(label: string, trackValues?: TrackValues): void {
  const renderCountRef = useRef<number>(0);
  const prevValuesRef = useRef<Record<string, unknown>>({});

  // Increment on every render
  renderCountRef.current += 1;

  useEffect(() => {
    if (!__DEV__) return;

    const currentCount = renderCountRef.current;
    // Coerce undefined to empty object for simpler diffing
    const nextValues: Record<string, unknown> = trackValues ?? {};
    const prevValues = prevValuesRef.current;

    const changedKeys = getChangedKeys(prevValues, nextValues);
    if (changedKeys.length > 0) {
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      changedKeys.forEach((key) => {
        changes[key] = { from: prevValues[key], to: nextValues[key] };
      });
      // eslint-disable-next-line no-console
      console.log(`[RenderCounter] ${label} render #${currentCount}`, { changes });
    } else {
      // eslint-disable-next-line no-console
      console.log(`[RenderCounter] ${label} render #${currentCount}`);
    }

    prevValuesRef.current = nextValues;
  });
}

export default useRenderCounter;

