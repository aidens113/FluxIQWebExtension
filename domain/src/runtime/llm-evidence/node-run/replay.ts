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
//   verify -- check a step whose effect lasts, and run nothing that acts: a
//            dry run never repeats a lasting effect (`./verify.ts`).
//
// **The gate is asked on every replayed step, with the step's own
// declaration.** A replay is an act on a real page and is no more exempt from
// the person's permission than the original was; Core's check arrives on the request
// like any other call's, because the replay goes through the same executor
// (`AS/runtime/flow-bootstrap/action-permissions.ts`).
//
// **Nothing here shows the model a page it has not earned.** A replayed step
// that failed carries the page, because that is the page a correction has to be
// made from; one that worked carries a line saying so and nothing else.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../failure";
import { webActionFailureRefusal, webActionNeedsPerson } from "../action-failure";
import { assertActive, toolMetadata, withPersonNeeded, type WebLlmEvidenceToolExecution } from "../capture";
import { present } from "../present";
import { webActionPermission } from "../permission";
import { resolveWebPlanNode } from "../plan-resolution";
import { webLlmHandleRejectionReason } from "../tool-rejection";
import { isJsonRecord } from "../untrusted-json";
import { webRunnableNode } from "./catalog";
import {
  WEB_NODE_REPLAY_RESULT_CODES as REPLAY_RESULT_CODES,
  webNodeReplayAnswer as answer,
  webNodeReplayAnswerWithPage as answerWithPage,
  webNodeReplayPermissionReason as permissionReason
} from "./replay-answer";
import type { WebNodeRun } from "./run";
import { verifyWebOutputNode } from "./verify";

/** The reserved key Core marks a replay call with, and what it may ask for. */
export const WEB_LLM_REPLAY_KEY = "replay";

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

/** What Core may ask of a replay call. */
export type WebNodeReplayKind = "reset" | "step" | "verify";

/** Whether a call is a replay Core asked for rather than a node the model named. */
export function webNodeReplayCall(value: JsonObject): WebNodeReplayKind | undefined {
  const asked = value[WEB_LLM_REPLAY_KEY];
  return asked === "reset" || asked === "step" || asked === "verify" ? asked : undefined;
}

