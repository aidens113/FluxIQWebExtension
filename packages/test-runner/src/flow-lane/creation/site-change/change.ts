import type { LastingView } from "./lasting-view.js";

/** What a site's lasting view moved by, by name; a name that did not move is absent. */
export type SiteChange = Readonly<Record<string, number>>;

/** The difference `after - before`, by name. */
export function siteChange(before: LastingView, after: LastingView): SiteChange {
  const change: Record<string, number> = {};
  for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const moved = (after[name] ?? 0) - (before[name] ?? 0);
    if (moved !== 0) change[name] = moved;
  }
  return change;
}
