// The click verb: refuse a target that cannot be clicked, then click it the way
// a person does.
//
// Two things separate this from the `HTMLElement.click()` it replaces. The
// actionability gate means a disabled, hidden, or covered target is refused as
// ACTION_REJECTED with a code, rather than reported as a success that changed
// nothing -- the single most common way a browser automation lies about what it
// did. And the gesture is a pointer and mouse sequence at the hit-tested point,
// pointerover through click, with the focus move a real press performs, rather
// than a bare `click` event: a page that opens its menu on `pointerdown`, or
// that tracks `mousedown` to decide what the click means, never sees a bare
// click at all.
//
// The post-condition is the hit test -- the point that was clicked and what it
// landed on. A link is held to more than that, because a link states where it
// goes: the click must actually begin that navigation, so a link whose handler
// swallows the click and navigates nowhere is reported as `output_not_observed`
// instead of as a success.
//
// The events carry the element's own window as their `view`, so a click inside
// a child frame is dispatched in that frame rather than in the top one.

import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../types";
import type { ContentActionDependencies } from "./types";

type Point = { x: number; y: number };

export function clickAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action);
  const evidence = (): { element: BrowserActionResult["element"]; snapshot: BrowserActionResult["snapshot"] } => ({
    element: deps.describeElement(element),
    snapshot: deps.captureSnapshot()
  });

  const report = deps.checkActionability(element);
  if (!report.actionable) {
    return deps.rejected(action, startedAt, report.code, "a target that can be clicked", report.detail, evidence());
  }

  const link = navigatingLink(element);
  const document = element.ownerDocument;
  const before = document.location.href;
  const accepted = dispatchClickGesture(element, report.point);
  const after = document.location.href;

  const validation = link
    ? navigationValidation(link.href, before, after, accepted)
    : hitTestValidation(report.detail, accepted);
  return deps.success(action, startedAt, "Element clicked.", validation, evidence());
}

/**
 * The link this click navigates through, if any. `closest` rather than the
 * element itself because a click nearly always lands on the text or icon inside
 * the anchor; a `javascript:` href names no destination, so it is not held to
 * one.
 */
function navigatingLink(element: Element): { href: string } | undefined {
  const anchor = element.closest("a[href]") as (Element & { href?: string; protocol?: string }) | null;
  if (!anchor || typeof anchor.href !== "string" || !anchor.href) return undefined;
  if (anchor.protocol === "javascript:") return undefined;
  return { href: anchor.href };
}

/**
 * A link's post-condition. A same-document navigation has already happened by
 * the time the gesture returns, so the changed location is the observation. A
 * cross-document one has only been started, which is as much as this frame can
 * see before it is torn down -- so the claim made is that it began, not that it
 * arrived. Only a click that was cancelled and moved nothing fails.
 */
function navigationValidation(href: string, before: string, after: string, accepted: boolean): BrowserActionValidation {
  const expected = `navigation to ${href} begins`;
  if (after !== before) return { status: "passed", expected, actual: `the page navigated to ${after}` };
  if (accepted) return { status: "passed", expected, actual: `navigation to ${href} was initiated` };
  return { status: "failed", expected, actual: "the click was prevented and the location did not change" };
}

/**
 * Everything else is held to the hit test: the click reached the target at a
 * point that belongs to it. A page cancelling the default action is recorded
 * but is not a failure -- handling a click in script and preventing the default
 * is ordinary, and what the click then did is the next action's business.
 */
function hitTestValidation(detail: string, accepted: boolean): BrowserActionValidation {
  return {
    status: "passed",
    expected: "the click lands on the target or something inside it",
    actual: accepted ? detail : `${detail}; the page prevented the click's default action`
  };
}

/** The event sequence a mouse press produces, in order. Returns whether the click's default action was allowed to run. */
function dispatchClickGesture(element: Element, point: Point): boolean {
  const base: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: element.ownerDocument.defaultView,
    clientX: point.x,
    clientY: point.y,
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true
  };
  const hover: PointerEventInit = { ...base, buttons: 0 };
  // enter and over differ: the enter pair neither bubbles nor can be cancelled.
  const entering: PointerEventInit = { ...hover, bubbles: false, cancelable: false };
  const press: PointerEventInit = { ...base, buttons: 1, detail: 1 };
  const release: PointerEventInit = { ...base, buttons: 0, detail: 1 };

  dispatchPointer(element, "pointerover", hover);
  dispatchPointer(element, "pointerenter", entering);
  element.dispatchEvent(new MouseEvent("mouseover", hover));
  element.dispatchEvent(new MouseEvent("mouseenter", entering));
  dispatchPointer(element, "pointermove", hover);
  element.dispatchEvent(new MouseEvent("mousemove", hover));
  dispatchPointer(element, "pointerdown", press);
  // A page that cancels mousedown is suppressing the focus move, as in a
  // toolbar that keeps the caret in the document, so the focus follows it.
  if (element.dispatchEvent(new MouseEvent("mousedown", press))) focusForPress(element);
  dispatchPointer(element, "pointerup", release);
  element.dispatchEvent(new MouseEvent("mouseup", release));
  return element.dispatchEvent(new MouseEvent("click", release));
}

function dispatchPointer(element: Element, type: string, init: PointerEventInit): void {
  if (typeof PointerEvent !== "function") return;
  element.dispatchEvent(new PointerEvent(type, init));
}

/**
 * The focus move a press makes: to the nearest focusable ancestor-or-self, as
 * the browser does. `preventScroll` keeps it from moving the page after the hit
 * test, which would leave the remaining events pointing at a stale position.
 */
function focusForPress(element: Element): void {
  const target = element.closest("a[href],button,input,select,textarea,summary,[tabindex],[contenteditable]");
  const focusable = target as (Element & { focus?: (options?: { preventScroll?: boolean }) => void }) | null;
  if (focusable && typeof focusable.focus === "function") focusable.focus({ preventScroll: true });
}
