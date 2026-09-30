// Whether a build told where its Flow starts has got there yet, as a fact of
// the build rather than of the tab.
//
// **Why the tab is not enough.** Until 2026-09-29 the only thing that held a
// build to "go to the start location first" was the blank tab refusing to be
// read (`./start-location.ts`). On `run-muncqlr0-3348202b` (run 6) the tab was
// already on `/scenarios/bigbox-retail/`, the start location itself, so the
// build's first look read it, nothing ever navigated, the Flow was assembled
// with no step that reaches its page, and Core refused completion
// `bootstrap.cannot_reach_start_location` -- two decisions and a completion
// spent on a Flow that could never have been proposed. Core cannot write the
// missing step itself, because only this domain knows which node navigates.
//
// **What is remembered.** One bit per (project, flow, session): a navigation
// node succeeded in this build. A key never seen has not arrived, so a new
// process -- a resumed build -- starts every build not there, which is also
// what the finished Flow meets the first time it runs on its own. The build's
// opening call re-arms its key, so a second build of the same flow in one
// process is held to the rule again rather than inheriting the first one's
// arrival.
//
// **Bounded like the repeated-refusal memory** (`../repeated-refusal.ts`,
// REMEMBERED_ANSWERS), and for the same reason: a build that has moved on to
// another flow has nothing to remember here, and letting its slot go costs at
// most one refused call before the navigation that re-arrives.

/** How many (project, flow, session) builds are remembered at once. */
const REMEMBERED_BUILDS = 16;

/**
 * Core names the build's opening call `initial.<toolId>`
 * (`AS/runtime/llm/evidence-loop.ts`). That naming is Core's, not this
 * domain's; it is read here only to tell where a build begins.
 */
const OPENING_CALL_PREFIX = "initial.";

/** The build a call belongs to, as this memory keys it. */
type WebNodeBuildKey = { projectId: string; flowId: string; sessionId: string };

export type WebNodeArrivals = {
  /** Whether a navigation node has succeeded in this build. */
  arrived(build: WebNodeBuildKey): boolean;
  /** A navigation node succeeded in this build. */
  arrive(build: WebNodeBuildKey): void;
  /** Forget the arrival when this call is the build's opening call. */
  opening(build: WebNodeBuildKey, callId: string): void;
};

export function createWebNodeArrivals(): WebNodeArrivals {
  const reached = new Set<string>();
  const key = (build: WebNodeBuildKey): string => `${build.sessionId}\u0000${build.projectId}\u0000${build.flowId}`;
  return {
    arrived: (build) => reached.has(key(build)),
    arrive(build) {
      const slot = key(build);
      reached.delete(slot);
      reached.add(slot);
      for (const oldest of reached) {
        if (reached.size <= REMEMBERED_BUILDS) break;
        reached.delete(oldest);
      }
    },
    opening(build, callId) {
      if (callId.startsWith(OPENING_CALL_PREFIX)) reached.delete(key(build));
    }
  };
}
