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

import { EXTRACTION_PICKED_MESSAGE, type ExtractionPickForm, type ExtractionPickedElement, type ExtractionPickedMessage } from "../../shared/extraction-messages";
import { selectorFor, testIdFor } from "../describe-element";
import { inferListFromElement } from "../extraction";
import { isPickerHostNode } from "../picker-host";
import { closePickerOverlay, openPickerOverlay, pointPickerOverlay } from "./overlay";

/** Every event of a press, so none of them reaches the page or the recorder. */
const SWALLOWED_EVENTS = ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "auxclick", "contextmenu"] as const;

/**
 * How long a half-finished press may hold the page before the picker gives it
 * back. Only a sequence that never reaches its `click` can reach this: every
 * swallowed event restarts it.
 */
const DRAIN_TIMEOUT_MS = 10_000;

type PickSession = {
  readonly sessionId: string;
  readonly form: ExtractionPickForm;
  /** `picking`, waiting for the press; `draining`, the pick is made and the rest of its press is being absorbed. */
  phase: "picking" | "draining";
};

let session: PickSession | undefined;
let hovered: Element | undefined;
let drainTimer: ReturnType<typeof setTimeout> | undefined;

/** Puts the overlay up and takes the page's pointer events until a pick is made or the pick is stopped. */
export function startPick(sessionId: string, form: ExtractionPickForm): void {
  stopPick();
  session = { sessionId, form, phase: "picking" };
  openPickerOverlay();
  for (const type of SWALLOWED_EVENTS) window.addEventListener(type, swallowEvent, true);
  window.addEventListener("pointermove", trackPointer, true);
  window.addEventListener("keydown", cancelOnEscape, true);
}

/** Gives the page back: the overlay goes, the listeners go, and the session is forgotten. */
export function stopPick(): void {
  if (drainTimer) clearTimeout(drainTimer);
  drainTimer = undefined;
  if (session) {
    for (const type of SWALLOWED_EVENTS) window.removeEventListener(type, swallowEvent, true);
    window.removeEventListener("pointermove", trackPointer, true);
    window.removeEventListener("keydown", cancelOnEscape, true);
  }
  session = undefined;
  hovered = undefined;
  closePickerOverlay();
}

function swallowEvent(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
  const current = session;
  if (!current) return;
  if (current.phase === "picking" && event.type === "pointerdown") {
    takePick(current, event as PointerEvent);
    return;
  }
  if (current.phase === "draining" && (event.type === "click" || event.type === "auxclick")) {
    stopPick();
    return;
  }
  if (current.phase === "draining") restartDrainTimer();
}

/** The press chose an element: the overlay comes down, the worker is told, and the rest of the press is absorbed. */
function takePick(current: PickSession, event: PointerEvent): void {
  current.phase = "draining";
  const target = pickTarget(event);
  closePickerOverlay();
  hovered = undefined;
  restartDrainTimer();
  void chrome.runtime.sendMessage(pickedMessage(current, target)).catch(() => undefined);
}

function restartDrainTimer(): void {
  if (drainTimer) clearTimeout(drainTimer);
  drainTimer = setTimeout(() => stopPick(), DRAIN_TIMEOUT_MS);
}

/** What the frame tells the worker. A pick it cannot propose an extraction for says so in the propose vocabulary. */
function pickedMessage(current: PickSession, target: Element | null): ExtractionPickedMessage {
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
  if (target instanceof Element && !isPickerHostNode(target)) return target;
  const under = document.elementFromPoint(event.clientX, event.clientY);
  return under && !isPickerHostNode(under) ? under : null;
}

function trackPointer(event: PointerEvent): void {
  if (session?.phase !== "picking") return;
  const target = pickTarget(event);
  if (target === (hovered ?? null)) return;
  hovered = target ?? undefined;
  pointPickerOverlay(target, caption(session.form, target));
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

function cancelOnEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  // Swallowed like a press: an Escape that cancels the picker is not a key the
  // page was sent, so it is not a key the recording shows either.
  event.preventDefault();
  event.stopImmediatePropagation();
  stopPick();
}
