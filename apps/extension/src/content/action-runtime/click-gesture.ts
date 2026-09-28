// The event sequence a mouse press produces, in order.
//
// It lived inside `actions/click.ts` until the runtime gained a defence that
// presses a dialog's own way out (`interference/`), which needs the same
// gesture and cannot import a verb: `actions/` depends on this directory, not
// the other way round. So the capability moved here, beside the other things a
// verb needs of the page, and both callers dispatch one implementation.
//
// Why a gesture rather than `HTMLElement.click()`: a page that opens its menu
// on `pointerdown`, or that tracks `mousedown` to decide what the click means,
// never sees a bare click at all. That is as true of a promotion's close glyph
// as of a product link.

/** A viewport coordinate the press is aimed at. */
export type ClickPoint = { x: number; y: number };

/**
 * Dispatches the press and returns whether the click's default action was
 * allowed to run. `beforePress` runs between the hover and the press, which is
 * where a link's in-place watch starts.
 */
export function dispatchClickGesture(element: Element, point: ClickPoint, beforePress?: () => void): boolean {
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
  beforePress?.();
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
