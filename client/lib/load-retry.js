/** @param {number} attempt */
export function retryDelay(attempt) {
  const delay = 1000 * 2 ** Math.min(attempt, 5);
  return Math.min(30000, delay * (1 + Math.random() * 0.25));
}

/**
 * Wait between failures; reconnecting resumes immediately, and leaving cancels.
 * @param {number} attempt
 * @param {AbortSignal} signal
 * @returns {Promise<void>}
 */
export function waitToRetry(attempt, signal) {
  return new Promise((resolve, reject) => {
    const events = typeof window === "undefined" ? null : window;
    const cleanup = () => {
      clearTimeout(timer);
      events?.removeEventListener("online", ready);
      signal.removeEventListener("abort", cancel);
    };
    const cancel = () => {
      cleanup();
      reject(signal.reason ?? new DOMException("Canceled", "AbortError"));
    };
    const ready = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      cleanup();
      resolve();
    };
    const timer = setTimeout(ready, retryDelay(attempt));
    events?.addEventListener("online", ready);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
}

/**
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} read
 * @param {AbortSignal} signal
 * @returns {Promise<T>}
 */
export async function loadWithRetry(read, signal) {
  for (let attempt = 0; ; attempt++) {
    if (signal.aborted) throw signal.reason;
    const request = new AbortController();
    const cancel = () => request.abort(signal.reason);
    signal.addEventListener("abort", cancel, { once: true });
    // A stalled connection must not prevent the next attempt forever.
    const timeout = setTimeout(() => request.abort(), 20000);
    try {
      return await read(request.signal);
    } catch (error) {
      if (signal.aborted) throw error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
    }
    await waitToRetry(attempt, signal);
  }
}
