// Whether a list item is shown on the page at all (t903).
//
// A person reads what the page shows. An item the browser does not render --
// one inside a closed menu, panel or tab -- is opened first, by a hover or a
// click, and then read; so a read takes no value off it (`./read-record.ts`),
// and counts it, so the read's answer says the item is there and not shown
// (`../list-reader.ts`, `notRenderedItems`). Hidden words inside an item that
// is shown, such as a collapsed "Read more", are the disclosure check's
// (`../text-disclosure/`), not this.
//
// An element offering neither of the browser's measures is taken as shown: an
// item is called hidden only when the browser says so.

export function isRenderedItem(element: Element): boolean {
  const check = (element as Element & { checkVisibility?: (options?: Record<string, boolean>) => boolean }).checkVisibility;
  if (typeof check === "function") return check.call(element, { checkVisibilityCSS: true, visibilityProperty: true });
  return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
}
