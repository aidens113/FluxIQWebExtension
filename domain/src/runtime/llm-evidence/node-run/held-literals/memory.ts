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
// **A saved value stays the host's after a screen (t439).** What the model is
// shown of a step is screened of the keys this domain denies
// (`../../denied-keys.ts`): the saved element loses the `selector` inside it,
// and the step's own `selector` goes. A rerun of a step that ran in this round
// was merged over that shown copy, so it arrived with the saved element less
// its selector -- a value no held call holds exactly, which was then counted
// as the model's and refused as a literal it never wrote
// (`run-mv4912r9-53b05a51`, t942 and t870). So each held value is remembered
// both as saved and as shown, and a call naming no handle has a shown copy put
// back to the value saved, with the saved selector beside a saved element: the
// step runs on the address and the fingerprint the Flow saved, never on the
// screened remains.
//
// Bounded like the other build memories (`../arrival.ts`).

import type { JsonObject, JsonValue } from "fluxiq/core";
import { withoutWebLlmDeniedKeys } from "../../denied-keys";
import type { WebPlanNodeResolutionInput } from "../../plan-resolution";
import { isJsonRecord } from "../../untrusted-json";
import { webNodeOpensBuild, type WebNodeBuildKey } from "../arrival";
import { webRunnableNode } from "../catalog";

/** How many builds are remembered at once. */
const REMEMBERED_BUILDS = 16;
/** The parameters whose request is the Flow's when its `item` is. */
const LIST_REQUESTS: ReadonlySet<string> = new Set(["extractList", "nextPage"]);
/** The parameters a step names the element it acts on in. */
const ELEMENT_SLOTS = ["selector", "target", "element", "visualTarget"] as const;
/** The slots a handle may be written in (`../run.ts`). */
const HANDLE_SLOTS = ["selector", "target", "element"] as const;

export type WebNodeHeldLiterals = {
  /** Forget what the last build of this flow held, when this call opens a new one. */
  opening(build: WebNodeBuildKey, callId: string): void;
  /** Remember what the Flow a round continues holds, from its opening look's `held` calls. */
  hold(build: WebNodeBuildKey, calls: readonly JsonValue[]): void;
  /**
   * Say on `input` which of its parameters the model wrote: all of them, or
   * those the held Flow does not hold. A call naming no handle first has each
   * shown copy of a held value put back to the value saved (header).
   */
  author(input: WebPlanNodeResolutionInput, build: WebNodeBuildKey): void;
  /**
   * Whether `input`, already authored, names its element and the model wrote
   * none of how: the element a held step saved, which runs as saved with no
   * handle (`../run.ts`), as a Flow's playback runs it.
   */
  heldElement(input: WebPlanNodeResolutionInput): boolean;
};

/** What one continued Flow holds. `null` marks a shown copy two saved values share, which is put back to neither. */
type Held = {
  entries: Set<string>;
  saved: Map<string, JsonValue | null>;
  selectors: Map<string, JsonValue | null>;
};

export function createWebNodeHeldLiterals(): WebNodeHeldLiterals {
  const builds = new Map<string, Held>();
  const keyOf = (build: WebNodeBuildKey): string => `${build.sessionId}\u0000${build.projectId}\u0000${build.flowId}`;
  return {
    opening(build, callId) {
      if (webNodeOpensBuild(callId)) builds.delete(keyOf(build));
    },
    hold(build, calls) {
      const held: Held = { entries: new Set(), saved: new Map(), selectors: new Map() };
      for (const call of calls) {
        const node = isJsonRecord(call) ? webRunnableNode(call.node) : undefined;
        const parameters = isJsonRecord(call) && isJsonRecord(call.parameters) ? call.parameters as JsonObject : undefined;
        if (!node || !parameters) continue;
        for (const [key, value] of Object.entries(parameters)) {
          const saved = entry(node.definitionId, key, value);
          const shown = entry(node.definitionId, key, withoutWebLlmDeniedKeys(value));
          held.entries.add(saved);
          if (shown === saved) continue;
          held.entries.add(shown);
          remember(held.saved, shown, value);
        }
        if (parameters.element !== undefined && parameters.selector !== undefined) {
          remember(held.selectors, entry(node.definitionId, "element", withoutWebLlmDeniedKeys(parameters.element)), parameters.selector);
        }
      }
      const key = keyOf(build);
      builds.delete(key);
      builds.set(key, held);
      while (builds.size > REMEMBERED_BUILDS) builds.delete(builds.keys().next().value!);
    },
    author(input, build) {
      const held = builds.get(keyOf(build));
      if (held && !namesHandle(input.parameters)) input.parameters = restored(held, input.nodeDefinitionId, input.parameters);
      const keys = Object.keys(input.parameters);
      const own = held ? keys.filter((key) => !held.entries.has(entry(input.nodeDefinitionId, key, input.parameters[key]!))) : keys;
      if (own.length === keys.length) input.writtenByModel = true;
      else input.modelWrittenParameters = own;
    },
    heldElement(input) {
      if (input.writtenByModel === true) return false;
      const own = input.modelWrittenParameters ?? [];
      const slots = ELEMENT_SLOTS.filter((slot) => Object.hasOwn(input.parameters, slot));
      return slots.length > 0 && !slots.some((slot) => own.includes(slot));
    }
  };
}

/** The parameters with each shown copy of a held value put back to the value saved, and the saved selector beside a saved element. */
function restored(held: Held, nodeId: string, parameters: JsonObject): JsonObject {
  const out: JsonObject = {};
  for (const [key, value] of Object.entries(parameters)) {
    const saved = held.saved.get(entry(nodeId, key, value));
    out[key] = saved === undefined || saved === null ? value : structuredClone(saved);
  }
  if (out.selector === undefined && out.element !== undefined) {
    const selector = held.selectors.get(entry(nodeId, "element", withoutWebLlmDeniedKeys(out.element)));
    if (selector !== undefined && selector !== null) out.selector = structuredClone(selector);
  }
  return out;
}

/** Remember one value under its key; a key two different values share keeps neither. */
function remember(map: Map<string, JsonValue | null>, key: string, value: JsonValue): void {
  const known = map.get(key);
  if (known === undefined) map.set(key, value);
  else if (known !== null && canonical(known) !== canonical(value)) map.set(key, null);
}

/** Whether a call names an element by handle in any slot one may be written in. */
function namesHandle(parameters: JsonObject): boolean {
  return HANDLE_SLOTS.some((slot) => {
    const value = parameters[slot];
    return isJsonRecord(value) && Object.hasOwn(value, "handle");
  });
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
