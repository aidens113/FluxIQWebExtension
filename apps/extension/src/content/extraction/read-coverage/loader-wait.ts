// Whether a list's loader answered the read by asking it to wait: the third
// state of a list beside going on and ending (t755, from t756's trace).
//
// A list that loads more as its end is revealed can refuse a reveal that comes
// too soon after the last one, and say so where the next part would have come:
// "Please wait a few moments before you try again", "Too many requests, try
// again in 3s". The read's own reveal (`../list-wait.ts`) then sees nothing
// grow, and until 2026-10-27 its list was taken for one that had ended, so a
// read of the first screens of a longer list said nothing of the rest: photo-
// social's profile grid read 12 items a second after load and 24 two seconds
// after, with the notice under the grid both times and 45 posts on the
// account. Calling it still growing would be untrue -- nothing grew -- so it is
// its own word, `loader_asked_to_wait` (`./list-continues.ts`).
//
// What is read: the shown elements that follow the list's last item inside its
// container, then those that follow the container and each of its next
// `LEVELS` ancestors, at most `FOLLOWING` at each place -- where a loader puts
// its spinner and its notice. Each one's words are read through the shared
// sensitive-text reader, bounded, and matched against the closed wait and busy
// phrases the click's rate-limit watch uses (`../../action-runtime/interference/`).
// No word of it leaves the page: what the read sends is the closed evidence word.

import { isRateLimitLayerText, isTransientRefusalText } from "../../action-runtime/interference";
import { textOutsideSensitiveControls } from "../../sensitive-text";

/** How many ancestors above the list's container are looked past. */
const LEVELS = 3;
/** How many following elements are read at each place. */
const FOLLOWING = 3;
/** How much of one element's words is matched: a notice is a sentence or two, not a page. */
const TEXT_MAX = 400;

/** Whether the page shows, where the list `run` would grow, a notice asking to wait before it loads more; see the header. */
export function loaderAskedToWait(run: readonly Element[]): boolean {
  const container = run[0]?.parentElement ?? null;
  if (container === null) return false;
  const own = run.filter((item) => item.parentElement === container);
  const last = own[own.length - 1];
  if (last !== undefined && followedByWait(last)) return true;
  let level: Element | null = container;
  for (let depth = 0; level !== null && depth <= LEVELS && level !== level.ownerDocument?.body; depth += 1, level = level.parentElement) {
    if (followedByWait(level)) return true;
  }
  return false;
}

function followedByWait(element: Element): boolean {
  let next = element.nextElementSibling;
  for (let read = 0; next !== null && read < FOLLOWING; read += 1, next = next.nextElementSibling) {
    if (saysWait(next)) return true;
  }
  return false;
}

function saysWait(element: Element): boolean {
  if (!isShown(element)) return false;
  const text = textOutsideSensitiveControls(element).replace(/\s+/gu, " ").trim().slice(0, TEXT_MAX);
  return text !== "" && (isRateLimitLayerText(text) || isTransientRefusalText(text));
}

/** Drawn: not hidden, and with a box. A stand-in that cannot say where it is counts as drawn. */
function isShown(element: Element): boolean {
  if (element.getAttribute("hidden") !== null || element.getAttribute("aria-hidden") === "true") return false;
  return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
}
