// Running the draft again as the Flow will run it, with no model attached.
//
// Core decides that a draft must be replayed before it may be proposed
// (`AS/runtime/flow-draft/dry-run.ts`); this is the web's half of carrying that
// out. Two calls arrive, both under the library verb the steps themselves ran
// under, both carrying the reserved `replay` key
// (`AS/runtime/llm/node-tools/replay.ts`):
//
//   reset -- put the page back where the draft's first step found it. That is
//            a navigation to the location that step recorded, which is the
//            cheapest reset this domain has: the page. It is not a fresh
//            browser context and not a fresh site session, because neither is
//            reachable from a gateway that can only run page actions, and the
//            difference is the one thing a reader of a verdict has to know.
//            A site that *remembers* a step -- a consent banner answered, a
//            soft check passed -- is not put back by this, and the step that
//            did it comes back `unreproducible` rather than `failed`.
//
//   step  -- run one step again with the parameters the Flow keeps, which are
//            the resolved ones. The command that goes out is the command
//            `io/gateway-output-dispatcher.ts` sends, so what is being proved
//            is the Flow and not a rehearsal of it.
//
// **The gate is asked on every replayed step, with the step's own
// declaration.** A replay is an act on a real page and is no more exempt from
// the person's grant than the original was; Core's check arrives on the request
// like any other call's, because the replay goes through the same executor
// (`AS/runtime/flow-bootstrap/action-permissions.ts`).
//
// **Nothing here shows the model a page it has not earned.** A replayed step
// that failed carries the page, because that is the page a correction has to be
// made from; one that worked carries a line saying so and nothing else.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webActionFailureRejectionCode } from "../action-failure";
import { assertActive, captureEvidence, toolExecution, toolMetadata, type WebLlmEvidenceToolExecution } from "../capture";
import { evidenceByteLimit, WEB_LLM_EVIDENCE_BYTE_BUDGETS, serializedBytes } from "../limits";
import { present } from "../present";
import { webActionPermission } from "../permission";
import { resolveWebPlanNodeParameters } from "../plan-resolution";
import { isJsonRecord } from "../untrusted-json";
import { webRunnableNode } from "./catalog";
import type { WebNodeRun } from "./run";

/** The reserved key Core marks a replay call with, and what it may ask for. */
export const WEB_LLM_REPLAY_KEY = "replay";

/**
 * The closed vocabulary a replay answers in.
 *
 * Core's own, because Core reads the answer and knows none of this domain's
 * codes (`AS/runtime/llm/node-tools/replay.ts` holds the same five). What
 * really happened, in this domain's words, goes in the evidence beside it.
 */
const REPLAY_RESULT_CODES = {
  replayed: "core.replay.replayed",
  failed: "core.replay.failed",
  changed: "core.replay.changed",
  unreproducible: "core.replay.unreproducible",
  resetFailed: "core.replay.reset_failed"
} as const;

/** The command a reset dispatches: the same move the Flow's own navigate makes. */
const RESET_ACTION = "web.browser.navigate";

/** How deep a payload is walked for the list a reading node read. */
const MAX_PRODUCED_DEPTH = 6;

/** What this domain writes onto a step so the step can be run again. */
export type WebNodeReplayStatement = { from?: JsonObject; produced?: JsonObject };

/**
 * What a step says about running it again: where it found the page, and how
 * much it read.
 *
 * `from` is written on every step and only the draft's first proposed step's
 * is ever used -- Core takes it from there, because that is where a replay
 * starts. `produced` is the size of the list a reading node read, which is the
 * one fact about a read that survives the values changing between runs: an
 * extraction that read sixteen rows while exploring and none on replay is the
 * defect this whole check exists for (`run-mudavyub-d34e3c9b`).
 */
export function webNodeReplayStatement(input: { location: string; payload: JsonValue | undefined; reads: boolean }): WebNodeReplayStatement {
  const records = input.reads ? webNodeRecordCount(input.payload) : undefined;
  return present<WebNodeReplayStatement>({
    from: { location: input.location },
    produced: records === undefined ? undefined : { records }
  });
}

