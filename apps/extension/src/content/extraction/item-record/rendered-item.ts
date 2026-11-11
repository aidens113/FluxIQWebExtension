// Whether a list item is shown on the page at all (t903).
//
// A person reads what the page shows. An item the browser does not render --
// one inside a closed menu, panel or tab -- is opened first, by a hover or a
// click, and then read; so the list reader neither reads it nor marks it read
// while it is hidden, takes it if it shows during the read, and counts it if
// it never does, so the read's answer says the item is there and not shown
// (`../list-reader.ts`, `notRenderedItems`). Hidden words inside an item that
// is shown, such as a collapsed "Read more", are the disclosure check's
// (`../text-disclosure/`), not this.
//
// An item is shown when it, or anything inside it, is rendered. The item alone
// is not enough: a wrapper drawn `display: contents` has no box of its own, and
// a row marked `visibility: hidden` whose cells say `visibility: visible` shows
// its cells; `checkVisibility` is false for both, yet a person sees the row.
// So is a select's option, which has no box at all: its select draws it, and an
// option of a shown select is shown (the list of sizes a select offers is a list
// a person reads).
//
// An element offering neither of the browser's measures is taken as shown: an
// item is called hidden only when the browser says so.

export function isRenderedItem(element: Element): boolean {
  const select = element.closest?.("select");
  if (select) return rendered(select) !== false;
  if (rendered(element) !== false) return true;
  for (const inner of Array.from(element.querySelectorAll("*"))) if (rendered(inner) !== false) return true;
  return false;
}

/** The browser's word on one element; `undefined` where it offers no measure. */
function rendered(element: Element): boolean | undefined {
  const check = (element as Element & { checkVisibility?: (options?: Record<string, boolean>) => boolean }).checkVisibility;
  if (typeof check === "function") return check.call(element, { checkVisibilityCSS: true, visibilityProperty: true });
  return typeof element.getClientRects === "function" ? element.getClientRects().length > 0 : undefined;
}
