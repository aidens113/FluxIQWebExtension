// The waiting engine every wait is built on, plus the two presence primitives
// `ContentActionDependencies` exposes.
//
// A predicate is re-evaluated on every DOM mutation *and* on a short timer. The
// timer is not belt and braces: a same-document URL change (`history.pushState`)
// mutates nothing, a CSS transition can reveal an element without a mutation,
// and "the page stopped changing" is by definition something that never fires.
// Watching mutations alone misses all three, which is why a wait that could only
// observe mutations could not carry the `url` or `stable` conditions at all.
//
// `wait-conditions.ts` builds the full condition set on `waitUntil`.

/** How often a predicate is re-checked when no DOM mutation would announce the change. */
const POLL_INTERVAL_MS = 50;

/** The timeout a wait uses when the action names none. */
export const DEFAULT_WAIT_TIMEOUT_MS = 10_000;

/** What the engine knows while it waits: when it started, and when the DOM last changed. */
export type WaitProgress = { startedAt: number; lastChangeAt: number };

/**
 * Resolves with the first defined value `evaluate` returns, or `undefined` when
 * `timeoutMs` passes first -- running out of time is an outcome here, not an
 * error, so the caller decides what it means. `evaluate` runs once
 * synchronously, so an already-satisfied wait costs nothing and a throw from it
 * (an invalid selector, say) propagates instead of being retried until the
 * timeout.
 */
export function waitUntil<T>(
  evaluate: (progress: WaitProgress) => T | undefined,
  timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS
): Promise<T | undefined> {
  const startedAt = Date.now();
  const progress: WaitProgress = { startedAt, lastChangeAt: startedAt };
  const immediate = evaluate(progress);
  if (immediate !== undefined) return Promise.resolve(immediate);
  return new Promise<T | undefined>((resolve, reject) => {
    let settled = false;
    const stop = (): void => {
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      observer.disconnect();
    };
    const check = (): void => {
      if (settled) return;
      let value: T | undefined;
      try {
        value = evaluate(progress);
      } catch (error) {
        stop();
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      if (value === undefined) return;
      stop();
      resolve(value);
    };
    const timer = setTimeout(() => {
      stop();
      resolve(undefined);
    }, timeoutMs);
    const poll = setInterval(check, POLL_INTERVAL_MS);
    const observer = new MutationObserver(() => {
      progress.lastChangeAt = Date.now();
      check();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  });
}

/** The page's rendered text, which is what a text wait means by "the page contains". */
export function pageText(): string {
  return document.body?.innerText ?? "";
}

/** Resolves with the first element matching `selector`, or throws when the timeout passes. */
export async function waitForElement(selector: string | undefined, timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS): Promise<Element> {
  if (!selector) throw new Error("Selector is required.");
  const element = await waitUntil((): Element | undefined => document.querySelector(selector) ?? undefined, timeoutMs);
  if (!element) throw new Error(`Timed out waiting for selector: ${selector}`);
  return element;
}

/** Resolves once the page's rendered text contains `text`, or throws when the timeout passes. */
export async function waitForText(text: string, timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS): Promise<void> {
  const found = await waitUntil((): true | undefined => (pageText().includes(text) ? true : undefined), timeoutMs);
  if (!found) throw new Error(`Timed out waiting for text: ${text}`);
}
