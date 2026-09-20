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
// consequence -- moving money, deleting, sending, editing or creating what stays
// -- need the user's say-so, from his instruction or his grant. The model states
// what its own press does (`consequences`), Core decides whether this run may,
// and when it may not Core has already raised the request the person answers.
// See `./permission.ts`.
//
// The one thing this module still does on its own is put the page back. A
// checkbox press toggles, so a tick taken to see what a chosen row reveals is
// untaken once the page has been read: a tick left behind would turn the Flow's
// own tick of that row into an untick. That is housekeeping, not a refusal.

import { actAndCapture, type WebLlmEvidenceGateway, type WebLlmEvidenceToolRequest } from "./capture";
import { webActionPermission } from "./permission";
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
  /** What the model declared this press does: Core's consequence classes, `[]` when it only changes what is shown. */
  consequences: unknown;
};

/**
 * Press the control and return the page it produced, refused as `no_progress`
 * when the page did not change.
 *
 * A press the model declared a lasting consequence for is pressed only when
 * Core permits it; otherwise it is refused as `permission_required`, and the
 * request Core raised goes to the person. A declaration that is not a list of
 * Core's classes is `invalid_input`: nothing is pressed on an unreadable claim.
 */
export async function pressControl(press: WebControlPress): Promise<WebLlmSnapshotBinding> {
  const permission = await webActionPermission({
    check: press.request.permission,
    declared: press.consequences,
    control: { name: press.element.name ?? press.element.text, kind: webControlKind(press.element) },
    verb: "press"
  });
  if (permission === "invalid") recoverable("invalid_input");
  if (permission === "refused") recoverable("permission_required");
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

/** One plain word for what the control is, as the person being asked would call it. */
function webControlKind(element: WebLlmEvidenceElement): string {
  if (element.role && /^[a-z]+$/u.test(element.role)) return element.role;
  if (element.tag === "a") return "link";
  if (isCheckbox(element)) return "checkbox";
  return /^[a-z]+$/u.test(element.tag) ? element.tag : "control";
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