/** Whether a call is a replay Core asked for rather than a node the model named. */
export function webNodeReplayCall(value: JsonObject): "reset" | "step" | undefined {
  const asked = value[WEB_LLM_REPLAY_KEY];
  return asked === "reset" || asked === "step" ? asked : undefined;
}

/** Carry out one replay call. */
export async function replayWebOutputNode(run: WebNodeRun, kind: "reset" | "step"): Promise<WebLlmEvidenceToolExecution> {
  return kind === "reset" ? await resetPage(run) : await replayStep(run);
}

/**
 * Put the page back where the draft's first step found it.
 *
 * The location is the one this domain wrote on that step, so nothing is
 * inferred and nothing of the model's is trusted. A reset that cannot be made
 * answers `reset_failed`, and Core replays nothing: a verdict taken from a page
 * that was never put back would be a verdict about the wrong thing.
 */
async function resetPage(run: WebNodeRun): Promise<WebLlmEvidenceToolExecution> {
  const from = isJsonRecord(run.request.value.from) ? run.request.value.from : undefined;
  const location = typeof from?.location === "string" ? from.location : undefined;
  if (!location || !isHttpLocation(location)) return answer(REPLAY_RESULT_CODES.resetFailed, "the page could not be put back");
  // Moving about has no lasting consequence, and the gate is still asked:
  // every act a replay takes goes through it, with no exception made for the
  // one this module writes itself.
  const permission = await webActionPermission({ check: run.request.permission, declared: [], control: { name: undefined, kind: "page" }, verb: "go to" });
  if (permission.kind === "refused" || permission.kind === "invalid") return answer(REPLAY_RESULT_CODES.resetFailed, "the reset was not permitted");
  const result = await run.gateway.executeAction(run.sessionId, { actionType: RESET_ACTION, parameters: { url: location }, metadata: toolMetadata(run.request) });
  assertActive(run.request.signal);
  return result.status === "succeeded"
    ? answer(REPLAY_RESULT_CODES.replayed, "the page was put back", true)
    : answer(REPLAY_RESULT_CODES.resetFailed, "the page could not be put back");
}

/**
 * Run one step again, exactly as the Flow will run it.
 *
 * The parameters are the ones the draft kept, which are already resolved, so
 * nothing is re-derived from a page that has since changed. The one exception
 * is the list an extraction reads, whose handle the draft keeps deliberately
 * and which is resolved here the same way the assembled plan's is.
 */
async function replayStep(run: WebNodeRun): Promise<WebLlmEvidenceToolExecution> {
  const value = run.request.value;
  const node = webRunnableNode(value.node);
  const parameters = isJsonRecord(value.parameters) ? value.parameters : undefined;
  if (!node || !parameters) return answer(REPLAY_RESULT_CODES.failed, "the step names nothing this domain can run");
  const permission = await webActionPermission({
    check: run.request.permission,
    declared: value.consequences,
    control: { name: undefined, kind: "step" },
    verb: node.definition.label.toLowerCase()
  });
  if (permission.kind === "refused" || permission.kind === "invalid") return answer(REPLAY_RESULT_CODES.failed, "the step was not permitted");
  // `gatedByCaller`, because the step was put to the gate a few lines above,
  // against this replay’s own declaration. Resolution would otherwise ask the
  // same question a second time and raise a second request for one act.
  const resolved = await resolveWebPlanNodeParameters(
    { projectId: run.request.projectId, flowId: run.request.flowId, nodeDefinitionId: node.definitionId, parameters, gatedByCaller: true },
    run.stores
  );
  // A parameter that cannot be made real is a Flow that cannot run, which is
  // exactly what the replay exists to catch before it is proposed.
  if (resolved.status === "refused") return await answerWithPage(run, REPLAY_RESULT_CODES.failed, "the step's parameters could not be resolved");
  const ran = resolved.status === "resolved" ? resolved.parameters : parameters;
  const result = await run.gateway.executeAction(run.sessionId, { actionType: node.actionType, parameters: ran, metadata: toolMetadata(run.request) });
  assertActive(run.request.signal);
  if (result.status !== "succeeded") {
    const failure = webActionFailureRejectionCode(result);
    // The one failure a page-level reset explains. A control that is simply not
    // there, on a page the step itself worked on, is what a site that remembers
    // the step looks like -- a consent banner answered once stays answered --
    // and refusing the whole draft for it would push the model to delete the
    // dismissals that round 1 lost. Every other failure is a failure.
    const unreproducible = failure === "target_not_found";
    return await answerWithPage(run, unreproducible ? REPLAY_RESULT_CODES.unreproducible : REPLAY_RESULT_CODES.failed, `the step did not run (${failure})`);
  }
  const produced = isJsonRecord(value.produced) ? value.produced : undefined;
  const before = typeof produced?.records === "number" ? produced.records : undefined;
  const now = webNodeRecordCount(result.payload as JsonValue | undefined);
  // Read something, then read nothing: the step ran and the Flow would still
  // answer with an empty hand. Only the collapse is judged, because a list that
  // is shorter or in another order between two runs is the page, not the step.
  if (before !== undefined && before > 0 && now === 0) {
    return await answerWithPage(run, REPLAY_RESULT_CODES.changed, `the step read nothing where it read ${before}`);
  }
  return answer(REPLAY_RESULT_CODES.replayed, "the step ran again", true);
}

