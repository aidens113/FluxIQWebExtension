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
//            soft check passed -- is not put back by this. The step that did
//            it finds its target gone from its own page and comes back
//            `remembered`, which passes; a target gone while the page is
//            somewhere else comes back `unreproducible` (`./missing-target.ts`).
//            Core also sends this to put the page back where one step found
//            it, when that step was looked for on another page first.
//
//   step  -- run one step again with the parameters the Flow keeps, which are
//            the resolved ones. The command that goes out is the command
//            `io/gateway-output-dispatcher.ts` sends, so what is being proved
//            is the Flow and not a rehearsal of it. Core sends back where the
//            step found the page (`from`), which is what tells `remembered`
//            from `unreproducible`.
//
//   verify -- check a step whose effect lasts, and run nothing that acts: a
//            dry run never repeats a lasting effect (`./verify.ts`).
//
// The reset never clears site data and never logs the person out (decision
// D1): a navigation is all it is, so what the site remembers stays remembered,
// which is why a step whose effect lasts is checked rather than run again.
//
// **The gate is asked on every replayed step, with the step's own
// declaration.** A replay is an act on a real page and is no more exempt from
// the person's permission than the original was; Core's check arrives on the request
// like any other call's, because the replay goes through the same executor
// (`AS/runtime/flow-bootstrap/action-permissions.ts`).
//
// **Nothing here shows the model a page it has not earned.** A replayed step
// that failed carries the page, because that is the page a correction has to be
// made from; one that worked carries a line saying so and nothing else -- a
// list read's line says what it read, in counts.

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
import { webNodeReplayMissingTarget } from "./missing-target";
import {
  WEB_NODE_REPLAY_RESULT_CODES as REPLAY_RESULT_CODES,
  webNodeReplayAnswer as answer,
  webNodeReplayAnswerWithPage as answerWithPage,
  webNodeReplayPermissionReason as permissionReason,
  webNodeReplayReadSaid as readSaid,
  type WebNodeReplayFacts
} from "./replay-answer";
import type { WebNodeRun } from "./context";
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
 *
 * For a list read, `produced` is the read's own account (`webNodeProduced`).
 */
export function webNodeReplayStatement(input: { location: string; payload: JsonValue | undefined; reads: boolean }): WebNodeReplayStatement {
  const produced = input.reads ? webNodeProduced(input.payload) : undefined;
  return present<WebNodeReplayStatement>({
    from: { location: input.location },
    produced: produced as JsonObject | undefined
  });
}

/**
 * What a step read, as the replay compares it: how many rows, and for a list
 * read how many items the list showed and whether its conditions were kept.
 */
type WebNodeProduced = {
  records: number;
  /** The items the list's selector matched before any condition: `0` is a list that was not there (`actions/extraction/summary.ts`). */
  itemsSeen?: number | undefined;
  /** Whether the read answered with rows its conditions rejected, because they kept none. Absent from a read with no conditions. */
  unfiltered?: boolean | undefined;
};

/**
 * What a step's payload says it read.
 *
 * **A list read is counted from its own account, never from the payload's
 * longest array.** A live `extract_list` payload always carries other lists --
 * `extraction.fieldNames`, `extraction.conditions.rejected`, and the snapshot's
 * `interactiveElements`, which is attached to every list read -- so the longest
 * one is at least the column count and usually the page's controls. t227's run
 * `run-muq310ht-ab80eed0` replayed a read on a "No results" page, `now` came
 * back as six, and the collapse to nothing was never seen; run 11's dry run
 * recorded 638 "records" for a read of 94 items (t194-d227). The account is
 * the page's own count (`recordCount`, `itemsSeen`, `conditions.unfiltered`).
 * Every other payload keeps the longest-list count it always had.
 */
function webNodeProduced(payload: JsonValue | undefined): WebNodeProduced | undefined {
  const account = extractionAccount(payload);
  if (account) return account;
  const records = webNodeRecordCount(payload);
  return records === undefined ? undefined : { records };
}

/** The list read's own account of what it read, or nothing when the payload carries none. */
function extractionAccount(payload: JsonValue | undefined): WebNodeProduced | undefined {
  const extraction = isJsonRecord(payload) && isJsonRecord(payload.extraction) ? payload.extraction : undefined;
  if (!extraction || !isCount(extraction.recordCount)) return undefined;
  const conditions = isJsonRecord(extraction.conditions) ? extraction.conditions : undefined;
  return present<WebNodeProduced>({
    records: extraction.recordCount,
    itemsSeen: isCount(extraction.itemsSeen) ? extraction.itemsSeen : undefined,
    unfiltered: typeof conditions?.unfiltered === "boolean" ? conditions.unfiltered : undefined
  });
}

/** `produced` as a step recorded it: each count absent from a statement written before it was recorded. */
type RecordedProduced = { records: number | undefined; itemsSeen: number | undefined; unfiltered: boolean | undefined };

