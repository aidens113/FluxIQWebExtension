// When an action first acted on the page: the press, the key, the value set
// (task speed S10). A step's decision-to-press is the time from Core taking the
// call to this moment, and the content script's own start is not it: between
// the two lie the target's resolution and its actionability checks. Each act
// primitive notes the moment it dispatches; the first note of an action wins,
// and an action that only reads notes nothing. `actions/execute.ts` begins the
// clock for each action and puts the moment on the result as `actedAt`.

let actedAt: number | undefined;

export const actedClock = {
  /** A new action begins: no act yet. */
  begin(): void {
    actedAt = undefined;
  },
  /** The page is acted on now; only the first act of an action is kept. */
  note(at: number = Date.now()): void {
    actedAt ??= at;
  },
  /** When the current action first acted, if it has. */
  read(): number | undefined {
    return actedAt;
  }
};
