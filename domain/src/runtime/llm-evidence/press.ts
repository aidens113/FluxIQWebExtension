// Pressing one observed control, and binding the opaque handle the model was
// given back to a live element.
//
// There is no allowlist here and no word list. FluxIQ does not decide, from
// what a control looks like, whether a person is allowed to want it pressed:
// the user's instruction is the authority. Until 2026-09-18 this module refused
// anything that was not a `<summary>`, a tab or an `aria-expanded` button, and
// refused anything whose *selector* carried a word like "order" -- so on an
// order-management site every row control was unsafe, and on a scheduler the
// plain "New post" button that opens the composer was unsafe. Measured live
// across three fixtures, not one state-changing job changed the page, because
// the form the Flow had to fill was never opened and so was never in a packet.
//
// What replaces it is not a better list. It is permission: acts with a lasting
// consequence -- completing a purchase, deleting, editing what is already there
// -- need the user's say-so, and when the run does not hold it the run says so
// and asks, rather than refusing on its own judgement. See the seam in
// `pressControl` below; the contract that carries the request out to the person
// is Core's and is not approximated here.
//
// The one thing this module still does on its own is put the page back. A
// checkbox press toggles, so a tick taken to see what a chosen row reveals is
// untaken once the page has been read: a tick left behind would turn the Flow's
// own tick of that row into an untick. That is housekeeping, not a refusal.

import { actAndCapture, type WebLlmEvidenceGateway, type WebLlmEvidenceToolRequest } from "./capture";
import type { ResolvedWebLlmEvidenceElement, WebLlmEvidenceElement } from "./elements";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "./sanitize";
import { recoverable } from "./tool-rejection";

/** One press a tool has already bound to a live element. */
export type WebControlPress = {
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
 * Press the control and return the page it produced, refused as `no_progress`
 * when the page did not change.
 *
 * TODO(permission seam): this is where a press whose consequence lasts --
 * purchase, delete, edit of existing data, sending something outside -- has to
 * ask rather than proceed. It cannot be done from this repository. It needs two
 * things from Core, and a local substitute would be worse than the gap:
 *
 *   1. A permission set carried with the run, issued where `authorizeBuild`
 *      already issues `build_and_adapt`, in classes of consequence rather than
 *      of HTML. This domain would declare which class a press falls in; Core
 *      decides whether the run holds it.
 *   2. A needs-permission outcome that carries a *request* -- the action, its
 *      class, the control as a person would recognise it, and why the run
 *      wanted it -- out to the person, so they can grant or refuse. Core has
 *      the slot (`AutomationStudioExplorationStopReason.operator_approval_required`,
 *      whose outcome is `user_intervention_required`) but it carries only a
 *      fixed sentence, and it is read on the recovery path alone: a Flow being
 *      authored ends with a `flow_bootstrap.*` code and has no such outcome at
 *      all. Both halves are Core contract changes.
 *
 * Until those exist this presses what it is asked to press. That is the
 * deliberate state: a refusal with no way to reach the person was the defect,
 * not the safeguard.
 */
export async function pressControl(press: WebControlPress): Promise<WebLlmSnapshotBinding> {
  const target = { selector: press.element.selector };
  const pressed = press.restamp(await actAndCapture(press.gateway, press.sessionId, press.request, "web.dom.click", target, press.current, press.request.signal));
  // Put back before anything else can refuse, so a `no_progress` cannot leave
  // the row ticked.
  if (isCheckbox(press.element)) await restoreCheckbox(press, pressed);
  if (JSON.stringify(pressed.evidence) === JSON.stringify(press.current.evidence)) recoverable("no_progress");
  return pressed;
}

/**
 * Press the checkbox once more, but only when the page it produced still has
 * exactly that checkbox at that address: a page that re-rendered under the
 * press is left alone rather than pressed at a position that may now hold
 * something else.
 */
async function restoreCheckbox(press: WebControlPress, pressed: WebLlmSnapshotBinding): Promise<void> {
  const selector = press.element.selector;
  const same = pressed.evidence.elements.filter((element) => pressed.selectors.get(element.target) === selector);
  if (same.length !== 1 || same[0]!.name !== press.element.name || !isCheckbox(same[0]!)) return;
  await actAndCapture(press.gateway, press.sessionId, press.request, "web.dom.click", { selector }, pressed, press.request.signal);
}

/** A control whose press toggles, so pressing it again is what puts the page back. */
function isCheckbox(element: WebLlmEvidenceElement): boolean {
  return (element.tag === "input" && element.inputType === "checkbox") || element.role === "checkbox";
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
