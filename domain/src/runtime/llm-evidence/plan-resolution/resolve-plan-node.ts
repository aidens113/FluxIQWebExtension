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
// - the extraction node's `extractList` naming an `extraction.N` becomes the
//   `web.dom.extract_list` request the detection tool kept behind it, cut to the
//   columns and pages the plan asks for (`extraction-slot.ts`);
// - Core's Run Output node (`builtin.policy.action`) naming a web output is
//   resolved in its payload exactly as that output's own node is, since the
//   payload is what the output runs with.
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
// as resolved -- with one exception: once this Flow's exploration was shown a
// detected list, a literal `extractList` can only be a guess at selectors the
// model was never shown, and live every one of them read no field
// (`run-mu4wwkbc-df6cfe60`), so it is refused as `extraction_required`. A
// handle anywhere else, of the wrong kind for its slot, in the wrong shape,
// unknown to this project and Flow, let go by the bounded store, naming
// different controls on different pages or in the node's slots, or whose
// selector the page gave to several controls at once, refuses the whole node,
// and nothing of it is resolved.
//
// A refusal is all the model learns before it tries again, and a bare code did
// not teach it: live builds repeated one refusal until they gave up
// (`run-mu4xn1wz-6cdb8bbf`). So a refusal names its reasons, then where a
// handle of that kind is accepted and in which shape, then `<reason>:<path>`
// for each place it was refused at, quoted by position (`issue-position.ts`).
//
// Once the node's parameters are real, the step itself is put to Core's
// permission gate (`step-permission.ts`), which is what makes a Flow that
// publishes, buys, edits or deletes something a person is asked about rather
// than something that happens every time it runs. That is a different answer
// from a refusal and is reported as one: `needs_permission` is nobody's to
// correct but the person's.

import type { AutomationStudioActionConsequence, AutomationStudioActionPermissionCheck } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationActionDefinitions } from "../../../actions/schemas";
import type { WebAutomationActionType } from "../../../actions/types";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import type { WebLlmExtractionHandles } from "../structure";
import { isJsonRecord } from "../untrusted-json";
import { resolveWebExtractionSlot } from "./extraction-slot";
import { webPlanHandleKind, webPlanHandlesIn, type WebPlanHandleKind, type WebPlanValuePath } from "./handle-tokens";
import { webPlanPositionCode } from "./issue-position";
import { webPlanStepPermission, type WebPlanStepIssueCode } from "./step-permission";
import type { WebLlmTargetPackets } from "./target-packets";

/**
 * Every code a refusal is made of, in the order a refusal lists them: why the
 * node was refused, then where a handle of that kind is accepted and in which
 * shape. Each reason is also followed by `<code>:<position>` for where it applied.
 */
export const WEB_PLAN_HANDLE_ISSUE_CODES = [
  "web.handle.malformed",
  "web.handle.misplaced",
  "web.handle.unknown",
  "web.handle.stale",
  "web.handle.ambiguous",
  "web.handle.not_unique",
  "web.handle.frame_mismatch",
  "web.handle.unknown_field",
  "web.handle.extraction_required",
  // The handle names a real control, and it is not a control this step can act
  // on: a choice step handed a button, an entry step handed a link. Refused
  // here rather than at run time, where it arrives as
  // `web.validation.output_not_observed` with the Flow already built and the
  // evidence long gone (`run-mu6cedna-3dd46e49`: "expected a select element to
  // choose value 5 in, actual the target is a <button>"). Only a contradiction
  // the registered output itself would refuse is counted.
  "web.handle.wrong_control",
  // The extraction node's `extractList` as `{ handle, fields?, paginate? }`, as its description spells out.
  "web.handle.expected.extract_list.handle_fields_paginate",
  // An element node's `selector` as `{ handle, location? }`.
  "web.handle.expected.selector.handle_location"
] as const;

export type WebPlanHandleIssueCode = (typeof WEB_PLAN_HANDLE_ISSUE_CODES)[number];

/** One code of a refusal: a published code, or a reason followed by the position it applied at. */
export type WebPlanHandleIssue = WebPlanHandleIssueCode | `${WebPlanHandleIssueCode}:${string}`;

export type WebPlanNodeResolutionInput = {
  projectId: string;
  flowId: string;
  nodeDefinitionId: string;
  parameters: JsonObject;
  /**
   * Core's check for this step of the Flow. Called once the step's parameters
   * are real, so the request that reaches the person names the control the
   * model was shown. Absent only where a caller drove this without a build
   * behind it, which is nobody to ask: a step that would do something lasting
   * is then refused rather than taken.
   */
  permission?: AutomationStudioActionPermissionCheck | undefined;
  /**
   * What the step said its own action would lastingly do, in Core's classes.
   * Absent when the step declared nothing; empty when it declared that it
   * causes nothing lasting. Never this domain's reading of the control.
   */
  declaredConsequences?: readonly AutomationStudioActionConsequence[] | undefined;
};