/** Carry out one replay call. */
export async function replayWebOutputNode(run: WebNodeRun, kind: WebNodeReplayKind): Promise<WebLlmEvidenceToolExecution> {
  if (kind === "reset") return await resetPage(run);
  return kind === "verify" ? await verifyWebOutputNode(run) : await replayStep(run);
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
  const permission = await webActionPermission({ check: run.request.permission, declared: [], control: { name: undefined, kind: "page" }, verb: "go to", effect: "mutate" });
  if (permission.kind === "refused" || permission.kind === "invalid") {
    // A reset names no node of the library -- it is this module's own move --
    // so there is no catalog id to publish, only why it was not allowed.
    return answer(REPLAY_RESULT_CODES.resetFailed, "the reset was not permitted", false, { resultReason: permissionReason(permission), nodeId: undefined, assumed: undefined });
  }
  const result = await run.gateway.executeAction(run.sessionId, { actionType: RESET_ACTION, parameters: { url: location }, metadata: toolMetadata(run.request) });
  assertActive(run.request.signal);
  if (result.status === "succeeded") return answer(REPLAY_RESULT_CODES.replayed, "the page was put back", true);
  const failed = answer(REPLAY_RESULT_CODES.resetFailed, "the page could not be put back");
  // A reset that landed on a robot check is the person's to clear, exactly as
  // the step that first went there was (`./run.ts`). The replay code stays
  // Core's own; `personNeeded` says why, and proposes nothing.
  return webActionNeedsPerson(result) ? withPersonNeeded(failed, undefined) : failed;
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
  // Two different faults, and they were one answer until 2026-09-25: a step
  // naming a node this domain cannot run is a draft that should never have been
  // assembled, while a step whose parameters are not a record is a draft
  // statement written wrong. The node's id separates them for a reader, so the
  // one that has an id says it.
  if (!node) return answer(REPLAY_RESULT_CODES.failed, "the step names nothing this domain can run", false, { resultReason: "node_not_runnable_here", nodeId: undefined, assumed: undefined });
  if (!parameters) return answer(REPLAY_RESULT_CODES.failed, "the step carries no parameters to run with", false, { resultReason: undefined, nodeId: node.definitionId, assumed: undefined });
  const permission = await webActionPermission({
    check: run.request.permission,
    declared: value.consequences,
    control: { name: undefined, kind: "step" },
    verb: node.definition.label.toLowerCase(),
    // The node's own, so a replayed read is not gated on what the model wrote
    // about it -- the same rule the live run applies (`./run.ts`).
    effect: node.effect
  });
  if (permission.kind === "refused" || permission.kind === "invalid") {
    // Whether the declaration could not be read, whether the classes were not
    // permitted, or whether there was nobody to put the request to. All three
    // arrive as `core.replay.failed`, and they are three separate fixes.
    return answer(REPLAY_RESULT_CODES.failed, "the step was not permitted", false, {
      resultReason: permissionReason(permission),
      nodeId: node.definitionId,
      // Nothing had been resolved when this answered, so nothing was assumed.
      assumed: undefined
    });
  }
  // `gatedByCaller`, because the step was put to the gate a few lines above,
  // against this replay’s own declaration. Resolution would otherwise ask the
  // same question a second time and raise a second request for one act.
  const { resolution: resolved, assumed } = await resolveWebPlanNode(
    { projectId: run.request.projectId, flowId: run.request.flowId, nodeDefinitionId: node.definitionId, parameters, gatedByCaller: true },
    run.stores
  );
  // A parameter that cannot be made real is a Flow that cannot run, which is
  // exactly what the replay exists to catch before it is proposed.
  if (resolved.status === "refused") {
    // Which way the handle stopped naming one control, read from the resolver's
    // own codes by the same table the live run reads them with
    // (`../tool-rejection.ts`). A handle that was never in a packet, one whose
    // page has been left and one the page now gives to several elements are
    // three defects, and `core.replay.failed` is one word for all three.
    return await answerWithPage(run, REPLAY_RESULT_CODES.failed, "the step's parameters could not be resolved", false, {
      resultReason: webLlmHandleRejectionReason(resolved.issueCodes),
      nodeId: node.definitionId,
      // A refusal resolved no name, so it assumed none: `assumed` is what the
      // resolution answered with, and is absent whenever it refused.
      assumed
    });
  }
  const ran = resolved.status === "resolved" ? resolved.parameters : parameters;
  const result = await run.gateway.executeAction(run.sessionId, { actionType: node.actionType, parameters: ran, metadata: toolMetadata(run.request) });
  assertActive(run.request.signal);
  if (result.status !== "succeeded") {
    const refused = webActionFailureRefusal(result);
    const failure = refused.code;
    // The one failure a page-level reset explains. A control that is simply not
    // there, on a page the step itself worked on, is what a site that remembers
    // the step looks like -- a consent banner answered once stays answered --
    // and refusing the whole draft for it would push the model to delete the
    // dismissals that round 1 lost. Every other failure is a failure --
    // including a target that is now ambiguous, which the refusal word folds
    // into `target_not_found` (`../action-failure/refusal.ts`) but which is a
    // control that is there and cannot be told apart, not one that is gone. So
    // this reads the client's own code, not the merged word.
    const unreproducible = result.failure?.code === WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND;
    // The reason, where this domain has one for what the page answered
    // (`../action-failure/refusal.ts`), and nothing where it does not: a page
    // failure with no closed reason behind it must not be dressed up as one.
    // Until 2026-09-28 no reason was ever said here, and a replay that failed
    // because its read came back empty was recorded identically to one that
    // failed because the browser would not script the page. The node's id still
    // says which step of the draft it was.
    const answered = await answerWithPage(run, unreproducible ? REPLAY_RESULT_CODES.unreproducible : REPLAY_RESULT_CODES.failed, `the step did not run (${failure})`, true, {
      resultReason: refused.detail?.reason,
      nodeId: node.definitionId,
      assumed
    });
    // A replayed step that landed on a robot check did not fail on its own
    // account: a person has to clear the check. Still `core.replay.failed`,
    // which is Core's closed vocabulary, and marked so Core can ask rather than
    // judge the draft on it. A replay answer is Core's to read, not the model's,
    // so it carries no draft statement.
    return refused.personNeeded ? withPersonNeeded(answered, undefined) : answered;
  }
  const produced = isJsonRecord(value.produced) ? value.produced : undefined;
  const before = typeof produced?.records === "number" ? produced.records : undefined;
  const now = webNodeRecordCount(result.payload as JsonValue | undefined);
  // Read something, then read nothing: the step ran and the Flow would still
  // answer with an empty hand. Only the collapse is judged, because a list that
  // is shorter or in another order between two runs is the page, not the step.
  if (before !== undefined && before > 0 && now === 0) {
    return await answerWithPage(run, REPLAY_RESULT_CODES.changed, `the step read nothing where it read ${before}`, true, { resultReason: undefined, nodeId: node.definitionId, assumed });
  }
  // A step that replayed refuses nothing and tells nothing apart, so it says
  // neither of those; the answers above it are the ones a reader has to
  // separate. What its parameters assumed it does say, because that is as true
  // of a step that worked as of one that did not.
  return answer(REPLAY_RESULT_CODES.replayed, "the step ran again", true, { resultReason: undefined, nodeId: undefined, assumed });
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

/** Whether a recorded location is one this domain will navigate back to. */
function isHttpLocation(location: string): boolean {
  try {
    const url = new URL(location);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
