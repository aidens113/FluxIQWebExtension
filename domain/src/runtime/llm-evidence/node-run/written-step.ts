// A written step: `core.run_node` with `write: true` (t252, D1).
//
// The model may add a step without running it, once what it has seen is
// enough to know the step's node and parameters -- the act a loop does to each
// row, above all, which the build must not do to a real item the Flow should
// leave alone (run `run-murwcaj0-40e56557` accepted a friend request its own
// listing excluded). `./run.ts` takes a written call through every check a
// live call meets before it acts: the node, the call's keys, the page and the
// start location, the handle resolved into the frozen identity, the control's
// words, the declaration a mutating node owes, the origin and the addresses
// shown. Then it stops where a live call would send its command, and this file
// says what the step is.
//
// **Nothing is done, so nobody is asked.** The permission gate is not put to
// at write time: the build's test and the plan-time `flow_step` gate both gate
// the step, with the declaration it carries. The declaration must still be one
// the gate can read, as a live call's must. Neither is the covered-target check
// made: it is about where a press lands now, and nothing is pressed.
//
// **What a written step is held to that a run one is not.** A live call's
// parameters are judged by the page that runs them. A written one meets no
// page until the test, so its parameters are held to the node's own schema
// here: every required parameter given, and every given parameter of the kind
// the schema names. A bound value (`{"$state": ...}`, `../plan-resolution/
// state-binding.ts`) counts as given and is not judged, because the value it
// stands for exists only when the Flow runs.
//
// Core marks a step written only when this code comes back, so a domain that
// ignored `write` and acted would produce an ordinary recorded step, never a
// false "written".

import { isAutomationStudioActionConsequence } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationActionDefinitions } from "../../../actions/schemas";
import { toolExecution, withCallStates, type WebLlmEvidenceToolExecution } from "../capture";
import type { WebLlmNameAssumption } from "../name-assumption";
import { isWebPlanStateBinding } from "../plan-resolution";
import { present } from "../present";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { rejectionDetail, type WebLlmToolRejectionDetail } from "../tool-rejection";
import { isJsonRecord } from "../untrusted-json";
import type { WebRunnableNode } from "./catalog";
import { webNodeCall, webNodeFlowParameters, webNodeShownCall } from "./node-call";
import type { WebNodeOutcome } from "./outcome";
import { webNodeReplayStatement } from "./replay";

/** The code a written step answers with: Core's own word, which Core marks the step written by. */
export const WEB_NODE_WRITTEN_RESULT_CODE = "core.run_node.written";

/** Core's bound on one declaration (`../permission.ts` reads it the same way). */
const MAX_DECLARED = 10;

/** Whether a call asked to be written: `invalid` for a `write` that is not a boolean. */
export function webNodeWriteAsked(value: JsonObject): boolean | "invalid" {
  if (value.write === undefined) return false;
  return typeof value.write === "boolean" ? value.write : "invalid";
}

/**
 * What stops a written step, as its refusal's detail, or nothing.
 *
 * `ran` is the parameters resolved as the step would run, so a target handle
 * already stands as its `selector`. The declaration is read exactly as the
 * gate would read it (`../permission.ts`): nothing, or `null` from a node that
 * only reads, is no declaration; anything else is a list of Core's classes or
 * is unreadable. A node that acts and declared nothing was refused before this,
 * as a live one is.
 */
export function webWrittenStepIssue(node: WebRunnableNode, ran: JsonObject, declared: JsonValue | undefined): WebLlmToolRejectionDetail | undefined {
  const none = declared === undefined || (declared === null && node.effect === "observe");
  if (!none && !(Array.isArray(declared) && declared.length <= MAX_DECLARED && declared.every(isAutomationStudioActionConsequence))) {
    return rejectionDetail({ reason: "consequences_unreadable" });
  }
  const schema = webAutomationActionDefinitions.find((definition) => definition.actionType === node.actionType)?.parameterSchema;
  const required = Array.isArray(schema?.required) ? schema.required.filter((key): key is string => typeof key === "string") : [];
  const missing = required.filter((key) => ran[key] === undefined || ran[key] === null);
  if (missing.length) return rejectionDetail({ reason: "missing_input_keys", missing });
  const properties = isJsonRecord(schema?.properties) ? schema.properties : {};
  for (const [key, value] of Object.entries(ran)) {
    if (isWebPlanStateBinding(value)) continue;
    const property = properties[key];
    const kind = isJsonRecord(property) && typeof property.type === "string" ? property.type : undefined;
    if (kind !== undefined && !ofKind(value, kind)) return rejectionDetail({ reason: "parameter_not_readable", target: key });
  }
  return undefined;
}

/** What `./run.ts` knows of a written call once every check has passed. */
export type WebWrittenStepInput = {
  node: WebRunnableNode;
  /** The call as the model wrote it. */
  value: JsonObject;
  /** Its parameters with every handle in the resolver's shape. */
  written: JsonObject;
  /** Its parameters resolved as the step would run. */
  ran: JsonObject;
  /** The page the call read before it would have acted; absent from nowhere. */
  current: WebLlmSnapshotBinding | undefined;
  /** Where the step found the page, which is where a replay starts from it. */
  location: string;
  /** The words of the control it names, as the model was shown them. */
  control: string | undefined;
  assumed: WebLlmNameAssumption[] | undefined;
};

/**
 * The written step's result: `effectApplied: false`, Core's written code, and
 * the draft statement a live run of the same call would make -- `ranWith` with
 * its declaration, `replay` with where it found the page -- marked `written`
 * and proposable. The evidence is the outcome alone: the page did not change,
 * and the look it would repeat was taken by the call itself, unseen.
 */
export function webWrittenStep(input: WebWrittenStepInput): WebLlmEvidenceToolExecution {
  const { node, value, written, ran } = input;
  const outcome = present<WebNodeOutcome>({
    ok: true, node: node.definitionId, status: "written", pageChanged: undefined, unchangedPress: undefined,
    pageUnreadable: undefined, choice: undefined, changed: undefined, control: input.control, read: undefined, inFlow: true
  });
  const draft = present<NonNullable<WebLlmEvidenceToolExecution["draft"]>>({
    actionId: node.definitionId,
    effect: node.effect,
    input: webNodeShownCall(value, written),
    ranWith: webNodeCall(value, webNodeFlowParameters(written, ran)),
    proposes: true,
    replay: webNodeReplayStatement({ location: input.location, payload: undefined, reads: false }),
    control: input.control,
    interruption: undefined,
    written: true,
    // Never ran, so it flipped nothing (`./press-effect/toggle.ts`).
    toggle: undefined
  });
  // Nothing was sent, so the page the call found is the page it left.
  return withCallStates(toolExecution(outcome as unknown as JsonValue, false, WEB_NODE_WRITTEN_RESULT_CODE, undefined, draft, {
    resultReason: undefined, nodeId: undefined, assumed: input.assumed
  }), input.current, input.current);
}

/** Whether a value is of the JSON Schema `type` its parameter declares; a type this does not know passes. */
function ofKind(value: JsonValue | undefined, kind: string): boolean {
  switch (kind) {
    case "string": return typeof value === "string";
    case "boolean": return typeof value === "boolean";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "array": return Array.isArray(value);
    case "object": return isJsonRecord(value);
    default: return true;
  }
}