export type WebPlanNodeResolution =
  | { status: "unchanged" }
  | { status: "resolved"; parameters: JsonObject }
  | { status: "refused"; issueCodes: readonly (WebPlanHandleIssue | WebPlanStepIssueCode)[] }
  /** A person must answer this one. `requestId` is null where there was nobody to ask. */
  | { status: "needs_permission"; missing: readonly AutomationStudioActionConsequence[]; requestId: string | null };

export type WebPlanHandleStores = {
  targets: WebLlmTargetPackets;
  extractions: WebLlmExtractionHandles;
};

/** Core's bound on the codes one refusal may carry (`plan-parameter-resolution.ts`). */
const MAX_ISSUE_CODES = 16;

/** Where a handle of each kind is accepted, named for a refusal that is about where or how it was written. */
const EXPECTED_PLACEMENT = {
  extraction: "web.handle.expected.extract_list.handle_fields_paginate",
  target: "web.handle.expected.selector.handle_location"
} as const satisfies Record<WebPlanHandleKind, WebPlanHandleIssueCode>;
const PLACEMENT_REASONS: ReadonlySet<WebPlanHandleIssueCode> = new Set(["web.handle.malformed", "web.handle.misplaced", "web.handle.unknown_field", "web.handle.extraction_required"]);

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

/** The outputs this domain registers, which Core's Run Output node may name. */
const WEB_OUTPUT_IDS: ReadonlySet<string> = new Set(webAutomationActionDefinitions.map((definition) => definition.actionType));
const RUN_OUTPUT_NODE_ID = "builtin.policy.action";

function isWebOutputId(value: unknown): value is WebAutomationActionType {
  return typeof value === "string" && WEB_OUTPUT_IDS.has(value);
}

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

/** Choosing an option is `HTMLSelectElement` behaviour, and the output refuses anything else outright. */
const SELECT_NODE_ID = webAutomationOutputNodeId("web.dom.select");
/** Entering and clearing text need an editable control. */
const TEXT_ENTRY_NODE_IDS: ReadonlySet<string> = new Set([webAutomationOutputNodeId("web.dom.type"), webAutomationOutputNodeId("web.dom.clear")]);
/** Tags that are positively not editable. Anything unrecognised is left alone: this refuses what is known wrong, never what is merely unfamiliar. */
const NEVER_EDITABLE_TAGS: ReadonlySet<string> = new Set(["select", "button", "a", "option", "img"]);

/**
 * Whether the element the handle names is one this step's output would refuse.
 *
 * The evidence packet names each element's tag, so a step that chooses an
 * option and names a button is a mistake the model made with the answer in
 * front of it -- and one that used to reach a built Flow and fail on the page,
 * long after the packet that would have corrected it was gone. Only a
 * contradiction the registered output itself enforces counts, so this can
 * refuse nothing the run would have accepted.
 */
function actsOnTheWrongControl(nodeDefinitionId: string, identity: JsonObject | undefined): boolean {
  const tagName = typeof identity?.tagName === "string" ? identity.tagName.toLowerCase() : undefined;
  if (tagName === undefined) return false;
  if (nodeDefinitionId === SELECT_NODE_ID) return tagName !== "select";
  return TEXT_ENTRY_NODE_IDS.has(nodeDefinitionId) && NEVER_EDITABLE_TAGS.has(tagName);
}

type Scope = { projectId: string; flowId: string };
type Resolved = { value: JsonValue; frameId: number | undefined; element: JsonObject | undefined };
/** One reason a node was refused, the kind of handle it is about, and where. */
type Refusal = { code: WebPlanHandleIssueCode; kind: WebPlanHandleKind | undefined; path: WebPlanValuePath };
type NodeOutcome =
  | { status: "unchanged" }
  | { status: "resolved"; parameters: JsonObject }
  | { status: "refused"; refusals: Refusal[] };

const TARGET_ISSUES = {
  unknown: "web.handle.unknown",
  stale: "web.handle.stale",
  ambiguous: "web.handle.ambiguous",
  not_unique: "web.handle.not_unique"
} as const satisfies Record<"unknown" | "stale" | "ambiguous" | "not_unique", WebPlanHandleIssueCode>;

