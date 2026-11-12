// The events a pointer coming to rest on an element produces, for menus a script opens (t903, F5).
//
// The pointer arrives from outside the page's elements, so every element of the
// chain is entered, outermost first: a menu that listens for `mouseenter` on its
// container, with the pointer landing on a word inside it, hears it as it would
// from a person's mouse. Then `over` and `move` on the element itself, which
// bubble. No press: a hover never presses anything.

/** A viewport coordinate the pointer rests at. */
type Point = { x: number; y: number };

export function dispatchHoverGesture(element: Element, point: Point): void {
  const base: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: element.ownerDocument.defaultView,
    clientX: point.x,
    clientY: point.y,
    button: 0,
    buttons: 0,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true
  };
  const entering: PointerEventInit = { ...base, bubbles: false, cancelable: false };
  const chain: Element[] = [];
  for (let current: Element | null = element; current !== null; current = current.parentElement) chain.unshift(current);
  dispatchPointer(element, "pointerover", base);
  for (const entered of chain) dispatchPointer(entered, "pointerenter", entering);
  element.dispatchEvent(new MouseEvent("mouseover", base));
  for (const entered of chain) entered.dispatchEvent(new MouseEvent("mouseenter", entering));
  dispatchPointer(element, "pointermove", base);
  element.dispatchEvent(new MouseEvent("mousemove", base));
}

function dispatchPointer(element: Element, type: string, init: PointerEventInit): void {
  if (typeof PointerEvent !== "function") return;
  element.dispatchEvent(new PointerEvent(type, init));
}
