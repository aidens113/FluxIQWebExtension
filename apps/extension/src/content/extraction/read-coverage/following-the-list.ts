// The shown element, among those a loader writes under a list, that a test
// accepts: where a loader puts its spinner, its notice, or its session check.
//
// What is looked at: the shown elements that follow the list's last item inside
// its container, then those that follow the container and each of its next
// `LEVELS` ancestors, at most `FOLLOWING` at each place.

/** How many ancestors above the list's container are looked past. */
const LEVELS = 3;
/** How many following elements are read at each place. */
const FOLLOWING = 3;

/** The first shown element under the list `run` that `accepts`, or `undefined`. */
export function followingTheList(run: readonly Element[], accepts: (element: Element) => boolean): Element | undefined {
  const container = run[0]?.parentElement ?? null;
  if (container === null) return undefined;
  const own = run.filter((item) => item.parentElement === container);
  const last = own[own.length - 1];
  const afterLast = last === undefined ? undefined : acceptedFollowing(last, accepts);
  if (afterLast !== undefined) return afterLast;
  let level: Element | null = container;
  for (let depth = 0; level !== null && depth <= LEVELS && level !== level.ownerDocument?.body; depth += 1, level = level.parentElement) {
    const found = acceptedFollowing(level, accepts);
    if (found !== undefined) return found;
  }
  return undefined;
}

function acceptedFollowing(element: Element, accepts: (element: Element) => boolean): Element | undefined {
  let next = element.nextElementSibling;
  for (let read = 0; next !== null && read < FOLLOWING; read += 1, next = next.nextElementSibling) {
    if (isShown(next) && accepts(next)) return next;
  }
  return undefined;
}

/** Drawn: not hidden, and with a box. A stand-in that cannot say where it is counts as drawn. */
export function isShown(element: Element): boolean {
  if (element.getAttribute("hidden") !== null || element.getAttribute("aria-hidden") === "true") return false;
  return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
}
