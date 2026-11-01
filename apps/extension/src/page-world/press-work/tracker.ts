type Mark = { pending: number; observed: boolean; unknown: boolean; released: boolean };
type ClickPath = { composedPath(): EventTarget[] };

/** Tracks only work causally entered through an armed click, never page values. */
export function createPressWorkTracker() {
  const marked = new WeakMap<EventTarget, Mark>();
  const events = new WeakMap<object, Mark[]>();
  const PromiseClass = globalThis.Promise;
  const sourceOf = Function.prototype.toString;
  let active: readonly Mark[] = [];
  const taint = (owners: readonly Mark[]): void => { for (const owner of owners) owner.unknown = true; };
  const current = (): readonly Mark[] => active;
  const run = <T>(owners: readonly Mark[], invoke: () => T): T => {
    if (owners.length === 0) return invoke();
    const before = active;
    active = owners;
    for (const owner of owners) owner.pending += 1;
    const done = (): void => { for (const owner of owners) owner.pending -= 1; };
    try {
      const result = invoke();
      if (result instanceof PromiseClass) {
        // Native await/settlement is not transparently observable here. Do not
        // attach a rejection observer: that changes unhandledrejection behavior.
        taint(owners);
        done();
      } else {
        if (result !== null && (typeof result === "object" || typeof result === "function")) taint(owners);
        done();
      }
      return result;
    } catch (error) { taint(owners);
      done();
      throw error; }
    finally { active = before; }
  };
  return {
    current,
    run,
    taint,
    inspect(callback: Function, owners: readonly Mark[]): void {
      if (owners.length === 0) return;
      try {
        const source = sourceOf.call(callback);
        if (/\b(?:async|await|yield|eval|Function|AsyncFunction)\b|\[native code\]/u.test(source)) taint(owners);
      } catch { taint(owners); }
    },
    arm(target: EventTarget): void {
      const previous = marked.get(target);
      if (previous) previous.released = true;
      const mark: Mark = { pending: 0, observed: false, unknown: false, released: false };
      marked.set(target, mark);
    },
    capture(event: ClickPath, covered: boolean): void {
      const target = event.composedPath()[0];
      const mark = target === undefined ? undefined : marked.get(target);
      if (!mark || mark.released) return;
      mark.observed = true;
      mark.unknown ||= !covered;
      events.set(event, [mark]);
    },
    forEvent: (event: object): readonly Mark[] => events.get(event) ?? [],
    task(owners: readonly Mark[]): () => void {
      for (const owner of owners) owner.pending += 1;
      let finished = false;
      return () => { if (!finished) { finished = true;
        for (const owner of owners) owner.pending -= 1; } };
    },
    state(target: EventTarget): "unknown" | "pending" | "idle" {
      const mark = marked.get(target);
      return !mark || mark.released || !mark.observed || mark.unknown ? "unknown" : mark.pending > 0 ? "pending" : "idle";
    },
    release(target: EventTarget): void {
      const mark = marked.get(target);
      if (mark) { mark.released = true;
        marked.delete(target); }
    }
  };
}

export type PressWorkTracker = ReturnType<typeof createPressWorkTracker>;
