// The notice a list's loader wrote where the next part would have come, found
// for `./loader-wait.ts` (the read says the list paused) and for the moves that
// wait it out (`../page-advance/loader-pause/`, t762).
//
// What is looked at: the shown elements that follow the list's last item inside
// its container, then those that follow the container and each of its next
// `LEVELS` ancestors, at most `FOLLOWING` at each place -- where a loader puts
// its spinner and its notice. Each one's words are read through the shared
// sensitive-text reader, bounded, and matched against the closed wait and busy
// phrases the click's rate-limit watch uses (`../../action-runtime/interference/`).

import { isRateLimitLayerText, isTransientRefusalText } from "../../action-runtime/interference";
import { textOutsideSensitiveControls } from "../../sensitive-text";

/** How many ancestors above the list's container are looked past. */
const LEVELS = 3;
/** How many following elements are read at each place. */
const FOLLOWING = 3;
/** How much of one element's words is matched: a notice is a sentence or two, not a page. */
const TEXT_MAX = 400;

/** The element holding the notice the loader asks the list to wait with, or `undefined` when the page shows none; see the header. */
export function loaderNoticeOf(run: readonly Element[]): Element | undefined {
  const container = run[0]?.parentElement ?? null;
  if (container === null) return undefined;
  const own = run.filter((item) => item.parentElement === container);
  const last = own[own.length - 1];
  const afterLast = last === undefined ? undefined : waitFollowing(last);
  if (afterLast !== undefined) return afterLast;
  let level: Element | null = container;
  for (let depth = 0; level !== null && depth <= LEVELS && level !== level.ownerDocument?.body; depth += 1, level = level.parentElement) {
    const found = waitFollowing(level);
    if (found !== undefined) return found;
  }
  return undefined;
}

function waitFollowing(element: Element): Element | undefined {
  let next = element.nextElementSibling;
  for (let read = 0; next !== null && read < FOLLOWING; read += 1, next = next.nextElementSibling) {
    if (saysWait(next)) return next;
  }
  return undefined;
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
