// When an action first acted on the page: the press, the key, the value set
// (task speed S10). A step's decision-to-press is the time from Core taking the
// call to this moment, and the content script's own start is not it: between
// the two lie the target's resolution and its actionability checks. Each act
// primitive notes the moment it dispatches; the first note of an action wins,
// and an action that only reads notes nothing. `actions/execute.ts` begins the
// clock for each action and puts the moment on the result as `actedAt`.
//
// The first note also runs the action's `first` hook, before the act itself
// (every primitive notes before it dispatches): the act mark the worker needs to
// tell a press that was made from a page that went away by itself (t968,
// `../act-mark/`).

let actedAt: number | undefined;
let onFirstAct: (() => void) | undefined;

export const actedClock = {
  /** A new action begins: no act yet. `first`, when given, runs once, just before the action first acts. */
  begin(first?: () => void): void {
    actedAt = undefined;
    onFirstAct = first;
  },
  /** The page is acted on now; only the first act of an action is kept. */
  note(at: number = Date.now()): void {
    if (actedAt !== undefined) return;
    actedAt = at;
    const first = onFirstAct;
    onFirstAct = undefined;
    try {
      first?.();
    } catch {
      /* best-effort: the mark is evidence for the worker, and failing to send it never stops the act */
    }
  },
  /** When the current action first acted, if it has. */
  read(): number | undefined {
    return actedAt;
  }
};
