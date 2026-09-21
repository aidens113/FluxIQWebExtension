// The element painted at a viewport point, inside shadow roots as well.
//
// `document.elementFromPoint` answers with the outermost shadow host at the
// point, never with what is drawn inside it, so a point recorded on a consent
// banner's "Accept all" resolved to the `rf-consent` host and was refused by
// the veto (lane D). Each open root the hit owns is asked the same question in
// turn, which is how the browser itself hit-tests through them.

/** How many shadow roots the descent enters. Real widgets nest two or three. */
const MAX_SHADOW_DEPTH = 16;

/** The innermost element at the point, descending through open shadow roots; `null` when nothing is there. */
export function deepElementFromPoint(x: number, y: number, root: Document = document): Element | null {
  let hit = root.elementFromPoint(x, y);
  for (let depth = 0; hit?.shadowRoot && depth < MAX_SHADOW_DEPTH; depth += 1) {
    const inner = hit.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === hit) break;
    hit = inner;
  }
  return hit;
}
