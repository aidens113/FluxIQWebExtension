import type { LookupRoot } from "../../selector";

/** Elements walked while matching a fingerprint's words or name. A resolution runs on every action's critical path. */
export const MAX_TEXT_SCAN = 2_000;

/** The `tagName` elements in `roots` (every element when none is named) that `matches` accepts, walking at most `MAX_TEXT_SCAN` of them. */
export function scanTagMatches(tagName: string | undefined, roots: readonly LookupRoot[], matches: (element: Element) => boolean): Element[] {
  const found: Element[] = [];
  let scanned = 0;
  for (const root of roots) {
    for (const element of root.querySelectorAll(tagName || "*")) {
      scanned += 1;
      if (scanned > MAX_TEXT_SCAN) return found;
      if (matches(element)) found.push(element);
    }
  }
  return found;
}
