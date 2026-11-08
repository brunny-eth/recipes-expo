import { AppState, AppStateStatus } from 'react-native';

// 'unknown' / 'extension' etc. are treated as foreground: only an explicit
// background/inactive state means iOS may have suspended us.
const isForeground = (s: AppStateStatus | null | undefined) => s !== 'background' && s !== 'inactive';

/**
 * Records whether the app left the foreground (`background`/`inactive`) while
 * a long request was in flight. Call `stop()` when the request settles.
 */
export function watchBackgrounding(): { wasBackgrounded: () => boolean; stop: () => void } {
  let backgrounded = !isForeground(AppState.currentState);
  const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (!isForeground(next)) backgrounded = true;
  });
  return {
    wasBackgrounded: () => backgrounded,
    stop: () => sub.remove(),
  };
}

export function isAppActive(): boolean {
  return isForeground(AppState.currentState);
}

/**
 * Resolves `true` once the app is `active` (immediately if it already is).
 * Resolves `false` without waiting further if `signal` aborts first.
 * The AppState listener is always removed.
 */
/**
 * Before re-running an interrupted request: wait until the app is active, then
 * pause `delayMs` so the network stack is back. Resolves `false` if `signal`
 * aborts at any point (timer and listeners are cleaned up).
 */
export async function waitToRetry(signal: AbortSignal, delayMs: number): Promise<boolean> {
  if (!(await waitForAppActive(signal))) return false;
  if (delayMs <= 0) return !signal.aborted;
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(!signal.aborted);
    }, delayMs);
    signal.addEventListener('abort', onAbort);
  });
}

export function waitForAppActive(signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  if (isForeground(AppState.currentState)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (value: boolean) => {
      sub.remove();
      signal?.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const onAbort = () => finish(false);
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (isForeground(next)) finish(true);
    });
    signal?.addEventListener('abort', onAbort);
  });
}
