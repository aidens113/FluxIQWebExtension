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
// **Except a round that continues a Flow.** A repair or re-author round whose
// draft already holds the Flow opens with Core's look on the page where the
// test left it, carrying the Flow's calls under `held` (`webNodeHeldFlow`). On
// run 38 (`run-muqilf9s-c3211328`, C3) that round ran the arrival again instead
// and started on the feed, off the requests page the test had left. Such a
// round continues the build rather than starting one, so it re-arms nothing
// and forgets nothing (`./shown-addresses.ts`), and a navigation the Flow holds
// is its arrival, as a replayed one is (`./run.ts`): every step of a Flow ran
// after it had arrived.
//
// **And a builder that opens on its prepared entry** (t585, A8 launch 6). A
// project build's dependent builder starts where its predecessors leave the
// site: before its first look Core ran their passing proposals, from the
// build's start location, in a session of its own (Core
// `service/project-build/entry-preparation.ts`). Its opening is therefore a
// look in place, never the arrival, which would walk away from the entry. On
// `run-mv85vjqo-4c022aec` that look re-armed this memory, and every typed
// search the builder made on its entry was refused `not_at_start_location`.
// Core now marks that opening look `arrived: true` (`webNodePreparedEntry`):
// it re-arms everything a fresh build re-arms, then counts as arrival, since
// the steps that reached the entry began at the start location. Only Core's
// own opening id carries it, as with `held`; anywhere else it is an unexpected
// key and refused as one, so no call the model writes can claim arrival.
//
// **What it holds back.** Every node that acts or reads for the Flow. A look
// (the observation node) is not held: it reads the page as it stands, because
// it runs nothing and is never a step of the Flow (`./run.ts`).
//
// **Bounded like the repeated-refusal memory** (`../repeated-refusal.ts`,
// REMEMBERED_ANSWERS), and for the same reason: a build that has moved on to
// another flow has nothing to remember here, and letting its slot go costs at
// most one refused call before the navigation that re-arrives.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { isJsonRecord } from "../untrusted-json";
import { webRunnableNode } from "./catalog";
import { webMovesThePage } from "./start-location";

/** How many (project, flow, session) builds are remembered at once. */
const REMEMBERED_BUILDS = 16;

/**
 * Core names the build's opening call `initial.<toolId>`
 * (`AS/runtime/llm/evidence-loop.ts`). That naming is Core's, not this
 * domain's; it is read here only to tell where a build begins, and read the
 * same way by what a build has been shown (`./shown-addresses.ts`).
 */
const OPENING_CALL_PREFIX = "initial.";

/** Whether this call is a build's opening call, which starts the build's memory afresh. */
export function webNodeOpensBuild(callId: string): boolean {
  return callId.startsWith(OPENING_CALL_PREFIX);
}

/**
 * The key under which Core's opening look of a round whose draft already holds
 * the Flow carries that Flow's calls, as written (`AS/runtime/llm/evidence-loop.ts`).
 */
const HELD_KEY = "held";

/**
 * When this call is the opening look of a round that continues a Flow: the
 * look without the Flow's calls, and the address each of the Flow's
 * navigations goes to, as written. Otherwise nothing.
 *
 * Only a navigation's address is read, and nothing else a held step carries:
 * every step of a Flow ran after the Flow arrived, and each navigation passed
 * the address rule when it first ran (run 38, C3 and C8).
 *
 * Read only on Core's own opening id, `initial.<this tool>`: Core makes that
 * call before the round's first decision and files a model's later call of the
 * same id under another, so no call the model writes can say what the Flow
 * holds. Anywhere else `held` is an unexpected key and refused as one.
 */
export function webNodeHeldFlow(request: { callId: string; toolId: string; value: JsonObject }): { look: JsonObject; addresses: string[]; calls: JsonValue[] } | undefined {
  const held = request.value[HELD_KEY];
  if (request.callId !== `${OPENING_CALL_PREFIX}${request.toolId}` || !Array.isArray(held)) return undefined;
  const { [HELD_KEY]: _held, ...look } = request.value;
  const addresses = held.flatMap((call) => {
    const node = isJsonRecord(call) ? webRunnableNode(call.node) : undefined;
    const url = isJsonRecord(call) && isJsonRecord(call.parameters) ? call.parameters.url : undefined;
    return node && webMovesThePage(node) && typeof url === "string" ? [url] : [];
  });
  // The calls themselves, for what the Flow holds that the model never wrote (`./held-literals/`, t432).
  return { look, addresses, calls: held as JsonValue[] };
}

/**
 * The key Core sets on the opening look of a builder that starts on its
 * prepared entry (Core `service/project-build/brief-ports.ts`, t585).
 */
const ARRIVED_KEY = "arrived";

/**
 * When this call is Core's opening look of a builder on its prepared entry:
 * the look without the mark (header). Otherwise nothing. Read only on Core's
 * own opening id, `initial.<this tool>`, as `webNodeHeldFlow` is.
 */
export function webNodePreparedEntry(request: { callId: string; toolId: string; value: JsonObject }): { look: JsonObject } | undefined {
  if (request.callId !== `${OPENING_CALL_PREFIX}${request.toolId}` || request.value[ARRIVED_KEY] !== true) return undefined;
  const { [ARRIVED_KEY]: _arrived, ...look } = request.value;
  return { look };
}

/** The build a call belongs to, as this memory keys it. */
export type WebNodeBuildKey = { projectId: string; flowId: string; sessionId: string };

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
      if (webNodeOpensBuild(callId)) reached.delete(key(build));
    }
  };
}
