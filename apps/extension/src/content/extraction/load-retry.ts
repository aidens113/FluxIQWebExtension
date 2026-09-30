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

/** How far above the pressed control a Retry may sit and still be its own. */
const RETRY_SCOPE_LEVELS = 2;

/** At most this many elements of that scope are read. A list's footer, not a page. */
const RETRY_SCAN_LIMIT = 200;

/** A label longer than this is a sentence, not a control. */
const RETRY_LABEL_MAX = 24;

/** The whole label, and nothing more. */
const LOAD_RETRY_LABEL = /^(?:retry|try again|reload|load again|try loading again)[.!]?$/iu;

const PRESSABLE = 'button, [role="button"], a[href], input[type="button"], input[type="submit"]';

/** Whether this label asks to load again, and only that. */
export function isLoadRetryLabel(label: string): boolean {
  const collapsed = label.replace(/\s+/gu, " ").trim();
  return collapsed.length > 0 && collapsed.length <= RETRY_LABEL_MAX && LOAD_RETRY_LABEL.test(collapsed);
}

/** The Retry the page put beside `pressed` after it failed to load more, or `undefined`. */
export function offeredLoadRetry(pressed: Element): HTMLElement | undefined {
  let scope: Element | null = pressed.parentElement;
  for (let level = 1; level < RETRY_SCOPE_LEVELS && scope?.parentElement; level += 1) scope = scope.parentElement;
  if (!scope) return undefined;
  let read = 0;
  for (const candidate of Array.from(scope.querySelectorAll(PRESSABLE))) {
    if (++read > RETRY_SCAN_LIMIT) return undefined;
    if (candidate === pressed || !(candidate instanceof HTMLElement)) continue;
    if (candidate.getClientRects().length === 0 || isDisabled(candidate)) continue;
    const label = candidate.getAttribute("aria-label") ?? candidate.textContent ?? "";
    if (isLoadRetryLabel(label)) return candidate;
  }
  return undefined;
}

function isDisabled(element: HTMLElement): boolean {
  if ((element as HTMLButtonElement).disabled === true) return true;
  return element.getAttribute("aria-disabled") === "true";
}
