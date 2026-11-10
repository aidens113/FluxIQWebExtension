// One capture a step, not two (task speed S4).
//
// A node run looks at the page before it acts and again after
// (`domain/src/runtime/llm-evidence/node-run/run.ts`), so the look before a
// step's act repeated the look after the previous step's act, a whole capture
// of about 0.6 s, although nothing had changed between them. The worker now
// keeps the last whole-tab look of each tab, with every frame's change mark
// around it (`content/page-changes/`), and answers the next look with it while
// the page has not moved:
//
// - no top-frame navigation event since it was taken (`../navigation-events/`);
// - the same frames, each answering from the same copy of the content script
//   with the same count of changes;
// - nothing but reads sent to the tab since: any other action forgets it
//   (`forget`), so the look after an act is always a fresh capture, whatever
//   the act did.
//
// Any of those failing takes a fresh look, so a stale look never reaches an
// act. A look whose marks moved while it was being taken is not kept: the page
// was changing under it. Only a plain whole-tab look is kept, the kind a node
// run takes; a look addressed to a frame or asking for the page's structure is
// always taken fresh.

import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { PAGE_CHANGES_MESSAGE, type PageChangesResponse } from "../../shared/page-changes-message";
import { snapshotCaptureOptionsFor } from "../../shared/snapshot-capture-options";

/** The frames of a tab, each with the mark it answered; in frame order. */
type FrameMarks = ReadonlyArray<{ frameId: number; mark: PageChangesResponse }>;

/** How the worker reaches a tab's frames: the browser's frame list and a message to one frame. */
export type LookReuseAccess = {
  frames(tabId: number): Promise<ReadonlyArray<{ frameId: number }>>;
  send(tabId: number, message: unknown, frameId: number): Promise<unknown>;
  /** The tab's navigation epoch now (`../navigation-events/`). */
  epoch(tabId: number): number;
};

/** A look the worker took, and what the page was when it took it. */
type KeptLook = { key: string; epoch: number; marks: FrameMarks; result: BrowserActionResult };

/** The actions that only read the page, which leave a kept look standing. */
const READS: ReadonlySet<string> = new Set(["web.dom.capture_snapshot", "web.dom.extract", "web.dom.extract_list", "web.dom.assert", "web.dom.wait_for_selector", "web.dom.wait_for_text"]);

const kept = new Map<number, KeptLook>();

/** Which kind of plain whole-tab look this is, or nothing for a look that is never kept. */
function keyOf(action: BrowserActionCommand, addressed: boolean): string | undefined {
  if (action.actionType !== "web.dom.capture_snapshot" || addressed) return undefined;
  if (action.detectStructure !== undefined) return undefined;
  return snapshotCaptureOptionsFor(action).includeHidden === true ? "with-hidden" : "shown";
}

/** Every frame's mark, or nothing when a frame did not answer one: a frame that cannot vouch for itself keeps nothing. */
async function marksOf(tabId: number, access: LookReuseAccess): Promise<FrameMarks | undefined> {
  const frames = [...await access.frames(tabId)].sort((left, right) => left.frameId - right.frameId);
  if (frames.length === 0) return undefined;
  const marks: Array<{ frameId: number; mark: PageChangesResponse }> = [];
  for (const { frameId } of frames) {
    let mark: PageChangesResponse | undefined;
    try {
      mark = markOf(await access.send(tabId, { type: PAGE_CHANGES_MESSAGE }, frameId));
    } catch {
      mark = undefined;
    }
    if (!mark) return undefined;
    marks.push({ frameId, mark });
  }
  return marks;
}

function markOf(value: unknown): PageChangesResponse | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { instance, changes } = value as { instance?: unknown; changes?: unknown };
  return typeof instance === "string" && instance !== "" && typeof changes === "number" && Number.isSafeInteger(changes) && changes >= 0 ? { instance, changes } : undefined;
}

function sameMarks(left: FrameMarks, right: FrameMarks): boolean {
  return left.length === right.length && left.every((entry, index) => {
    const other = right[index]!;
    return entry.frameId === other.frameId && entry.mark.instance === other.mark.instance && entry.mark.changes === other.mark.changes;
  });
}

/** The worker's last look at each tab, answered again while the page has not moved. */
export const keptLooks = {
  /**
   * `take` -- the look itself, as the runner would have run it -- unless the
   * kept look of this tab still stands, which is then the answer, stamped as
   * this command's and timed as the check that vouched for it.
   */
  async look(tabId: number, action: BrowserActionCommand, addressed: boolean, access: LookReuseAccess, take: () => Promise<BrowserActionResult>): Promise<{ result: BrowserActionResult; reused: boolean }> {
    const key = keyOf(action, addressed);
    if (key === undefined) return { result: await take(), reused: false };
    const startedAt = Date.now();
    const epoch = access.epoch(tabId);
    const before = await marksOf(tabId, access);
    const standing = kept.get(tabId);
    if (before && standing && standing.key === key && standing.epoch === epoch && sameMarks(standing.marks, before)) {
      return { result: { ...standing.result, commandId: action.commandId, startedAt, finishedAt: Date.now() }, reused: true };
    }
    kept.delete(tabId);
    const result = await take();
    if (result.status !== "succeeded" || !before) return { result, reused: false };
    const after = await marksOf(tabId, access);
    // Kept only when nothing moved while it was taken, and no navigation began.
    if (after && sameMarks(before, after) && access.epoch(tabId) === epoch) kept.set(tabId, { key, epoch, marks: before, result });
    return { result, reused: false };
  },
  /** An action other than a read is about to reach this tab, or every tab: its kept look no longer stands. */
  forget(tabId: number | undefined, action?: BrowserActionCommand): void {
    if (action !== undefined && READS.has(action.actionType)) return;
    if (tabId === undefined) kept.clear();
    else kept.delete(tabId);
  }
};
