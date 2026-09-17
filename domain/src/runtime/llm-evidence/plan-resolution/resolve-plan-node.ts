// Turning the opaque handles a model put in a plan node into the parameters
// the node really runs with.
//
// The model authors a Flow from packets that never show it a selector. So where
// a web node needs one, the plan names what the model was shown instead:
//
// - a `selector` parameter written `{ "handle": "target.N" }` -- optionally with
//   the `location` of the page whose packet issued it -- becomes the selector
//   the runtime kept behind that handle (`target-packets.ts`);
// - so does the node's `target` or `element` parameter written the same way.
//   Every element node lists `target` (the adapted target Core writes back on
//   dispatch) and `element` (who the element is), and the packet names each
//   element by its `target`, so that is where a model puts the handle: live,
//   `target` on every node of every plan (`run-mu4vk93o-5f6675d7`), and
//   `element` on two plans of the next campaign. Either resolves into
//   `selector` and `element` exactly as a `selector` handle does, and a
//   `target` handle's key is dropped, so Core derives the adapted target from
//   them as it does for a recorded node. A node that names handles in several
//   of these slots must name one element with them, or it is refused as
//   `ambiguous`;
// - the extraction node's `extractList` written `{ "handle": "extraction.N" }`
//   -- optionally with `minItems` and `maxItems` -- becomes the
//   `web.dom.extract_list` request the detection tool kept behind it
//   (`structure/handles.ts`).
//
// A handle's element in a child frame also writes `browserFrameId`, and a node
// that already names a different frame is refused rather than silently moved.
//
// A resolved selector handle also writes `element`: who the element the model
// was shown is, in the shape a recorded node carries it
// (`element-identity.ts`). Without it Core reads a type node's `text` as the
// element's identity and the page refuses the right control. The handle is the
// authority on that identity, so an `element` the model wrote beside a handle
// is replaced; beside a literal selector it is the model's own and stays. A
// literal selector the model wrote beside a `target` handle is replaced the
// same way: the model was never shown one, so it can only be a guess.
//
// Nothing is guessed. A node with no handle is `unchanged` -- a literal
// selector the model wrote stays exactly as it wrote it and is never reported
// as resolved. A handle anywhere else, of the wrong kind for its slot, in the
// wrong shape, unknown to this project and Flow, let go by the bounded store,
// naming different controls on different pages or in the node's slots, or
// whose selector the page gave to several controls at once, refuses the whole
// node with a named code, and nothing of it is resolved.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractListRequestValue } from "../../../actions/extraction";
import { webAutomationActionDefinitions } from "../../../actions/schemas";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import { isJsonRecord } from "../untrusted-json";
import type { WebLlmExtractionHandles } from "../structure";
import type { WebLlmTargetPackets } from "./target-packets";

/** Every reason a node's handles are refused. */
export const WEB_PLAN_HANDLE_ISSUE_CODES = [
  "web.handle.malformed",
  "web.handle.misplaced",
  "web.handle.unknown",
  "web.handle.stale",
  "web.handle.ambiguous",
  "web.handle.not_unique",
  "web.handle.frame_mismatch"
] as const;

export type WebPlanHandleIssueCode = (typeof WEB_PLAN_HANDLE_ISSUE_CODES)[number];

export type WebPlanNodeResolutionInput = {
  projectId: string;
  flowId: string;
  nodeDefinitionId: string;
  parameters: JsonObject;
};

export type WebPlanNodeResolution =
  | { status: "unchanged" }
  | { status: "resolved"; parameters: JsonObject }
  | { status: "refused"; issueCodes: readonly WebPlanHandleIssueCode[] };

export type WebPlanHandleStores = {
  targets: WebLlmTargetPackets;
  extractions: WebLlmExtractionHandles;
};

const TARGET_HANDLE = /^target\.[1-9][0-9]?$/u;
const EXTRACTION_HANDLE = /^extraction\.[1-9][0-9]{0,8}$/u;
/** How deep a parameter is searched for a handle written somewhere no handle belongs. */
const MAX_SEARCH_DEPTH = 8;