/** `produced` as the step recorded it, read back off the replay call. */
function recordedProduced(value: JsonValue | undefined): RecordedProduced {
  if (!isJsonRecord(value)) return { records: undefined, itemsSeen: undefined, unfiltered: undefined };
  return {
    records: typeof value.records === "number" ? value.records : undefined,
    itemsSeen: typeof value.itemsSeen === "number" ? value.itemsSeen : undefined,
    unfiltered: typeof value.unfiltered === "boolean" ? value.unfiltered : undefined
  };
}

/**
 * How a replayed read differs from the step's own run, in the one way that is
 * the step and not the page, or nothing.
 *
 * Read something, then read nothing: the step ran and the Flow would still
 * answer with an empty hand. A list that was there and now is not
 * (`itemsSeen` to 0) is the same defect seen one step earlier, and holds even
 * where the build's conditions kept no row. A read whose conditions kept rows
 * and now kept none, so it answered with the rows they rejected
 * (`unfiltered`), is a read whose answer is no longer the one the build
 * proposed: run 11's duplicate read passed its dry run returning eleven rows
 * every condition had turned down (`run-muq4oaof-464f5bce`). A list that is
 * shorter or in another order between two runs is the page, not the step, and
 * is not judged.
 */
function readChange(before: RecordedProduced, now: WebNodeProduced | undefined): string | undefined {
  if (now === undefined) return undefined;
  if (before.records !== undefined && before.records > 0 && now.records === 0) return `the step read nothing where it read ${before.records}`;
  if (before.itemsSeen !== undefined && before.itemsSeen > 0 && now.itemsSeen === 0) return `the step found no list where it found ${before.itemsSeen} items`;
  if (before.unfiltered === false && before.records !== undefined && before.records > 0 && now.unfiltered === true) return "the step's conditions kept no row, so it answered with rows they rejected, where they kept rows before";
  return undefined;
}

/** A non-negative whole number, as every count in a read's account is. */
function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
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
    // The reason, where this domain has one for what the page answered
    // (`../action-failure/refusal.ts`), and nothing where it does not: a page
    // failure with no closed reason behind it must not be dressed up as one.
    // Until 2026-09-28 no reason was ever said here, and a replay that failed
    // because its read came back empty was recorded identically to one that
    // failed because the browser would not script the page. The node's id still
    // says which step of the draft it was.
    const about: WebNodeReplayFacts = { resultReason: refused.detail?.reason, nodeId: node.definitionId, assumed };
    // The one failure a page-level reset explains. A control that is simply not
    // there, on the very page the step worked on, is what a site that remembers
    // the step looks like -- a consent banner answered once stays answered --
    // and it answers `remembered`, which keeps the step: the Flow's playback
    // runs on a site that has not seen it (t195-w20b). Not there anywhere else
    // is `unreproducible` (`./missing-target.ts`). Every other failure is a
    // failure -- including a target that is now ambiguous, which the refusal
    // word folds into `target_not_found` (`../action-failure/refusal.ts`) but
    // which is a control that is there and cannot be told apart, not one that
    // is gone. So this reads the client's own code, not the merged word.
    const answered = result.failure?.code === WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND
      ? await webNodeReplayMissingTarget(run, "step", about, failure)
      : await answerWithPage(run, REPLAY_RESULT_CODES.failed, `the step did not run (${failure})`, true, about);
    // A replayed step that landed on a robot check did not fail on its own
    // account: a person has to clear the check. Still `core.replay.failed`,
    // which is Core's closed vocabulary, and marked so Core can ask rather than
    // judge the draft on it. A replay answer is Core's to read, not the model's,
    // so it carries no draft statement.
    return refused.personNeeded ? withPersonNeeded(answered, undefined) : answered;
  }
  // What the step read then and what it reads now, each counted the same way:
  // from a list read's own account, and otherwise the longest list
  // (`webNodeProduced`). What counts as a change is `readChange`.
  const payload = result.payload as JsonValue | undefined;
  const changed = readChange(recordedProduced(value.produced), webNodeProduced(payload));
  if (changed !== undefined) {
    return await answerWithPage(run, REPLAY_RESULT_CODES.changed, changed, true, { resultReason: undefined, nodeId: node.definitionId, assumed });
  }
  // A step that replayed refuses nothing and tells nothing apart, so it says
  // neither of those; the answers above it are the ones a reader has to
  // separate. What its parameters assumed it does say, because that is as true
  // of a step that worked as of one that did not. A list read says what it
  // read, because its line is all the judge of a build's test sees of it
  // (`./replay-answer.ts`); every other step says only that it ran.
  const said = readSaid(payload, isJsonRecord(parameters.extractList) ? parameters.extractList.where : undefined) ?? "the step ran again";
  return answer(REPLAY_RESULT_CODES.replayed, said, true, { resultReason: undefined, nodeId: undefined, assumed });
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
