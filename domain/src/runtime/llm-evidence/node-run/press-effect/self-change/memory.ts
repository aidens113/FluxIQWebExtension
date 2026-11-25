// The lines of a page the run has seen change with nothing done to it (t1043): each
// Flow's own memory of which page-view lines, by their stable handles, read other words
// between two captures that nothing came between.
//
// **Two captures are compared only when nothing can have come between them**, by the rule
// t496's memory of control names keeps (`../../../plan-resolution/self-changing/names.ts`):
// nothing was sent to the page since the first (`acting`, which the node run calls
// before its command goes out and around a replay); both are of one document (the same
// location and `navigation.timeOrigin`); and both described the whole page. A look the
// capture cut short, or one frame's look, ends the chain instead.
//
// **A line is the page's own only once it has done so twice.** Only a line on both
// captures whose words now differ counts -- one that appeared or went may be a notice an
// act raised and the page then took down. And a line must be seen changing so in two
// such pairs: a change an act caused that lands after the look that followed it is seen
// once per act, while what a page changes by itself -- a slide that rotates, a clock, a
// ticker -- keeps changing.
//
// What is seen is kept on the capture it was read with (`webPressSeenChanging`), so the
// press that compares two captures reads it from them and needs nothing else handed in.
//
// Bounded: the newest `FLOWS` Flows, `PAGES_PER_FLOW` locations each, `LINES_PER_PAGE` lines each.

import type { WebLlmSnapshotBinding } from "../../../sanitize";
import { webLlmLineFacts } from "../../../page-view";

const FLOWS = 32;
const PAGES_PER_FLOW = 64;
const LINES_PER_PAGE = 512;
/** How many quiet changes make a line the page's own (header). */
const TIMES_SEEN = 2;
const NONE: ReadonlySet<string> = new Set();

/** The Flow a memory is kept for, as the run's other per-Flow memories key it. */
export type WebPressSelfChangeScope = { projectId: string; flowId: string };

export type WebPressSelfChanges = {
  /** A capture the build took, as the newest view of its page. */
  captured(scope: WebPressSelfChangeScope, binding: WebLlmSnapshotBinding): void;
  /** Something is about to be done to the page: the newest capture no longer says how it stands. */
  acting(scope: WebPressSelfChangeScope): void;
};

type Baseline = { location: string; timeOrigin: number; words: Map<string, string> };
type Flow = { baseline: Baseline | undefined; pages: Map<string, Map<string, number>> };

/** What each capture read of its page: the lines seen changing by themselves there, as of that capture. */
const seenOn = new WeakMap<WebLlmSnapshotBinding, ReadonlySet<string>>();

export function createWebPressSelfChanges(): WebPressSelfChanges {
  const flows = new Map<string, Flow>();
  const flowOf = (scope: WebPressSelfChangeScope): Flow => {
    const key = JSON.stringify([scope.projectId, scope.flowId]);
    const flow = flows.get(key) ?? { baseline: undefined, pages: new Map() };
    flows.delete(key);
    flows.set(key, flow);
    for (const oldest of flows.keys()) if (flows.size > FLOWS) flows.delete(oldest); else break;
    return flow;
  };
  return {
    captured(scope, binding) {
      const flow = flowOf(scope);
      const next = baselineOf(binding);
      const earlier = flow.baseline;
      flow.baseline = next;
      if (next !== undefined && earlier !== undefined && earlier.location === next.location && earlier.timeOrigin === next.timeOrigin) quietChanges(flow, earlier, next);
      seenOn.set(binding, seen(flow, binding.evidence.location));
    },
    acting(scope) {
      flowOf(scope).baseline = undefined;
    }
  };
}

/** The lines the run had seen change by themselves on this capture's page, as of the capture; none for one it never saw. */
export function webPressSeenChanging(binding: WebLlmSnapshotBinding | undefined): ReadonlySet<string> {
  return (binding === undefined ? undefined : seenOn.get(binding)) ?? NONE;
}

/** Counts each line on both captures whose words now differ, against the page. */
function quietChanges(flow: Flow, earlier: Baseline, next: Baseline): void {
  const counts = flow.pages.get(next.location) ?? new Map<string, number>();
  flow.pages.delete(next.location);
  flow.pages.set(next.location, counts);
  for (const [handle, words] of next.words) {
    const was = earlier.words.get(handle);
    if (was === undefined || was === words) continue;
    const times = (counts.get(handle) ?? 0) + 1;
    counts.delete(handle);
    counts.set(handle, times);
  }
  for (const oldest of counts.keys()) if (counts.size > LINES_PER_PAGE) counts.delete(oldest); else break;
  for (const oldest of flow.pages.keys()) if (flow.pages.size > PAGES_PER_FLOW) flow.pages.delete(oldest); else break;
}

function seen(flow: Flow, location: string): ReadonlySet<string> {
  const counts = flow.pages.get(location);
  if (counts === undefined) return NONE;
  return new Set([...counts].flatMap(([handle, times]) => (times >= TIMES_SEEN ? [handle] : [])));
}

/** What a capture can be compared by, or nothing when it cannot be compared (header). */
function baselineOf(binding: WebLlmSnapshotBinding): Baseline | undefined {
  const evidence = binding.evidence;
  const timeOrigin = evidence.navigation?.timeOrigin;
  const provenance = binding.captureProvenance;
  if (typeof timeOrigin !== "number" || evidence.truncated === true || evidence.captureTruncated === true) return undefined;
  if (provenance !== undefined && (provenance.scope.kind === "single-frame" || provenance.coverage !== "complete")) return undefined;
  const words = new Map<string, string>();
  for (const line of webLlmLineFacts(evidence)) if (line.words !== undefined) words.set(line.handle, line.words);
  return { location: evidence.location, timeOrigin, words };
}
