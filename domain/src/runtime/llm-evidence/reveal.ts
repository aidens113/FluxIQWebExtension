// Which observed element the reveal tools may press, how an opaque target
// handle the model was given is bound back to a live element, and the press
// itself -- shared by the authoring tool and the runtime recovery option, so
// the two cannot come to disagree about what exploring may do to a page.
//
// Reveal exists so a model can see page structure it needs to author a Flow,
// including structure that only exists after a press: a disclosure, a tab, a
// row's menu, the composer behind "New post", the actions that appear once a
// row is ticked, the page an order link opens. What it may press is decided by
// `control-intent/`: a press that only reveals is allowed, one that commits --
// or one nothing recognises -- is refused.
//
// And it leaves the page as it found it where that costs nothing. A ticked row
// is unticked again once the page has been read, because nothing a tick reveals
// can be pressed while exploring (bulk actions commit) and a tick left behind
// would turn the Flow's own tick of that row into an untick.

import { actAndCapture, type WebLlmEvidenceGateway, type WebLlmEvidenceToolRequest } from "./capture";
import { webControlIntent, type WebRevealBasis } from "./control-intent";
import type { ResolvedWebLlmEvidenceElement, WebLlmEvidenceElement } from "./elements";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "./sanitize";
import { recoverable } from "./tool-rejection";

/** Why a reveal may press this element, or `undefined` when it may not. */
export function safeRevealElement(element: WebLlmEvidenceElement, page: WebLlmPageEvidence): WebRevealBasis | undefined {
  const intent = webControlIntent(element, page);
  return intent.effect === "reveals" ? intent.basis : undefined;
}

/** One press a reveal tool has already bound to a live element. */
export type WebRevealPress = {
  gateway: WebLlmEvidenceGateway;
  sessionId: string;
  request: WebLlmEvidenceToolRequest;
  /** The capture the target was bound through, taken just before the press. */
  current: WebLlmSnapshotBinding;
  element: ResolvedWebLlmEvidenceElement;
  /** How the caller numbers a capture's handles. The authoring tools keep them stable across captures of one page. */
  restamp: (binding: WebLlmSnapshotBinding) => WebLlmSnapshotBinding;
};

/**
 * Press the element if pressing it only reveals, and return the page it
 * revealed. Refused as `target_unsafe` when the press would commit or nothing
 * says what it does, and as `no_progress` when the page did not change.
 */
export async function pressToReveal(press: WebRevealPress): Promise<WebLlmSnapshotBinding> {
  const basis = safeRevealElement(press.element, press.current.evidence);
  if (basis === undefined) return recoverable("target_unsafe");
  const target = { selector: press.element.selector };
  const revealed = press.restamp(await actAndCapture(press.gateway, press.sessionId, press.request, "web.dom.click", target, press.current, press.request.signal));
  // Undone before anything else can refuse, so a refusal cannot leave the row ticked.
  if (basis === "row_selection") await untick(press, revealed);
  if (JSON.stringify(revealed.evidence) === JSON.stringify(press.current.evidence)) recoverable("no_progress");
  return revealed;
}

/**
 * Press the ticked checkbox once more, but only when the revealed page still
 * has exactly that checkbox at that address, still reading as a row
 * selection: a page that re-rendered under the tick is left alone rather than
 * pressed at a position that may now hold something else.
 */
async function untick(press: WebRevealPress, revealed: WebLlmSnapshotBinding): Promise<void> {
  const selector = press.element.selector;
  const same = revealed.evidence.elements.filter((element) => revealed.selectors.get(element.target) === selector);
  if (same.length !== 1 || same[0]!.name !== press.element.name || safeRevealElement(same[0]!, revealed.evidence) !== "row_selection") return;
  await actAndCapture(press.gateway, press.sessionId, press.request, "web.dom.click", { selector }, revealed, press.request.signal);
}

/** The one element a handle names, or a refusal: a handle that names none or several was never observed. */
export function observedElement(evidence: WebLlmPageEvidence, target: string): WebLlmEvidenceElement {
  const matches = evidence.elements.filter((element) => element.target === target);
  if (matches.length !== 1) recoverable("target_unobserved");
  return matches[0]!;
}

/**
 * The element in the current page that the handle the model was given refers
 * to. Handles are positional, so a recapture that reranks the page would move
 * them; the binding goes through the selector recorded when the handle was
 * issued, and the whole call is refused if the page has moved on or the
 * selector no longer names exactly one element.
 */
export function currentElementForReturnedTarget(
  returned: WebLlmSnapshotBinding | undefined,
  current: WebLlmSnapshotBinding,
  target: string
): ResolvedWebLlmEvidenceElement {
  const observedSnapshot = returned ?? current;
  if (observedSnapshot.evidence.location !== current.evidence.location) recoverable("target_unobserved");
  observedElement(observedSnapshot.evidence, target);
  const selector = observedSnapshot.selectors.get(target);
  if (!selector) recoverable("target_unobserved");
  const matches = current.evidence.elements.filter((element) => current.selectors.get(element.target) === selector);
  if (matches.length !== 1) recoverable("target_unobserved");
  return { ...matches[0]!, selector };
}
