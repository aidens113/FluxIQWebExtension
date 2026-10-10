// Which of a call's parameters the model wrote, when the round continues a
// Flow (t432).
//
// Every parameter of a call the model makes is its own writing, so an element
// it names other than by the handle the page view printed is refused
// (`../plan-resolution/written-literals.ts`). One kind of call is not wholly
// the model's: a rerun of a step the Flow already holds. A repair or re-author
// round reads the Flow back as its draft (Core's `draft-from-flow.ts`), each
// step holding the parameters the Flow saved -- its selector, its element, its
// list's item -- and a rerun merges only what the model changed over them
// (Core's `rerun-input.ts`). Judging the whole call would refuse the Flow's own
// saved address the moment the model changed a list's `where` or gave the step
// a new target handle, which no model wrote and no model was shown.
//
// So the round's opening look, which carries the Flow's calls under `held`
// (`../arrival.ts`), is remembered per build, and a later call's parameter
// whose value is the one a held call of the same node holds is the host's: it
// is not judged. A list read's or a Next page's request is the Flow's when it
// reads the item the Flow's does, whatever conditions the model rewrote, since
// its item is the locator in it. Every other parameter is the model's. A call
// in a build that continues no Flow holds nothing, so all of it is the
// model's. A new build forgets the last one's (`opening`), as arrival does.
//
// Bounded like the other build memories (`../arrival.ts`).

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebPlanNodeResolutionInput } from "../../plan-resolution";
import { isJsonRecord } from "../../untrusted-json";
import { webNodeOpensBuild, type WebNodeBuildKey } from "../arrival";
import { webRunnableNode } from "../catalog";

/** How many builds are remembered at once. */
const REMEMBERED_BUILDS = 16;
/** The parameters whose request is the Flow's when its `item` is. */
const LIST_REQUESTS: ReadonlySet<string> = new Set(["extractList", "nextPage"]);

export type WebNodeHeldLiterals = {
  /** Forget what the last build of this flow held, when this call opens a new one. */
  opening(build: WebNodeBuildKey, callId: string): void;
  /** Remember what the Flow a round continues holds, from its opening look's `held` calls. */
  hold(build: WebNodeBuildKey, calls: readonly JsonValue[]): void;
  /** Say on `input` which of its parameters the model wrote: all of them, or those the held Flow does not hold. */
  author(input: WebPlanNodeResolutionInput, build: WebNodeBuildKey): void;
};

export function createWebNodeHeldLiterals(): WebNodeHeldLiterals {
  const builds = new Map<string, Set<string>>();
  const keyOf = (build: WebNodeBuildKey): string => `${build.sessionId}\u0000${build.projectId}\u0000${build.flowId}`;
  return {
    opening(build, callId) {
      if (webNodeOpensBuild(callId)) builds.delete(keyOf(build));
    },
    hold(build, calls) {
      const held = new Set<string>();
      for (const call of calls) {
        const node = isJsonRecord(call) ? webRunnableNode(call.node) : undefined;
        const parameters = isJsonRecord(call) && isJsonRecord(call.parameters) ? call.parameters as JsonObject : undefined;
        if (!node || !parameters) continue;
        for (const [key, value] of Object.entries(parameters)) held.add(entry(node.definitionId, key, value));
      }
      const key = keyOf(build);
      builds.delete(key);
      builds.set(key, held);
      while (builds.size > REMEMBERED_BUILDS) builds.delete(builds.keys().next().value!);
    },
    author(input, build) {
      const held = builds.get(keyOf(build));
      const keys = Object.keys(input.parameters);
      const own = held ? keys.filter((key) => !held.has(entry(input.nodeDefinitionId, key, input.parameters[key]!))) : keys;
      if (own.length === keys.length) input.writtenByModel = true;
      else input.modelWrittenParameters = own;
    }
  };
}

/** One held value: its node, its parameter, and the value -- or, for a list's request, its item. */
function entry(nodeId: string, key: string, value: JsonValue): string {
  const item = LIST_REQUESTS.has(key) && isJsonRecord(value) && typeof value.item === "string" ? value.item : undefined;
  return `${nodeId}\u0000${key}\u0000${item !== undefined ? `item:${item}` : canonical(value)}`;
}

/** JSON with every object's keys in order, so two writings of one value are one entry. */
function canonical(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (!isJsonRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key] as JsonValue)}`).join(",")}}`;
}
