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
  /**
   * The command's own status, as the page reported it -- except a press that
   * landed and changed nothing even after its own wait and second press, which
   * is `no_effect`, never `succeeded`, with `noEffect` saying so (t511).
   */
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
   * One sentence, first of what the act did, when it acted on an element
   * inside an item of a repeating list or a table row: which item, as the page
   * view marks it, with that item's words -- `This acted on item 1/3 (Ana Ruiz,
   * Invoice for March) only, through its "Archive"; no other item was acted on.`
   * (`./press-effect/acted-on.ts`, t504). Information, never a refusal. Absent
   * for an act on nothing in such an item, a look, and a step only written.
   */
  actedOn?: string;
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
  /**
   * The handle of that control, beside its words (t442). The view that printed
   * it is replaced by the next one (Core's context window), and a press often
   * removes what it pressed, so a Flow step written afterwards had only the
   * words to go on and copied the handle of a line of text the press removed:
   * R4a and R4b were refused `evidence_completion_parameters_unresolved` for
   * exactly that. The model's own token, never a locator; absent where the call
   * acted on no control (a look, a navigation, a step only written).
   */
  controlHandle?: string;
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
  /**
   * How many times the node was dispatched before this answer, said only when
   * it was more than once: the first attempt met a transient fault -- a target
   * not drawn yet, a page that said it was busy -- and Core's default retries
   * absorbed it (`./node-retries.ts`, t355). The model sees the final outcome
   * with the attempts counted, never the first attempt's failure.
   */
  attempts?: number;
};

/**
 * What a node that ran against the page says beyond what every node call says:
 * what came of a press that changed nothing (t511). A step only written
 * (`./written-step.ts`) pressed nothing, so its outcome has no such fields.
 */
export type WebNodeRanOutcome = WebNodeOutcome & {
  /**
   * Said with `status: "no_effect"`, and only on a press: it landed, was waited
   * on and, where it may be made twice, pressed once more, and nothing on the
   * page changed -- no line appeared or went, none changed its words, value or
   * state -- naming the open dialog it sits in, if any, as still open
   * (`./press-effect/no-effect.ts`, `./press-effect/settled.ts`, t511).
   * Classifieds step 0038 of `run-mv6qrcdu-a31b44b8` pressed Apply in an open
   * dialog, nothing changed, and the answer was `succeeded`. Never beside
   * `unchangedPress`, whose advice to press again this has already taken.
   */
  noEffect?: string;
  /**
   * Said where the first press changed nothing and only the press's own second
   * press changed the page: the answer is that second press's
   * (`./press-effect/settled.ts`, t511).
   */
  pressedAgain?: string;
};
