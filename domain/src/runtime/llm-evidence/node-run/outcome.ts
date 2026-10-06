// The outcome `./run.ts` writes onto a node call's result. Its `control` is
// also what the call's draft statement carries (t174/F33).

import type { JsonValue } from "fluxiq/core";

/**
 * What a node call says about itself, beside the page it left behind.
 *
 * Written by name rather than spread, because a field that quietly stops
 * arriving here costs nothing that shows: the model simply reasons with less
 * (`../present.ts`).
 */
export type WebNodeOutcome = {
  ok: true;
  /** The node that ran, as the catalog names it. */
  node: string;
  /** The command's own status, as the page reported it. */
  status: string;
  /** Whether the page looked different afterwards. Absent where it was not compared. */
  pageChanged?: boolean;
  /**
   * Said beside `pageChanged: false` after a press, and nowhere else
   * (`PRESS_AGAIN`): some pages take the first press after they load only as a
   * wake-up. Lane t195's run `run-munuxns5-833f4313` pressed bigbox's Add to cart,
   * saw nothing change, navigated away and back, and did it again for forty
   * decisions without ever pressing twice in a row.
   */
  unchangedPress?: string;
  /**
   * The node ran and the page it left could not be read, however long it was
   * waited for (`../capture.ts`, `captureAfterAction`). The packet then has no
   * page in it, and the next call's own look is where the page is read again.
   */
  pageUnreadable?: true;
  /**
   * One sentence, ahead of `changed`, when the press un-chose the very control
   * it pressed -- or chose it: `This press un-chose "Space Grey": it was chosen
   * before.` (`./press-effect/choice.ts`). Information, never a refusal: the
   * press ran. Absent where the pressed control's choice was left as it was.
   */
  choice?: string;
  /**
   * What a press, a type or a choice changed on the page it stayed on, in the
   * view's line terms: `t941 "Space Grey" no longer marked`,
   * `t968 "Please select a Color." appeared` (`./press-effect/page-changes.ts`). Absent
   * where nothing changed in those terms or it was not compared.
   */
  changed?: string[];
  /** The control it acted on, in the words the model was shown. */
  control?: string;
  /** What a reading node read, whole but for its secrets (`./read-result.ts`). */
  read?: JsonValue;
  /**
   * On a node that ran: this node's successful run is a kind of step a Flow
   * holds and can be added (`add` true when it runs, or `amend_draft` add). It
   * is in the Flow only once added, as the draft entry shows. Until live run
   * `run-mux6nxst-c9bca37c` (D3-2) this was `inFlow`, and a read that ran
   * returned `inFlow: true` and was left `taken`, never added.
   */
  addable?: boolean;
  /** Only on a written step (`write` true), which writing adds to the Flow (`./written-step.ts`). */
  inFlow?: true;
};
