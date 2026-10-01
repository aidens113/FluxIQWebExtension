// The Retry a list offers when loading more of it failed, and whether to press it.
//
// A "Show more" that fails does not always fail loudly. Guildline's invitation
// manager (`apps/scenario-lab/src/scenarios/professional-network/network/manager-client.ts`)
// hides its Show more at the press, turns a spinner, and a moment later puts
// "Something went wrong. Retry" under it; only the Retry loads the rows. A read
// that waited only for new items or for the control to leave waited out its ten
// seconds and failed `list_unchanged` -- in lane t195's live run
// `run-munnyvbr-11c28a0f` the built Flow read the first ten of twenty-eight
// requests and withdrew from those alone.
//
// Pressing it is safe for the reason pressing Show more is: it asks the page for
// more of what the read is reading, and changes nothing a person owns. So the
// read presses it, bounded, and only when all of these hold:
//
// - it is painted, and it was not the control just pressed;
// - it sits beside that control -- within the control's parent, or the parent's
//   parent -- because a Retry elsewhere on the page is someone else's;
// - its own label is one of a closed list of "load it again" words, the whole
//   label and nothing more, so a "Retry payment" or "Try again to publish" is
//   never a match.
//
// Nothing here reads page text into a result: a label is compared and dropped.
//
// **A list's own Retry, with no load-more control to sit beside** (t194-w24).
// The classifieds feed loads its next batch when the space under its last card
// scrolls into reach; one batch per session fails the first time it is asked
// for, and its skeletons stay put above a "Try again" drawn as a bare focusable
// span with no role. A read that revealed the end of the list, or scrolled it,
// saw nothing arrive, called the list ended, and answered nine of twelve rows
// -- and a person pressing Try again while authoring would not help, because
// the Flow replayed in a fresh session meets the failure again. So the read
// itself presses it, on the same three conditions, with "beside the control"
// read as "under the list": the Retry must sit in the element that holds the
// whole run, or in that element's parent, after the run's container in
// document order. A Retry above the list, or anywhere else on the page, is
// someone else's. One read presses such a Retry at most `LIST_LOAD_RETRIES`
// times (`RetryBudget`), however many reveals or scrolls it makes.
//
// A focusable element with no role (`tabindex` 0 or more) counts as pressable
// here: it is how many feeds draw a link-styled Try again, and the whole-label
// rule is what keeps pressing it safe. One taken out of the tab order
// (`tabindex="-1"`) is not offered unless it is a control by its own tag or role.

/** How far above the pressed control a Retry may sit and still be its own. */
const RETRY_SCOPE_LEVELS = 2;

/** At most this many elements of that scope are read. A list's footer, not a page. */
const RETRY_SCAN_LIMIT = 200;

/** A label longer than this is a sentence, not a control. */
const RETRY_LABEL_MAX = 24;

/** The whole label, and nothing more. */
const LOAD_RETRY_LABEL = /^(?:retry|try again|reload|load again|try loading again)[.!]?$/iu;

/** What is a control by its own tag or role. */
const PRESSABLE = 'button, [role="button"], a[href], input[type="button"], input[type="submit"]';

/** What is looked at: the controls, and anything focusable, which `isPressable` then sorts. */
const CANDIDATES = `${PRESSABLE}, [tabindex]`;

/** At most this many times one read presses the Retry its list offers under itself. */
export const LIST_LOAD_RETRIES = 2;

/** How long a pressed Retry has to bring the part of the list it reloads: a fetch, not a scroll's settle. */
export const RETRY_GROWTH_WINDOW_MS = 5_000;

/** The Retries one read has pressed for its list, shared by every wait of that read. */
export type RetryBudget = { pressed: number };

/** A budget with nothing spent, for a read that begins. */
export function newRetryBudget(): RetryBudget {
  return { pressed: 0 };
}

/** Spends one press of the budget, or answers false when it is spent. */
export function spendRetry(budget: RetryBudget): boolean {
  if (budget.pressed >= LIST_LOAD_RETRIES) return false;
  budget.pressed += 1;
  return true;
}

/** Whether this label asks to load again, and only that. */
export function isLoadRetryLabel(label: string): boolean {
  const collapsed = label.replace(/\s+/gu, " ").trim();
  return collapsed.length > 0 && collapsed.length <= RETRY_LABEL_MAX && LOAD_RETRY_LABEL.test(collapsed);
}

/** The Retry the page put beside `pressed` after it failed to load more, or `undefined`. */
export function offeredLoadRetry(pressed: Element): HTMLElement | undefined {
  let scope: Element | null = pressed.parentElement;
  for (let level = 1; level < RETRY_SCOPE_LEVELS && scope?.parentElement; level += 1) scope = scope.parentElement;
  return scope ? retryWithin(scope, (candidate) => candidate !== pressed) : undefined;
}

/**
 * The Retry a list put under itself after loading more of it failed, or
 * `undefined`: looked for in the parent of the element that holds every item
 * of `items`, after that element in document order or inside it (see the
 * header). `items` is the run as the page shows it now, in document order.
 */
export function offeredListRetry(items: readonly Element[]): HTMLElement | undefined {
  const container = commonContainer(items);
  const scope = container?.parentElement;
  if (!container || !scope) return undefined;
  return retryWithin(scope, (candidate) => !items.some((item) => item === candidate || item.contains(candidate)) && underOrInside(container, candidate));
}

function retryWithin(scope: Element, admits: (candidate: HTMLElement) => boolean): HTMLElement | undefined {
  let read = 0;
  for (const candidate of Array.from(scope.querySelectorAll(CANDIDATES))) {
    if (++read > RETRY_SCAN_LIMIT) return undefined;
    if (!(candidate instanceof HTMLElement) || !isPressable(candidate)) continue;
    const label = candidate.getAttribute("aria-label") ?? candidate.textContent ?? "";
    if (!isLoadRetryLabel(label) || !admits(candidate)) continue;
    if (candidate.getClientRects().length === 0 || isDisabled(candidate)) continue;
    return candidate;
  }
  return undefined;
}

/** A control by its tag or role, or an element in the tab order. */
function isPressable(element: Element): boolean {
  if (element.matches(PRESSABLE)) return true;
  return /^\s*\d+\s*$/u.test(element.getAttribute("tabindex") ?? "");
}

/** The nearest element holding every item: the last item's parent, widened until it holds the first. */
function commonContainer(items: readonly Element[]): Element | undefined {
  let container: Element | null = items[items.length - 1]?.parentElement ?? null;
  while (container && !items.every((item) => container?.contains(item) === true)) container = container.parentElement;
  return container ?? undefined;
}

/** `Node.DOCUMENT_POSITION_FOLLOWING` and `DOCUMENT_POSITION_CONTAINED_BY`, which Node's own globals do not carry. */
const FOLLOWING = 4;
const CONTAINED_BY = 16;

/** Whether `candidate` comes after `container` in document order or sits inside it: under the list, never above it. */
function underOrInside(container: Element, candidate: Element): boolean {
  return (container.compareDocumentPosition(candidate) & (FOLLOWING | CONTAINED_BY)) !== 0;
}

function isDisabled(element: HTMLElement): boolean {
  if ((element as HTMLButtonElement).disabled === true) return true;
  return element.getAttribute("aria-disabled") === "true";
}