/** The web nodes whose schema takes a `selector`: the only nodes a target handle may name one for. */
const SELECTOR_NODE_IDS: ReadonlySet<string> = new Set(
  webAutomationActionDefinitions
    .filter((definition) => isJsonRecord(definition.parameterSchema.properties) && "selector" in definition.parameterSchema.properties)
    .map((definition) => webAutomationOutputNodeId(definition.actionType))
);

/** The web nodes whose schema takes an `element`: the only nodes a resolved target's identity is written onto. */
const ELEMENT_NODE_IDS: ReadonlySet<string> = new Set(
  webAutomationActionDefinitions
    .filter((definition) => isJsonRecord(definition.parameterSchema.properties) && "element" in definition.parameterSchema.properties)
    .map((definition) => webAutomationOutputNodeId(definition.actionType))
);

/**
 * The parameters of an element node a target handle may be written in, in the
 * order their resolutions are read: its `selector`, its `target` (the adapted
 * target every such node lists), and its `element`.
 */
const TARGET_SLOTS = ["selector", "target", "element"] as const;

/** Whether `key` names the element of this node, so a target handle there is one to resolve. */
function isTargetSlot(key: string, nodeDefinitionId: string): boolean {
  if (!SELECTOR_NODE_IDS.has(nodeDefinitionId) || !(TARGET_SLOTS as readonly string[]).includes(key)) return false;
  return key !== "element" || ELEMENT_NODE_IDS.has(nodeDefinitionId);
}

/** The one node an extraction handle may name a request for. */
const EXTRACT_LIST_NODE_ID = webAutomationOutputNodeId("web.dom.extract_list");

type Resolved = { value: JsonValue; frameId: number | undefined; element: JsonObject | undefined };

const TARGET_ISSUES = {
  unknown: "web.handle.unknown",
  stale: "web.handle.stale",
  ambiguous: "web.handle.ambiguous",
  not_unique: "web.handle.not_unique"
} as const satisfies Record<"unknown" | "stale" | "ambiguous" | "not_unique", WebPlanHandleIssueCode>;

export function resolveWebPlanNodeParameters(input: WebPlanNodeResolutionInput, stores: WebPlanHandleStores): WebPlanNodeResolution {
  const scope = { projectId: input.projectId, flowId: input.flowId };
  const issues = new Set<WebPlanHandleIssueCode>();
  const replaced = new Map<string, Resolved>();
  for (const [key, value] of Object.entries(input.parameters)) {
    const slot = isTargetSlot(key, input.nodeDefinitionId)
      ? "target"
      : key === "extractList" && input.nodeDefinitionId === EXTRACT_LIST_NODE_ID ? "extraction" : undefined;
    // Outside a handle slot, and inside one below its top, a recognisable
    // handle is misplaced; anything else there is not this resolver's.
    if (slot === undefined || !isHandleObject(value)) {
      if (containsRecognisableHandle(value, 0)) issues.add("web.handle.misplaced");
      continue;
    }
    const outcome = slot === "target" ? resolveTarget(value, scope, stores.targets) : resolveExtraction(value, scope, stores.extractions);
    if (typeof outcome === "string") issues.add(outcome);
    else replaced.set(key, outcome);
  }
  if (issues.size > 0) return refused(issues);
  if (replaced.size === 0) return { status: "unchanged" };

  // Slots naming the element must all name the same one; which of two the node acts on is not this resolver's to pick.
  const named = TARGET_SLOTS.flatMap((slot) => replaced.get(slot) ?? []);
  const element = named[0];
  if (element && named.some((other) => other.value !== element.value || (other.frameId ?? 0) !== (element.frameId ?? 0))) {
    return refused(new Set<WebPlanHandleIssueCode>(["web.handle.ambiguous"]));
  }

  const frameId = handleFrame([...replaced.values()]);
  const declared = declaredFrame(input.parameters.browserFrameId);
  if (frameId === "mixed" || (declared !== undefined && declared !== (frameId ?? 0))) return refused(new Set<WebPlanHandleIssueCode>(["web.handle.frame_mismatch"]));

  const parameters: JsonObject = {};
  for (const [key, value] of Object.entries(input.parameters)) {
    // A `target` handle was where the element was named, not an adapted target
    // to keep; an `element` handle is written as the identity below.
    if ((key === "target" || key === "element") && replaced.has(key)) continue;
    parameters[key] = replaced.get(key)?.value ?? value;
  }
  if (element) parameters.selector = element.value;
  const identity = element?.element;
  if (identity !== undefined && ELEMENT_NODE_IDS.has(input.nodeDefinitionId)) parameters.element = identity;
  if (frameId !== undefined && frameId !== 0) parameters.browserFrameId = frameId;
  return { status: "resolved", parameters };
}

