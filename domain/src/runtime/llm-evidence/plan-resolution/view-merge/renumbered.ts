// The handles a reload renumbered (`../target-packets.ts` header, "A whole
// reload view marks a dropped handle..."): before a newer whole view replaces a
// page's, the handles it shows again lose their mark, and when it is the first
// view of a document reached by reload, each handle it dropped whose control --
// tag and words -- it shows under another handle is marked. Only the first view
// of a new document marks (t741 C2), by navigation's `timeOrigin`. Moved out of
// the store whole (t1071) when it reached its line budget.

import type { WebLlmSnapshotBinding } from "../../sanitize";

/** Handles marked per page, at most; the oldest mark goes first. */
const MARKED_PER_PAGE = 4096;
/** The navigation type of a document reached by reloading it (Navigation Timing). */
const RELOAD_NAVIGATION_TYPE = "reload";

/** What this reads of a remembered target: the control's tag and words. */
type Worded = { element: { tagName?: string | undefined; accessibleName?: string | undefined; visibleText?: string | undefined } };

/** The store's per-page memory this keeps up to date. */
type RenumberedMemory<T extends Worded> = {
  renumbered: Map<string, Set<string>>;
  pages: Map<string, Map<string, T>>;
  documents: Map<string, number>;
};

/** Before `targets` replace the page's view at `binding`'s location: unmark and mark as the header says. */
export function webPlanMarkRenumbered<T extends Worded>(memory: RenumberedMemory<T>, binding: WebLlmSnapshotBinding, targets: ReadonlyMap<string, T>): void {
  const location = binding.evidence.location;
  const marked = memory.renumbered.get(location) ?? new Set<string>();
  for (const handle of targets.keys()) marked.delete(handle);
  const before = memory.pages.get(location);
  const origin = binding.evidence.navigation?.timeOrigin;
  const previous = memory.documents.get(location);
  // The same document both views name is no new load, whatever its type says (header).
  const newDocument = origin === undefined || previous === undefined || origin !== previous;
  if (origin === undefined) memory.documents.delete(location);
  else memory.documents.set(location, origin);
  if (before !== undefined && newDocument && binding.evidence.navigation?.type === RELOAD_NAVIGATION_TYPE) {
    const shown = new Set([...targets.values()].map(controlWords).filter((words): words is string => words !== undefined));
    for (const [handle, target] of before) {
      const words = controlWords(target);
      if (!targets.has(handle) && words !== undefined && shown.has(words)) marked.add(handle);
    }
  }
  for (const oldest of marked) {
    if (marked.size <= MARKED_PER_PAGE) break;
    marked.delete(oldest);
  }
  if (marked.size > 0) memory.renumbered.set(location, marked);
  else memory.renumbered.delete(location);
}

/** A control's tag and words, which a reload does not change; nothing for a wordless control, which only its place tells apart. */
function controlWords(target: Worded): string | undefined {
  const words = target.element.accessibleName ?? target.element.visibleText;
  return words === undefined || words.trim() === "" ? undefined : `${target.element.tagName ?? ""}\0${words.replace(/\s+/gu, " ").trim()}`;
}