export async function resolveWebPlanNodeParameters(input: WebPlanNodeResolutionInput, stores: WebPlanHandleStores): Promise<WebPlanNodeResolution> {
  const scope = { projectId: input.projectId, flowId: input.flowId };
  const outcome = input.nodeDefinitionId === RUN_OUTPUT_NODE_ID
    ? resolveRunOutput(input.parameters, scope, stores)
    : resolveNode(input.nodeDefinitionId, input.parameters, scope, stores);
  if (outcome.status === "refused") return refusal(input.parameters, outcome.refusals);
  // The step is asked about with the parameters it would really run with, so
  // the request names the control the model was shown rather than a handle.
  const acting = actingStep(input.nodeDefinitionId, outcome.status === "resolved" ? outcome.parameters : input.parameters);
  const permission = await webPlanStepPermission({
    nodeDefinitionId: acting.nodeDefinitionId,
    declared: input.declaredConsequences,
    check: input.permission,
    parameters: acting.parameters
  });
  if (permission.kind === "undeclared") return { status: "refused", issueCodes: ["web.step.consequences_undeclared", "web.step.expected.consequences_classes_or_none"] };
  if (permission.kind === "refused") return { status: "needs_permission", missing: permission.missing, requestId: permission.requestId };
  return outcome;
}

/**
 * The action the step really takes, and the parameters it takes it with. Core's
 * Run Output node takes its action through the web output its payload names, so
 * a declaration on that step is about that output, and the element it acts on
 * is named inside the payload rather than beside it.
 */
function actingStep(nodeDefinitionId: string, parameters: JsonObject): { nodeDefinitionId: string; parameters: JsonObject } {
  if (nodeDefinitionId !== RUN_OUTPUT_NODE_ID || !isWebOutputId(parameters.outputId)) return { nodeDefinitionId, parameters };
  const payload = parameters.parameters;
  return { nodeDefinitionId: webAutomationOutputNodeId(parameters.outputId), parameters: isJsonRecord(payload) ? payload as JsonObject : {} };
}

function resolveNode(nodeDefinitionId: string, parameters: JsonObject, scope: Scope, stores: WebPlanHandleStores): NodeOutcome {
  const refusals: Refusal[] = [];
  const replaced = new Map<string, Resolved>();
  const extractionNode = nodeDefinitionId === EXTRACT_LIST_NODE_ID;
  for (const [key, value] of Object.entries(parameters)) {
    if (extractionNode && key === "extractList") {
      const slot = resolveWebExtractionSlot(value, scope, stores.extractions);
      if (slot.status === "resolved") replaced.set(key, { value: slot.request, frameId: slot.frameId, element: undefined });
      else if (slot.status === "refused") refusals.push({ code: slot.issue, kind: "extraction", path: [key, ...slot.path] });
      else if (stores.extractions.issuedFor(scope)) refusals.push({ code: "web.handle.extraction_required", kind: "extraction", path: [key] });
      continue;
    }
    if (isTargetSlot(key, nodeDefinitionId) && isHandleObject(value)) {
      const outcome = resolveTarget(value, scope, stores.targets);
      if (typeof outcome !== "string") replaced.set(key, outcome);
      // A target slot refuses only an extraction handle as misplaced.
      else refusals.push({ code: outcome, kind: outcome === "web.handle.misplaced" ? "extraction" : "target", path: [key] });
      continue;
    }
    // Outside a handle slot, a recognisable handle is misplaced. On the
    // extraction node it can only have been meant for the list.
    for (const found of webPlanHandlesIn(value)) {
      refusals.push({ code: "web.handle.misplaced", kind: extractionNode ? "extraction" : found.kind, path: [key, ...found.path] });
    }
  }
  if (refusals.length > 0) return { status: "refused", refusals };
  if (replaced.size === 0) return { status: "unchanged" };

  // Slots naming the element must all name the same one; which of two the node acts on is not this resolver's to pick.
  const named = TARGET_SLOTS.flatMap((slot) => {
    const resolved = replaced.get(slot);
    return resolved ? [{ slot, resolved }] : [];
  });
  const element = named[0]?.resolved;
  const disagreeing = named.find(({ resolved }) => resolved.value !== element?.value || (resolved.frameId ?? 0) !== (element?.frameId ?? 0));
  if (disagreeing) return { status: "refused", refusals: [{ code: "web.handle.ambiguous", kind: "target", path: [disagreeing.slot] }] };
  const firstNamed = named[0];
  if (firstNamed && actsOnTheWrongControl(nodeDefinitionId, element?.element)) {
    return { status: "refused", refusals: [{ code: "web.handle.wrong_control", kind: "target", path: [firstNamed.slot] }] };
  }

  const frameId = handleFrame([...replaced.values()]);
  const declared = declaredFrame(parameters.browserFrameId);
  if (frameId === "mixed" || (declared !== undefined && declared !== (frameId ?? 0))) {
    return { status: "refused", refusals: [{ code: "web.handle.frame_mismatch", kind: undefined, path: frameId === "mixed" ? [] : ["browserFrameId"] }] };
  }

  const resolved: JsonObject = {};
  for (const [key, value] of Object.entries(parameters)) {
    // A `target` handle was where the element was named, not an adapted target
    // to keep; an `element` handle is written as the identity below.
    if ((key === "target" || key === "element") && replaced.has(key)) continue;
    resolved[key] = replaced.get(key)?.value ?? value;
  }
  if (element) resolved.selector = element.value;
  const identity = element?.element;
  if (identity !== undefined && ELEMENT_NODE_IDS.has(nodeDefinitionId)) resolved.element = identity;
  if (frameId !== undefined && frameId !== 0) resolved.browserFrameId = frameId;
  return { status: "resolved", parameters: resolved };
}