/** How many rows a reading node's payload holds: the longest list it carries. */
export function webNodeRecordCount(payload: JsonValue | undefined, depth = 0): number | undefined {
  if (payload === undefined || payload === null || depth > MAX_PRODUCED_DEPTH) return undefined;
  if (Array.isArray(payload)) return payload.length;
  if (typeof payload !== "object") return undefined;
  let longest: number | undefined;
  for (const entry of Object.values(payload)) {
    const found = webNodeRecordCount(entry as JsonValue, depth + 1);
    if (found !== undefined && (longest === undefined || found > longest)) longest = found;
  }
  return longest;
}

/**
 * What a replay says about itself, beside whatever page it carries.
 *
 * Named rather than written inline so both answers -- the bare one and the one
 * with the page -- are the same three fields, and a field dropped from one is a
 * compile error rather than a packet the model quietly reasons without.
 */
type WebNodeReplayAnswer = { ok: boolean; code: string; said: string };

/** One replay's answer: the code Core reads, and one line of this domain's own. */
function answer(code: string, said: string, replayed = false): WebLlmEvidenceToolExecution {
  return toolExecution(present<WebNodeReplayAnswer>({ ok: replayed, code, said }) as unknown as JsonValue, replayed, code);
}

/**
 * The same, with the page a step broke on, because that is the page the
 * correction has to be made from and the model has no free look to spend on it.
 *
 * A capture that cannot be taken, or that will not fit, leaves the line alone:
 * a verdict without its page is still a verdict, and a packet over budget would
 * cost the model the evidence it already has.
 */
async function answerWithPage(run: WebNodeRun, code: string, said: string): Promise<WebLlmEvidenceToolExecution> {
  const budget = evidenceByteLimit(run.request.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration);
  try {
    const page = run.restamp(await captureEvidence(run.gateway, run.sessionId, run.request, run.request.signal));
    run.shown(page);
    // The page, with what the replay made of this step written on the same
    // packet: the one shape every other packet has, and a named spread of a
    // typed value rather than a literal, so the fields are still checked.
    const packet: JsonObject = page.evidence as unknown as JsonObject;
    const verdict: JsonObject = present<WebNodeReplayAnswer>({ ok: false, code, said }) as unknown as JsonObject;
    const value = { ...packet, ...verdict } as unknown as JsonValue;
    if (serializedBytes(value) <= budget) return toolExecution(value, false, code);
  } catch (error) {
    if (run.request.signal?.aborted) throw error;
  }
  return answer(code, said);
}

/** Whether a recorded location is one this domain will navigate back to. */
function isHttpLocation(location: string): boolean {
  try {
    const url = new URL(location);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
