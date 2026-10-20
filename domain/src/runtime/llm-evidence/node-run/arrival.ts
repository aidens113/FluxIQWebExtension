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
// **What is remembered.** One bit per build: a navigation node succeeded in
// it. The build is the one Core frames the call with (`./build-state/`): its
// `buildId`, and the brief's `callScope` when briefs run side by side. A build
// never seen has not arrived. Core's opening call of a round that starts the
// build afresh (`opening: "fresh"`) re-arms it, so a second round of the same
// build -- a project brief's reset loop, a legacy round -- is held to the rule
// again rather than inheriting the first one's arrival. The bit is kept in
// Core's durable build state as well (t728), so a host restarted mid-build
// still knows its build arrived; a build Core starts anew has a new id, and
// starts not there, which is also what the finished Flow meets the first time
// it runs on its own.
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
// **And a repair of a proposal** (t648, A8 `run-mv9zn5ob`, brief-6). A
// project repair opens with a fresh arrival, but its builder is shown the
// proposal it repairs, and that proposal's navigation to its own product page
// was refused `address_not_shown` six times. Core's opening call of a repair
// carries the repaired proposal's calls under `repairs`
// (`webNodeRepairedFlow`): each navigation's address counts as shown, as a
// held one does, and nothing else changes -- the opening still re-arms, still
// forgets the last build, and arrives only by navigating.
//
// **And the build's places** (t743, office rerun round 4,
// `run-mvgvyaip-d856e135`). A repair and a reset brief were refused navigations
// to pages the build had stood on, which Core's own words had named to them.
// Every brief's opening call (build, repair, reset) may carry the locations
// Core prints for the build under `places` (`webNodeOpeningPlaces`): each counts
// as shown (`./shown-addresses.ts`), and nothing else changes -- a place is no
// arrival and no step.
//
// **Only Core's own opening call.** Every key Core sets on its opening call
// (`held`, `repairs`, `places`, `arrived`) is read only on a call Core's frame marks as
// its opening (`opening`, t728), scoped or not. Before t728 this domain read
// Core's opening call id, `initial.<toolId>` or `initial.<toolId>.<scope>`, for
// it, and a model could write an id of that shape. A model-written call never
// carries Core's `opening`, so anywhere else each key is an unexpected key and
// refused as one.
//
// **What it holds back.** Every node that acts or reads for the Flow. A look
// (the observation node) is not held: it reads the page as it stands, because
// it runs nothing and is never a step of the Flow (`./run.ts`).
//
// **Bounded in this process like the repeated-refusal memory**
// (`../repeated-refusal.ts`, REMEMBERED_ANSWERS), and for the same reason: a
// build that has moved on has nothing to remember here. A build let go here is
// read back from Core's store if it calls again (`./build-state/memory.ts`).

import type { JsonObject, JsonValue } from "fluxiq/core";
import { isJsonRecord } from "../untrusted-json";
import { createWebNodeBuildMemory, type WebNodeBuildKey, type WebNodeBuildStatePersistence, type WebNodeOpening } from "./build-state";
import { webRunnableNode } from "./catalog";
import { webMovesThePage } from "./start-location";

/** How many builds this process remembers at once. */
const REMEMBERED_BUILDS = 16;

/** One call as Core's opening keys are read off it: the value it carries, and the opening Core's frame marks it with, if any. */
export type WebNodeOpeningCall = { value: JsonObject; opening: WebNodeOpening | undefined };

