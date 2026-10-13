// Whether a press changed nothing on the page it found, and the sentence that
// says so (t511).
//
// Classifieds step 0038 of `run-mv6qrcdu-a31b44b8` pressed Apply inside an open
// dialog. The dialog stayed open, the select in it still read the value just
// chosen and nothing else moved -- but the look after it was scrolled 19
// pixels further, and the call compared the two packets whole, boxes included,
// so it answered `status: "succeeded"`, `pageChanged: true`. The model went on
// as if the setting had been applied, and a later Cancel threw it away.
//
// **What counts as no effect** is the page staying the same page in every
// respect but where it is drawn and where focus sits (`./unchanged-page.ts`,
// which `pageChanged` reads too), seen whole on both sides: neither capture
// left elements out, and the look after is not still loading or navigating.
// So a toggle whose only change is `aria-pressed`, a disclosure that only
// opened, a counter whose words moved by one are all effects, and a press that
// changed any of them stays a success.
//
// Anything that cannot be judged -- a node other than a press, a page missing
// on either side -- is not said to have had no effect.

import { quotedWords, webLlmElementWords } from "../../page-view";
import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "../../sanitize";
import type { WebRunnableNode } from "../catalog";
import { webPressedControlWords } from "./press-words";
import { webPageUnchanged } from "./unchanged-page";

/** The gateway command a press runs; any node that dispatches it is a press. */
const PRESS_ACTION_TYPE = "web.dom.click";

/**
 * The sentence for a press that changed nothing on the page, or `undefined`:
 * not a press, a page missing or not judgeable on either side, or any change
 * at all. `presses` is how many times the control was pressed, the press's own
 * retry included.
 */
export function webPressNoEffect(
  node: WebRunnableNode,
  before: WebLlmSnapshotBinding | undefined,
  after: WebLlmSnapshotBinding | undefined,
  handle: string | undefined,
  presses = 1
): string | undefined {
  if (node.actionType !== PRESS_ACTION_TYPE || before === undefined || after === undefined) return undefined;
  if (!judgeable(before.evidence, after.evidence) || !webPageUnchanged(before.evidence, after.evidence)) return undefined;
  return sentence(after, handle, presses);
}

/** Both looks saw the whole page, and the one after is not still on its way somewhere. */
function judgeable(before: WebLlmPageEvidence, after: WebLlmPageEvidence): boolean {
  if (before.truncated || after.truncated || before.captureTruncated === true || after.captureTruncated === true) return false;
  return after.loading?.busy !== true && after.loading?.pendingNavigation !== true;
}

function sentence(after: WebLlmSnapshotBinding, handle: string | undefined, presses: number): string {
  const page = after.evidence;
  const element = handle === undefined ? undefined : page.elements.find((candidate) => candidate.target === handle);
  const control = webPressedControlWords(after, handle);
  const pressed = presses > 1 ? `${capital(control)} was pressed twice -- once more after the first press changed nothing -- and` : `${capital(control)} was pressed and`;
  const said = [`${pressed} nothing on the page changed: no line appeared or went, and none changed its words, value or state.`];
  const dialog = element === undefined ? undefined : openDialogOf(page, element);
  if (dialog !== undefined) {
    const named = webLlmElementWords(dialog);
    said.push(`The dialog ${dialog.target}${named === undefined ? "" : ` ${quotedWords(named)}`} it is in is still open, so nothing in it has been applied yet.`);
  }
  said.push("Treat this press as having done nothing: look for what the page still needs, such as a field it wants filled or another control, before pressing it again.");
  return said.join(" ");
}

function capital(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The open dialog the element sits in: the nearest ancestor the packet marks as one. */
function openDialogOf(page: WebLlmPageEvidence, element: WebLlmEvidenceElement): WebLlmEvidenceElement | undefined {
  const byHandle = new Map(page.elements.map((candidate) => [candidate.target, candidate]));
  const seen = new Set<string>();
  for (let at = element.inDialog ?? element.parent; at !== undefined && !seen.has(at); ) {
    seen.add(at);
    const ancestor = byHandle.get(at);
    if (ancestor === undefined) return undefined;
    if (ancestor.isDialog !== undefined) return ancestor;
    at = ancestor.parent;
  }
  return undefined;
}
