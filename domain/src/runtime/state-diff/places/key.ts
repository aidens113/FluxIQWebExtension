// How an element is named across two captures of one page (t609): its frame and
// its selector. A handle is positional to one capture, so the diff of two
// captures cannot match by it. The key never leaves the domain: it is held in
// the host runtime's memory of its own snapshots (`./memo.ts`), never on a
// summary or a diff.

/** The key of the element `selector` addresses in frame `frameId` (the top document when absent). */
export function webStatePlaceKey(frameId: number | undefined, selector: string): string {
  return `${frameId ?? 0}\u0000${selector}`;
}
