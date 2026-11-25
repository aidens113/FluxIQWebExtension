// What a node call changed on the page it found, stated to Core on the draft
// statement (`changed`, `../../../capture.ts`), read from the same walk as the
// outcome's change list (`./walk.ts`, `../page-changes.ts`) so the two
// never disagree (t285, week report W1).
//
// Core reads which step did an act from what the step changed -- the cart
// count rose, "Added to cart" appeared -- and not from the model's label
// alone: run `run-muqiho5c-e830ce01` named its add-to-cart act on "Not now",
// and only the press before it made the cart count rise
// (`AS/runtime/flow-draft/step.ts`, `changed`).
//
// A text line that appeared or went is stated in the cut words the outcome's
// entry quotes. A line of any kind with words on both pages whose words changed
// is stated with its words now: `rose` when they differ only in one number and
// it went up (`./rose.ts`), `reads` otherwise. Never a state-token
// change, never a line without words.
//
// Never a line the page changes by itself (`byPage`, `../self-change/`, t1043): Core
// reads a line that `reads` otherwise as a change the step made that stays, and run
// `run-mww6euuw-ecdb20f8` carried a cookie banner's "Accept all" into the next attempt
// as an act because a carousel turned to its next slide while it was pressed. The
// outcome's change list still shows the model such a line, as the page's own.

import type { WebLlmSnapshotBinding } from "../../../sanitize";
import type { WebRunnableNode } from "../../catalog";
import { webPageChangeWalk, type WebPageChange, type WebPressMade } from "./walk";
import { webChangeWords } from "./words";
import { webIsTextLine as isText } from "../text-line";
import { webWordsRose } from "./rose";

/** One line a call changed, as the draft statement says it to Core. */
export type WebNodePageChangeLine = { words: string; how: "appeared" | "went" | "reads" | "rose" };

/** The most lines a statement says, as Core reads at most. */
const MOST_LINES = 16;

/**
 * What a call changed on the page it found, at most sixteen lines in page
 * order; `undefined` where the outcome says no change list either, or where no
 * changed line is one a statement says. `press`: the control a press was made
 * on, so the page's own changes are left out (header).
 */
export function webNodePageChangeStatement(
  node: WebRunnableNode,
  before: WebLlmSnapshotBinding | undefined,
  after: WebLlmSnapshotBinding | undefined,
  press?: WebPressMade
): WebNodePageChangeLine[] | undefined {
  const lines = (webPageChangeWalk(node, before, after, press) ?? []).flatMap((change) => {
    const line = change.byPage ? undefined : stated(change);
    return line === undefined ? [] : [line];
  });
  return lines.length === 0 ? undefined : lines.slice(0, MOST_LINES);
}

function stated(change: WebPageChange): WebNodePageChangeLine | undefined {
  if (change.kind !== "both") {
    if (!isText(change.line)) return undefined;
    // The outcome says "gone" of a line that went (`../page-changes.ts`).
    const words = webChangeWords.quoted(change.line, change.kind === "went" ? "gone" : "appeared");
    return words === undefined ? undefined : { words, how: change.kind };
  }
  const { was, now } = change;
  if (was.words === undefined || now.words === undefined || was.words === now.words) return undefined;
  const words = webChangeWords.quoted(now, webChangeWords.was(was.words))!;
  return { words, how: webWordsRose(was.words, now.words) ? "rose" : "reads" };
}
