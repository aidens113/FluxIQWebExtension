// How a `web.dom.next_page` step presses its pager's control above humanness 0
// (W2, t908): aimed as a person aims, perhaps after one misclick, as every
// other press is (`../../action-runtime/humanness/pager-press.ts` makes it from
// the command). A step at humanness 0, and the read's own paged loop, are given
// none, and each press is `control.click()`, exactly as before.
//
// The press is made in two parts. `prepare` comes before each press: the
// misclick once per step, when Core marked the step safe, then the point the
// press will be aimed at. `press` is the press itself, kept
// synchronous so the cancelled-click check (`./list-change.ts`) can read the
// click once it returns. Between them a step that may take the list into
// another document marks the press again, so the document it loads records the
// press as it was made (`marked`, `resumed`; `./continued-move.ts`).

import type { PageMovePress } from "../../../shared/extraction-continuation";

export type PagerPress = {
  /** Before each press: perhaps one misclick per step, then a fresh aim. Repeated preparation before that press is idempotent. */
  prepare(control: HTMLElement): Promise<void>;
  /** Rechecks the prepared point after the worker acknowledges its mark. False asks for a fresh preparation and mark. */
  ready?(control: HTMLElement): boolean;
  /** Presses `control`: at the prepared point for the prepared control, aimed afresh for any other, else `control.click()`. */
  press(control: HTMLElement): void;
  /** What a mark made from now on says of the press, once `prepare` has run; before, `undefined`. */
  marked(): PageMovePress | undefined;
  /** This document was reached by a press made in the one before: what its mark said of that press. */
  resumed(press: PageMovePress): void;
};
