// An error that stays until its cause is gone.
//
// The UI audit found both failures this exists to prevent: errors that outlive
// their problem (a "can't reach FluxIQ" line still showing once connected), and
// errors wiped the instant they appear (a refused command whose line the next
// status render hid in the same tick, defect F1). So an error is shown with the
// condition that ends it, and only that condition -- or the person trying again
// -- clears it. A status that arrives without meeting the condition leaves the
// error exactly where it is.

/** One error sentence, with the raw text kept for its tooltip. */
export type StickyErrorText = { sentence: string; detail?: string | undefined };

/** An error sentence and the condition that ends it. */
export type StickyError<S> = {
  /** Shows `sentence` until `causeGone` answers true for a later observed state, or `clear()` is called. */
  show(sentence: string, causeGone: (state: S) => boolean, detail?: string): void;
  /** Clears it: the person is trying again, so the last attempt's error is no longer the news. */
  clear(): void;
  /** Clears it when `state` shows its cause is gone; otherwise leaves it. Answers whether anything changed. */
  observe(state: S): boolean;
  current(): StickyErrorText | undefined;
};

/** Creates an empty sticky error. */
export function createStickyError<S>(): StickyError<S> {
  let shown: (StickyErrorText & { causeGone: (state: S) => boolean }) | undefined;
  return {
    show(sentence, causeGone, detail) {
      shown = { sentence, detail, causeGone };
    },
    clear() {
      shown = undefined;
    },
    observe(state) {
      if (shown === undefined || !shown.causeGone(state)) return false;
      shown = undefined;
      return true;
    },
    current: () => (shown === undefined ? undefined : { sentence: shown.sentence, detail: shown.detail })
  };
}