/** The address of each call that navigates, as written; nothing else a call carries. */
function navigationAddresses(calls: readonly JsonValue[]): string[] {
  return calls.flatMap((call) => {
    const node = isJsonRecord(call) ? webRunnableNode(call.node) : undefined;
    const url = isJsonRecord(call) && isJsonRecord(call.parameters) ? call.parameters.url : undefined;
    return node && webMovesThePage(node) && typeof url === "string" ? [url] : [];
  });
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
 * Read only on Core's own opening call (header). Anywhere else `held` is an
 * unexpected key and refused as one.
 */
export function webNodeHeldFlow(call: WebNodeOpeningCall): { look: JsonObject; addresses: string[]; calls: JsonValue[] } | undefined {
  const held = call.value[HELD_KEY];
  if (call.opening === undefined || !Array.isArray(held)) return undefined;
  const { [HELD_KEY]: _held, ...look } = call.value;
  // The calls themselves, for what the Flow holds that the model never wrote (`./held-literals/`, t432).
  return { look, addresses: navigationAddresses(held as JsonValue[]), calls: held as JsonValue[] };
}

/**
 * The key under which Core's opening call of a repair brief carries the calls
 * of the proposal it repairs, as `{node, parameters}` (Core
 * `project-agents/dispatch/run-brief.ts`, `shownAtOpening`, t648).
 */
const REPAIRS_KEY = "repairs";

/**
 * When this call is Core's opening call of a repair: the call without the
 * repaired proposal's calls, and the address each of its navigations goes to.
 * Otherwise nothing.
 *
 * Only a navigation's own address is read (header): it passed the address rule
 * when the proposal's builder ran it. Unlike `held`, this continues nothing --
 * the repair still opens afresh. Read only on Core's own opening call; anywhere
 * else `repairs` is an unexpected key and refused as one.
 */
export function webNodeRepairedFlow(call: WebNodeOpeningCall): { look: JsonObject; addresses: string[] } | undefined {
  const repairs = call.value[REPAIRS_KEY];
  if (call.opening === undefined || !Array.isArray(repairs)) return undefined;
  const { [REPAIRS_KEY]: _repairs, ...look } = call.value;
  return { look, addresses: navigationAddresses(repairs as JsonValue[]) };
}

/** The key under which Core's opening call of any brief carries the build's places, as Core prints them (t743). */
const PLACES_KEY = "places";

/**
 * When this call is Core's opening call of a brief carrying the build's places:
 * the call without them, and each place that is text. Otherwise nothing.
 *
 * Read only on Core's own opening call (header), as `repairs` is; anywhere else
 * `places` is an unexpected key and refused as one.
 */
export function webNodeOpeningPlaces(call: WebNodeOpeningCall): { look: JsonObject; places: string[] } | undefined {
  const places = call.value[PLACES_KEY];
  if (call.opening === undefined || !Array.isArray(places)) return undefined;
  const { [PLACES_KEY]: _places, ...look } = call.value;
  return { look, places: places.filter((place): place is string => typeof place === "string") };
}

/**
 * The key Core sets on the opening look of a builder that starts on its
 * prepared entry (Core `service/project-build/brief-ports.ts`, t585).
 */
const ARRIVED_KEY = "arrived";

/**
 * When this call is Core's opening look of a builder on its prepared entry:
 * the look without the mark (header). Otherwise nothing. Read only on Core's
 * own opening call, scoped or not, as `webNodeHeldFlow` is.
 */
export function webNodePreparedEntry(call: WebNodeOpeningCall): { look: JsonObject } | undefined {
  if (call.opening === undefined || call.value[ARRIVED_KEY] !== true) return undefined;
  const { [ARRIVED_KEY]: _arrived, ...look } = call.value;
  return { look };
}

export type WebNodeArrivals = {
  /** Read this build's arrival back from Core's store when this process holds none for it (`./build-state/memory.ts`). */
  restore(build: WebNodeBuildKey): Promise<void>;
  /** Whether a navigation node has succeeded in this build. */
  arrived(build: WebNodeBuildKey): boolean;
  /** A navigation node succeeded in this build. */
  arrive(build: WebNodeBuildKey): void;
  /** Forget the arrival when this call is Core's opening of a fresh round. */
  opening(build: WebNodeBuildKey, opening: WebNodeOpening | undefined): void;
};

export function createWebNodeArrivals(persistence?: WebNodeBuildStatePersistence): WebNodeArrivals {
  const reached = createWebNodeBuildMemory<true>({
    name: "web.arrival",
    bound: REMEMBERED_BUILDS,
    encode: () => true,
    decode: (stored) => (stored === true ? true : undefined),
    persistence
  });
  return {
    restore: (build) => reached.restore(build),
    arrived: (build) => reached.get(build) === true,
    arrive(build) {
      const before = reached.get(build);
      reached.entry(build, () => true);
      if (before === undefined) reached.saved(build);
    },
    opening(build, opening) {
      if (opening === "fresh") reached.forget(build);
    }
  };
}
