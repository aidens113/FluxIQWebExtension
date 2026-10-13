// The pick itself: the overlay follows the pointer, one press chooses an
// element, and the frame tells the background worker what was chosen.
//
// **Why the listeners are on `window`, in the capture phase, and swallow
// everything.** The recorder listens on `document` in the capture phase
// (`dom-events.ts`). The capture path runs window first, so a listener here
// that calls `stopImmediatePropagation()` runs before the recorder's ever does,
// and the press that picked an element is not also recorded as a click on it.
// `preventDefault()` is the other half: without it the press activates what it
// landed on, and picking a product name would follow its link and leave the
// page the proposal describes. Both are needed, and neither substitutes for the
// other.
//
// The whole press-to-click sequence is swallowed, not just the first event of
// it. A browser sends `pointerdown`, `mousedown`, `pointerup`, `mouseup` and
// `click` for one press (and `contextmenu` and `auxclick` for the other
// buttons); tearing the listeners down on the press would let the tail of its
// own sequence through to the recorder, which is the bug this arrangement
// exists to prevent. So the pick is taken on `pointerdown` and the listeners
// stay up, draining the rest, until the sequence ends at `click` or `auxclick`
// -- with a timer as a backstop, so a sequence that never ends cannot leave a
// page unable to be clicked.
//
// Nothing here reads a page value (decision D3): a list pick sends the
// inference's proposal, which is selectors, labels and counts, and a value pick
// sends where the element is, not what it says.

import {
  EXTRACTION_PICK_CANCELLED_MESSAGE,
  EXTRACTION_PICKED_MESSAGE,
  type ExtractionPickCancelledMessage,
  type ExtractionPickForm,
  type ExtractionPickedElement,
  type ExtractionPickedMessage
} from "../../shared/extraction-messages";
import { testIdFor } from "../describe-element";
import { selectorFor } from "../selector";
import { inferListFromElement } from "../extraction";
import { isExtensionUiNode } from "../picker-host";
import { closePickerOverlay, openPickerOverlay, pointPickerOverlay } from "./overlay";

/** Every event of a press, so none of them reaches the page or the recorder. */
const SWALLOWED_EVENTS = ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "auxclick", "contextmenu"] as const;

/**
 * How long a half-finished press may hold the page before the picker gives it
 * back. Only a sequence that never reaches its `click` can reach this: every
 * swallowed event restarts it.
 */
const DRAIN_TIMEOUT_MS = 10_000;

type PickLease = {
  readonly sessionId: string;
  readonly form: ExtractionPickForm;
  outcome: "picking" | "picked" | "refused";
};

type PickSession = {
  readonly lease: PickLease;
  phase: "picking" | "draining";
  readonly swallow: EventListener;
  readonly track: EventListener;
  readonly escape: EventListener;
  timer?: ReturnType<typeof setTimeout>;
  timerToken?: object;
};

let lease: PickLease | undefined;
let session: PickSession | undefined;
let hovered: Element | undefined;
// IDs prove only local retirement, never arrival order. Retain until this
// content document ends or an explicit administrative reset occurs.
const retired = new Set<string>();

/** Accept an unseen lease or rearm a refused current pick; duplicate starts preserve a successful choice. */
export function startPick(sessionId: string, form: ExtractionPickForm): boolean {
  if (retired.has(sessionId)) return false;
  if (lease?.sessionId === sessionId) {
    if (lease.outcome !== "refused") return true;
    releaseSession(session);
    lease.outcome = "picking";
  } else {
    if (lease) retired.add(lease.sessionId);
    releaseSession(session);
    lease = { sessionId, form, outcome: "picking" };
  }
  const accepted = lease;
  const current: PickSession = {
    lease: accepted, phase: "picking",
    swallow: event => swallowEvent(current, event),
    track: event => trackPointer(current, event as PointerEvent),
    escape: event => cancelOnEscape(current, event as KeyboardEvent)
  };
  session = current;
  openPickerOverlay();
  for (const type of SWALLOWED_EVENTS) window.addEventListener(type, current.swallow, true);
  window.addEventListener("pointermove", current.track, true);
  window.addEventListener("keydown", current.escape, true);
  return true;
}

/** Idempotent matching cancellation; an unseen cancellation fences a later delivery of that same ID. */
export function cancelPick(sessionId: string): void {
  retired.add(sessionId);
  if (lease?.sessionId !== sessionId) return;
  releaseSession(session);
  lease = undefined;
}

/** Confirm only the accepted successful choice, or the compatible idle never-retired definition command. */
export function preparePickRecord(sessionId: string): boolean {
  if (retired.has(sessionId)) return false;
  if (!lease) return true;
  if (lease.sessionId !== sessionId || lease.outcome !== "picked") return false;
  releaseSession(session);
  return true;
}

/** Explicit administrative reset. Ordinary drains, cancellation and replacement never forget retirement. */
export function stopPick(): void {
  releaseSession(session);
  lease = undefined;
  retired.clear();
}

function currentSession(current: PickSession): boolean {
  return session === current && lease === current.lease;
}

