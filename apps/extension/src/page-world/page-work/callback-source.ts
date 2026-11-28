// What a scheduled callback is, for telling a chain of work from new work
// (`./tracker.ts`, t1094): its source text. A loop that schedules a fresh
// closure each time -- `setTimeout(() => beat(), 700)` after each beacon
// answers, `requestAnimationFrame(() => this.tick())` inside `tick` -- passes a
// new function every time, so identity cannot say it is the same work again;
// its text can. A bound function or a promise's resolver shows only
// `[native code]`, which says nothing of what it does: each one is new work.

type Callable = (...args: unknown[]) => unknown;

/** A reader of callbacks' source text, with the `toString` the page had when the page world installed; undefined where the text says nothing. */
export function createCallbackSources(): (callback: Callable) => string | undefined {
  const text = Function.prototype.toString;
  const known = new WeakMap<object, string | undefined>();
  return (callback) => {
    if (known.has(callback)) return known.get(callback);
    let source: string | undefined;
    try {
      source = text.call(callback);
    } catch {
      /* best-effort: a callback whose text cannot be read (a revoked proxy) is new work each time */
      source = undefined;
    }
    if (source !== undefined && source.includes("[native code]")) source = undefined;
    known.set(callback, source);
    return source;
  };
}