function resolveTarget(value: Record<string, unknown>, scope: { projectId: string; flowId: string }, targets: WebLlmTargetPackets): Resolved | WebPlanHandleIssueCode {
  if (Object.keys(value).some((key) => key !== "handle" && key !== "location")) return "web.handle.malformed";
  const handle = value.handle;
  if (typeof handle !== "string") return "web.handle.malformed";
  if (EXTRACTION_HANDLE.test(handle)) return "web.handle.misplaced";
  if (!TARGET_HANDLE.test(handle)) return "web.handle.malformed";
  if (value.location !== undefined && (typeof value.location !== "string" || value.location === "")) return "web.handle.malformed";
  const resolution = targets.resolve(scope, handle, value.location as string | undefined);
  if (!resolution.ok) return TARGET_ISSUES[resolution.code];
  return { value: resolution.selector, frameId: resolution.frameId, element: resolution.element as unknown as JsonObject };
}

function resolveExtraction(value: Record<string, unknown>, scope: { projectId: string; flowId: string }, extractions: WebLlmExtractionHandles): Resolved | WebPlanHandleIssueCode {
  if (Object.keys(value).some((key) => key !== "handle" && key !== "minItems" && key !== "maxItems")) return "web.handle.malformed";
  const handle = value.handle;
  if (typeof handle !== "string") return "web.handle.malformed";
  if (TARGET_HANDLE.test(handle)) return "web.handle.misplaced";
  if (!EXTRACTION_HANDLE.test(handle)) return "web.handle.malformed";
  const resolution = extractions.resolve(scope, handle);
  if (!resolution.ok) return resolution.code === "stale_handle" ? "web.handle.stale" : "web.handle.unknown";
  const request: JsonObject = resolution.binding.extractList as unknown as JsonObject;
  if (value.minItems !== undefined) request.minItems = value.minItems as JsonValue;
  if (value.maxItems !== undefined) request.maxItems = value.maxItems as JsonValue;
  // The bounds the plan added are held to the reader a dispatch is refused by,
  // so a handle never resolves into a request the page would not run.
  const checked = webAutomationExtractListRequestValue(request);
  if (checked === undefined || checked.minItems !== request.minItems || checked.maxItems !== request.maxItems) return "web.handle.malformed";
  return { value: request, frameId: resolution.binding.frameId, element: undefined };
}

/** A handle slot's value written as a handle: any object with a `handle` key. Its shape is judged by the slot. */
function isHandleObject(value: unknown): value is Record<string, unknown> {
  return isJsonRecord(value) && Object.prototype.hasOwnProperty.call(value, "handle");
}

/** Whether a value holds, at any depth, an object whose `handle` is a target or extraction handle. */
function containsRecognisableHandle(value: unknown, depth: number): boolean {
  if (depth > MAX_SEARCH_DEPTH) return false;
  if (Array.isArray(value)) return value.some((entry) => containsRecognisableHandle(entry, depth + 1));
  if (!isJsonRecord(value)) return false;
  if (typeof value.handle === "string" && (TARGET_HANDLE.test(value.handle) || EXTRACTION_HANDLE.test(value.handle))) return true;
  return Object.values(value).some((entry) => containsRecognisableHandle(entry, depth + 1));
}

/** The frame every resolved handle is in, `undefined` for the top frame, or `mixed` when they disagree. */
function handleFrame(resolved: Resolved[]): number | undefined | "mixed" {
  const frames = new Set(resolved.map((entry) => entry.frameId ?? 0));
  if (frames.size > 1) return "mixed";
  const only = [...frames][0];
  return only === 0 ? undefined : only;
}

/** The frame the node already names, with `0` for the top frame. Anything that is not a frame id names none. */
function declaredFrame(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function refused(issues: Set<WebPlanHandleIssueCode>): WebPlanNodeResolution {
  return { status: "refused", issueCodes: WEB_PLAN_HANDLE_ISSUE_CODES.filter((code) => issues.has(code)) };
}
