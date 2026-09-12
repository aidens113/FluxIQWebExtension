// Tab moves focus. That is a default action of the trusted key, so a synthetic
// Tab moves nothing and the emulation walks the tab order itself.
//
// The order is the document's: elements with a positive `tabindex` first in
// ascending order, then everything naturally tabbable in document order. An
// element is skipped when it is disabled, hidden, inert, or has no box, and a
// radio group contributes only one stop -- its checked radio, or its first when
// none is checked -- which is what the browser does and what makes Tab past a
// group land where a user expects.
//
// A real Tab at the end of the document moves into the browser's own chrome,
// which a page cannot reach; this wraps to the first stop instead, and says so
// in the outcome it reports.

const TABBABLE_SELECTOR = [
  "a[href]", "area[href]", "button", "input", "select", "textarea", "summary", "iframe",
  "[contenteditable]:not([contenteditable='false'])", "[tabindex]"
].join(", ");

/** Moves focus one stop and returns where it landed, or nothing when focus did not move. */
export function moveFocusByTab(from: Element, backwards: boolean): HTMLElement | undefined {
  const order = tabOrder();
  if (order.length === 0) return undefined;
  const index = order.indexOf(from as HTMLElement);
  const step = backwards ? -1 : 1;
  const next = index === -1
    ? order[backwards ? order.length - 1 : 0]
    : order[(index + step + order.length) % order.length];
  if (!next) return undefined;
  next.focus();
  return document.activeElement === next ? next : undefined;
}

function tabOrder(): HTMLElement[] {
  const candidates = [...document.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)].filter(isTabbable);
  // Array sort is stable, so equal tabindex values keep document order.
  const prioritized = candidates.filter((element) => element.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex);
  return [...prioritized, ...candidates.filter((element) => element.tabIndex === 0)];
}

function isTabbable(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || isDisabled(element)) return false;
  if (element.hidden || element.closest("[inert]")) return false;
  if (element.getClientRects().length === 0) return false;
  if (getComputedStyle(element).visibility === "hidden") return false;
  return !isSkippedRadio(element);
}

function isDisabled(element: HTMLElement): boolean {
  const disableable = element instanceof HTMLButtonElement
    || element instanceof HTMLInputElement
    || element instanceof HTMLSelectElement
    || element instanceof HTMLTextAreaElement;
  return disableable && element.disabled;
}

/** A radio group is one tab stop: its checked radio, or its first when none is checked. */
function isSkippedRadio(element: HTMLElement): boolean {
  if (!(element instanceof HTMLInputElement) || element.type !== "radio" || !element.name) return false;
  const group = [...(element.form ?? document).querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    .filter((radio) => radio.name === element.name);
  const checked = group.find((radio) => radio.checked);
  return checked ? checked !== element : group[0] !== element;
}