/** Core's Run Output node: a web output's payload resolved as that output's own node, and a handle anywhere else misplaced. */
function resolveRunOutput(parameters: JsonObject, scope: Scope, stores: WebPlanHandleStores): NodeOutcome {
  const { outputId, parameters: payload } = parameters;
  const inner = isWebOutputId(outputId) && isJsonRecord(payload)
    ? resolveNode(webAutomationOutputNodeId(outputId), payload as JsonObject, scope, stores)
    : undefined;
  const refusals: Refusal[] = [];
  for (const [key, value] of Object.entries(parameters)) {
    if (key === "parameters" && inner !== undefined) continue;
    for (const found of webPlanHandlesIn(value)) refusals.push({ code: "web.handle.misplaced", kind: found.kind, path: [key, ...found.path] });
  }
  if (inner?.status === "refused") {
    for (const entry of inner.refusals) refusals.push({ code: entry.code, kind: entry.kind, path: ["parameters", ...entry.path] });
  }
  if (refusals.length > 0) return { status: "refused", refusals };
  if (inner?.status !== "resolved") return { status: "unchanged" };
  const resolved: JsonObject = {};
  for (const [key, value] of Object.entries(parameters)) resolved[key] = key === "parameters" ? inner.parameters : value;
  return { status: "resolved", parameters: resolved };
}

function resolveTarget(value: Record<string, unknown>, scope: Scope, targets: WebLlmTargetPackets): Resolved | WebPlanHandleIssueCode {
  if (Object.keys(value).some((key) => key !== "handle" && key !== "location")) return "web.handle.malformed";
  const kind = webPlanHandleKind(value.handle);
  if (kind === "extraction") return "web.handle.misplaced";
  if (kind !== "target" || typeof value.handle !== "string") return "web.handle.malformed";
  if (value.location !== undefined && (typeof value.location !== "string" || value.location === "")) return "web.handle.malformed";
  const resolution = targets.resolve(scope, value.handle, value.location as string | undefined);
  if (!resolution.ok) return TARGET_ISSUES[resolution.code];
  return { value: resolution.selector, frameId: resolution.frameId, element: resolution.element as unknown as JsonObject };
}

/** A handle slot's value written as a handle: any object with a `handle` key. Its shape is judged by the slot. */
function isHandleObject(value: unknown): value is Record<string, unknown> {
  return isJsonRecord(value) && Object.prototype.hasOwnProperty.call(value, "handle");
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

/** A refusal's codes: its reasons in a fixed order, where each kind of handle it is about is accepted, then each reason's position. */
function refusal(parameters: JsonObject, refusals: Refusal[]): Extract<WebPlanNodeResolution, { status: "refused" }> {
  const codes = new Set<WebPlanHandleIssueCode>(refusals.map((entry) => entry.code));
  for (const entry of refusals) {
    if (entry.kind !== undefined && PLACEMENT_REASONS.has(entry.code)) codes.add(EXPECTED_PLACEMENT[entry.kind]);
  }
  const reasons = WEB_PLAN_HANDLE_ISSUE_CODES.filter((code) => codes.has(code));
  const positions = [...new Set(refusals.map((entry) => webPlanPositionCode(entry.code, parameters, entry.path) as WebPlanHandleIssue))];
  return { status: "refused", issueCodes: [...reasons, ...positions].slice(0, MAX_ISSUE_CODES) };
}