/** Gives the page back without discarding a choice awaiting confirmation. */
function releaseSession(current: PickSession | undefined): void {
  if (!current || !currentSession(current)) return;
  if (current.timer !== undefined) clearTimeout(current.timer);
  delete current.timerToken;
  for (const type of SWALLOWED_EVENTS) window.removeEventListener(type, current.swallow, true);
  window.removeEventListener("pointermove", current.track, true);
  window.removeEventListener("keydown", current.escape, true);
  session = undefined;
  hovered = undefined;
  closePickerOverlay();
}

function swallowEvent(current: PickSession, event: Event): void {
  if (!currentSession(current)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (current.phase === "picking" && event.type === "pointerdown") {
    takePick(current, event as PointerEvent);
    return;
  }
  if (current.phase === "draining" && (event.type === "click" || event.type === "auxclick")) {
    releaseSession(current);
    return;
  }
  if (current.phase === "draining") restartDrainTimer(current);
}

/** Structural pick and confirmation ownership outlive the swallowed physical press. */
function takePick(current: PickSession, event: PointerEvent): void {
  current.phase = "draining";
  const target = pickTarget(event);
  const message = pickedMessage(current.lease, target);
  current.lease.outcome = message.proposal || message.element ? "picked" : "refused";
  closePickerOverlay();
  hovered = undefined;
  restartDrainTimer(current);
  void chrome.runtime.sendMessage(message).catch(() => undefined);
}

function restartDrainTimer(current: PickSession): void {
  if (current.timer !== undefined) clearTimeout(current.timer);
  const token = {};
  current.timerToken = token;
  current.timer = setTimeout(() => {
    if (currentSession(current) && current.timerToken === token) releaseSession(current);
  }, DRAIN_TIMEOUT_MS);
}

/** What the frame tells the worker. A pick it cannot propose an extraction for says so in the propose vocabulary. */
function pickedMessage(current: PickLease, target: Element | null): ExtractionPickedMessage {
  if (!target) return { type: EXTRACTION_PICKED_MESSAGE, sessionId: current.sessionId, refused: "target_not_found" };
  if (current.form === "value") {
    return { type: EXTRACTION_PICKED_MESSAGE, sessionId: current.sessionId, element: pickedElement(target) };
  }
  const proposal = inferListFromElement(target);
  return proposal
    ? { type: EXTRACTION_PICKED_MESSAGE, sessionId: current.sessionId, proposal }
    : { type: EXTRACTION_PICKED_MESSAGE, sessionId: current.sessionId, refused: "no_repeating_run" };
}

/** Where the element is, and nothing it says (D3). */
function pickedElement(target: Element): ExtractionPickedElement {
  const selector = selectorFor(target);
  const tagName = target.tagName.toLowerCase();
  const testId = testIdFor(target);
  return testId === undefined ? { selector, tagName } : { selector, tagName, testId };
}

/**
 * The page element the pointer is over. The overlay takes no pointer event, so
 * the event's own target is already the page's; `elementFromPoint` is the
 * fallback for an event whose target is not an element at all.
 */
function pickTarget(event: MouseEvent): Element | null {
  const target = event.target;
  if (target instanceof Element && !isExtensionUiNode(target)) return target;
  const under = document.elementFromPoint(event.clientX, event.clientY);
  return under && !isExtensionUiNode(under) ? under : null;
}

function trackPointer(current: PickSession, event: PointerEvent): void {
  if (!currentSession(current) || current.phase !== "picking") return;
  const target = pickTarget(event);
  if (target === (hovered ?? null)) return;
  hovered = target ?? undefined;
  pointPickerOverlay(target, caption(current.lease.form, target));
}

/**
 * What the overlay says: how many records picking here would read, or that
 * there is no list to read. The picker's own words, never the page's (D3).
 */
function caption(form: ExtractionPickForm, target: Element | null): string {
  if (!target) return "";
  if (form === "value") return "1 value";
  const proposal = inferListFromElement(target);
  if (!proposal) return "no list here";
  return proposal.itemCount === 1 ? "1 item" : `${proposal.itemCount} items`;
}

/**
 * Escape ends the pick here, and says so.
 *
 * The key cannot reach the panel: it is swallowed in this frame, because a key
 * that cancelled the picker is not a key the page was sent and so not one the
 * recording shows. That is why the worker has to be told -- otherwise its
 * session stays `picking` with the overlay long gone, and the panel goes on
 * asking for a click that can no longer happen.
 *
 * Only a pick still waiting for its press is cancelled. Once the press has taken
 * a pick the proposal is already on its way, and the rest of that press is being
 * drained; cancelling then would throw away what the user just chose.
 */
function cancelOnEscape(current: PickSession, event: KeyboardEvent): void {
  if (!currentSession(current) || event.key !== "Escape") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (current.phase !== "picking") {
    releaseSession(current);
    return;
  }
  cancelPick(current.lease.sessionId);
  const cancelled: ExtractionPickCancelledMessage = { type: EXTRACTION_PICK_CANCELLED_MESSAGE, sessionId: current.lease.sessionId };
  void chrome.runtime.sendMessage(cancelled).catch(() => undefined);
}
