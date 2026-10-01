// Taking one sanitized look at the whole page, and acting on it first when the
// look needs an action to be worth taking.
//
// Every evidence tool in this repository ends up here: the authoring tools that
// help build a Flow, and the runtime harness options that explore a failure.
// They differ in what they are allowed to do and in who may offer them, and not
// at all in how a page becomes a packet -- so the capture lives in one module
// rather than once per caller. A second copy is how the two would come to
// sanitize differently, or mark a failed target in one and not the other,
// without anybody deciding that they should.
//
// No look is sized to a budget (t200). A call used to carry Core's
// `maxEvidenceBytes`, and every packet, refusal and read was trimmed to fit it;
// the packet is now the whole page whatever the call, and Core no longer sends
// the number.

import type { AutomationStudioActionPermissionCheck } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import type { WebAutomationClearedCheckWait } from "../../actions/cleared-check-wait";
import { webActionFailureRefusal, webActionNeedsPerson, type WebActionRefusal, type WebFailedActionResult } from "./action-failure";
import type { WebLlmNameAssumption } from "./name-assumption";
import { present } from "./present";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSanitizeOptions, type WebLlmSnapshotBinding } from "./sanitize";
import { webLlmSnapshotStates } from "./state-digest";
import {
  recoverable,
  RecoverableToolRejection,
  WEB_LLM_TOOL_REJECTION_REASONS,
  WEB_LLM_TOOL_RESULT_SCHEMA_VERSION,
  type WebLlmToolRejectionReason
} from "./tool-rejection";
import { jsonRecord } from "./untrusted-json";

type ClientActionResult = WebFailedActionResult & {
  payload?: JsonObject;
  error?: string;
};

export type WebLlmEvidenceGateway = {
  eligibleSessionIds(): string[];
  /**
   * The eligible sessions whose client declares repeating-structure detection
   * (`WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID`). Absent, no session
   * does, and the detection tool refuses to run: a client that ignored the flag
   * would answer with a bare snapshot, which is not an answer.
   */
  structureDetectionSessionIds?(): string[];
  executeAction(sessionId: string, command: { actionType: string; parameters: JsonObject; metadata: JsonObject }): Promise<ClientActionResult>;
};

export type WebLlmEvidenceToolExecution = {
  kind: "llm_evidence_tool_execution";
  evidence: JsonValue;
  effectApplied: boolean;
  targetsUnchanged?: boolean;
  resultCode?: string;
  /**
   * Which refusal this was, in this domain's own closed vocabulary
   * (`./tool-rejection.ts`).
   *
   * The code alone is one word for several different defects, and Core traces
   * the code. Measured on `run-mug776kx-0214b287`, 2026-09-25: 38 provider
   * calls produced 14 identical `web.action.rejected.invalid_input` rows and 8
   * identical `web.action.rejected.target_unobserved` rows, and nothing else --
   * so three or four separate faults with three or four separate fixes were
   * indistinguishable to anyone reading the run afterwards. The reason that
   * tells them apart was already computed for the model's own evidence and
   * thrown away on the way out; this is that same value, said once more where a
   * reader of the run can see it.
   *
   * It is one of `WEB_LLM_TOOL_REJECTION_REASONS` and never a sentence, for the
   * same reason the detail is: a refusal must not become a side channel for the
   * page content it refused. A successful call has no reason and carries none.
   */
  resultReason?: WebLlmToolRejectionReason;
  /** Domain-screened structural facts about a refusal, transported opaquely by Core. */
  diagnostic?: JsonObject;
  /**
   * How many times in a row this call has now given the same refusal, when it
   * is two or more (`./repeated-refusal.ts`).
   *
   * Core's stall guard reads this as a count and never reads `resultReason`: a
   * repeat that only changes its own count is otherwise indistinguishable, by
   * bytes, from a new answer, so the caller has to say so.
   */
  repeatedAnswer?: number;
  /**
   * The call met a robot check -- the client answered
   * `USER_INTERVENTION_REQUIRED` -- and did not act on it
   * (`AS/runtime/llm/evidence-loop/tool-execution.ts`).
   *
   * Core never shows such a result to the model: it asks the person to clear
   * the check and press Continue, and on Continue the call stands with `draft`
   * as written here, so `draft` describes the step as it stands once the check
   * is cleared (`withPersonNeeded`, `./node-run/run.ts`). `resultCode` and
   * `resultReason` stay what the refusal was, for the run's own record.
   */
  personNeeded?: true;
  /**
   * The catalog id of the node the call named, when this domain resolved one
   * (`./node-run/catalog.ts`).
   *
   * Only a resolved id. Where the call named a node this domain cannot run, the
   * reason `node_not_runnable_here` says so on its own and the model's invented
   * string stays out of the trace -- a name nobody minted is not an identifier,
   * and publishing it would make the run's own record quote the model.
   */
  nodeId?: string;
  /**
   * Every name this call resolved to something other than what was written,
   * with what it was read as, how, and with what score
   * (`./name-assumption.ts`).
   *
   * The standing rule is that a name spelled slightly wrong resolves to its
   * closest match rather than being refused, and that **a near match is an
   * assumption recorded where a run's evidence is kept**. Two paths make that
   * guess -- a literal request's field keys
   * (`actions/extraction/field-match.ts`) and a detection's columns
   * (`plan-resolution/extraction/column-match.ts`) -- and until this field
   * existed both computed the whole assumption and
   * `plan-resolution/resolve-plan-node.ts` dropped it, so a Flow built on a
   * guessed column produced a record that could not say a guess was made.
   *
   * Absent, not empty, for a call that assumed nothing: the two are different
   * facts. Screened before it leaves, so nothing a page said can ride out on
   * it; a call with nothing publishable carries the field absent as well, which
   * `./name-assumption.ts` states the one case of.
   *
   * **Withheld from the wire until Core's reader learns the key**, by
   * `readable` against `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS` -- which is
   * where the whole of that constraint is written down. Declared here rather
   * than added later because the shape is decided and every producer must
   * mention it (`./present.ts`); the hop that publishes it is Core's, and this
   * domain's half of it is done.
   */
  assumed?: WebLlmNameAssumption[];
  /**
   * The state the call found and the state it left, as `captureStateDigest`
   * would have digested them, taken from the captures the call itself made
   * (`withCallStates`, `./state-digest/snapshot-states.ts`).
   *
   * Core used to ask for these around every call, and each answer was a page
   * capture of its own: three for a look, four and the action for an action.
   * Reporting them here, with `stateDigestsOnCalls` on the binding, is what
   * stops Core asking (`AS/runtime/llm/evidence-loop/tool-execution.ts`). A
   * side the call took no capture for -- no page yet, an input refused before
   * anything was read, a page unreadable after acting -- is absent, and Core
   * reads that side as unobserved.
   */
  stateDigests?: { before?: string; after?: string };
  /**
   * The route state of the page the call left, exactly as the host's
   * `observeRouteState` would read it from the same page (`../host-runtime.ts`,
   * `../route-state/project.ts`), taken from the capture the call itself made
   * (`withCallStates`, `./state-digest/snapshot-states.ts`).
   *
   * Core's build routing records the route state each exploration step left,
   * and asked `observeRouteState` for it -- a whole page capture -- at build
   * start and before most decisions
   * (`AS/runtime/route-state.ts`). Reporting it here lets Core capture only
   * where no call left one. Always the page the call *left*: an action's read
   * before acting is never it. A call that left no page it read -- refused
   * before anything was read, a page unreadable after acting, a detection in a
   * frame -- carries the key absent.
   */
  routeState?: JsonObject;
  /**
   * The node's command landed on a robot check that cleared by itself,
   * untouched, after `waitedMs`: the client's `checkWait`, copied
   * (`actions/cleared-check-wait.ts`, `./node-run/cleared-wait.ts`). Core reads
   * it to close the run's robot-check card as cleared on its own. Absent when
   * no check stood, and on every refusal: a check that needed a person is
   * `personNeeded`.
   */
  clearedWait?: WebAutomationClearedCheckWait;
  /**
   * What this one call did, for the draft Core is accruing.
   *
   * One tool runs whichever node of the library the call names, so the name to
   * record the step under, whether it looked or changed, and whether the Flow
   * should contain it are properties of the call rather than of the tool. Core
   * carries all of it opaquely (`AS/runtime/flow-draft/`).
   */
  draft?: {
    actionId?: string;
    input?: JsonObject;
    ranWith?: JsonObject;
    effect?: "observe" | "mutate";
    proposes?: boolean;
    /**
     * What running this call again would need: where it found the target, and
     * how much it read (`./node-run/replay.ts`). Saying it is what puts the
     * step under Core's dry run -- the draft is run again from the start before
     * it may be proposed -- and a step that says nothing is simply not replayed.
     */
    replay?: { from?: JsonObject; produced?: JsonObject };
  };
};

export type WebLlmEvidenceToolRequest = {
  projectId: string;
  flowId: string;
  callId: string;
  toolId: string;
  value: JsonObject;
  signal?: AbortSignal;
  /**
   * Where the Flow this build is writing starts, when the build was told
   * (`AS/runtime/flow-bootstrap/start-location.ts`). Core carries the value
   * from whoever asked for the build and never reads it; for this domain it is
   * a URL.
   *
   * Its presence says something about the world as well as about the request:
   * nothing was opened for this build, so there is no page until the Flow has
   * gone there. `node-run/start-location.ts` is where that has consequences --
   * the only call that works from nowhere is the one that goes there, and
   * because the Flow is assembled from the steps that ran, that call is then
   * the Flow's own first step.
   */
  startLocation?: string;
  /**
   * Core's check for an action with a lasting consequence, passed with every
   * tool call and harness option (`AS/runtime/action-permissions/`). Absent,
   * any declared consequence is refused rather than taken.
   */
  permission?: AutomationStudioActionPermissionCheck;
};

/** Exactly one connected web client, or nothing: two would make "the page" ambiguous. */
export function selectSession(sessionIds: string[]): string {
  const unique = [...new Set(sessionIds)];
  if (unique.length !== 1) throw new Error("exactly one connected web-automation client is required for LLM evidence");
  return unique[0]!;
}

export function toolMetadata(input: WebLlmEvidenceToolRequest): JsonObject {
  return { source: "llm-evidence-runtime", projectId: input.projectId, flowId: input.flowId, callId: input.callId, domainId: WEB_AUTOMATION_DOMAIN_ID };
}

/**
 * What a call says about itself beyond its code: why it refused, which node of
 * the library it named, and which of the names it was given it had to assume.
 *
 * Deliberately not exported. A caller writes an object literal, which is
 * excess-checked against this type at the call site, and the packet's own
 * producer stays the one place the fields are named.
 *
 * **Every member is mandatory and may be `undefined`**, which is the same
 * pairing `./present.ts` uses and for the same reason: a caller that omits a
 * key loses nothing it can see, so a field added here would be written by
 * whichever call site happened to be edited and silently absent from the rest.
 * Mandatory-with-`undefined` makes the omission a compile error and leaves the
 * field optional on the wire. A caller with none of these facts passes no
 * `said` at all.
 */
type WebLlmEvidenceToolCallFacts = {
  resultReason: WebLlmToolRejectionReason | undefined;
  nodeId: string | undefined;
  assumed: WebLlmNameAssumption[] | undefined;
};

/**
 * Every key Core accepts on an execution result, and all of them.
 *
 * Core reads the result against an **allow-list** --
 * `automationStudioLlmEvidenceParseToolExecutionResult`
 * (`AS/runtime/llm/evidence-loop-decision.ts`), `exactKeys(value, [...])` --
 * and its own comment says what one key too many costs: *"a member a caller
 * learns to report and this check has not learned is not an execution result
 * arriving with a field too many -- it is the whole result refused as
 * `llm_evidence_loop.tool_result_invalid`, and the call is recorded as a failure
 * that never happened."* Not the field dropped: **the call**.
 *
 * So the list is restated here, on the producing side, and `toolExecution`
 * withholds anything this domain has learned to report that Core has not yet
 * learned to read. A producer that cannot see its reader's list emits into the
 * dark, and the cost of guessing wrong is every node run of every live build
 * recorded as a failure.
 *
 * Widening it is one entry here **after** Core's list has learned the same key,
 * never before. `tests/name-assumption.test.ts` holds the two together.
 */
export const WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS: readonly string[] = [
  "kind", "evidence", "effectApplied", "targetsUnchanged", "resultCode", "resultReason", "diagnostic", "repeatedAnswer", "personNeeded", "nodeId", "stateDigests", "routeState", "clearedWait", "draft"
];

export function toolExecution(
  evidence: JsonValue,
  effectApplied: boolean,
  resultCode: string,
  targetsUnchanged?: boolean,
  draft?: WebLlmEvidenceToolExecution["draft"],
  said?: WebLlmEvidenceToolCallFacts
): WebLlmEvidenceToolExecution {
  return readable(present<WebLlmEvidenceToolExecution>({
    kind: "llm_evidence_tool_execution",
    evidence,
    effectApplied,
    targetsUnchanged,
    resultCode,
    // Said by the caller where it holds the reason, and otherwise read back out
    // of the refusal this call is already returning (`refusedReason`).
    resultReason: said?.resultReason ?? refusedReason(evidence),
    // Written by a refused node from the pre-call packet, after screening.
    diagnostic: undefined,
    // Written afterwards, by `./repeated-refusal.ts`, onto the one call that
    // repeats; never known when the call is first built.
    repeatedAnswer: undefined,
    // Written afterwards, by `withPersonNeeded`, onto a call that met a robot check.
    personNeeded: undefined,
    nodeId: said?.nodeId,
    assumed: said?.assumed,
    // Written afterwards, by `withCallStates`, from the captures the call made.
    stateDigests: undefined,
    routeState: undefined,
    // Written afterwards, by `withClearedWait` (`./node-run/cleared-wait.ts`),
    // onto a node run whose command waited out a check that cleared by itself.
    clearedWait: undefined,
    draft
  }));
}

/**
 * The result, with the state the call found and the state it left, each
 * digested from a capture the call itself took (`WebLlmSnapshotBinding`
 * `stateDigest`). Written onto the result just built, as
 * `./repeated-refusal.ts` writes its count, rather than rebuilt around it.
 *
 * `found` is the page as the call found it -- a look's one capture, an
 * action's read before acting -- and `left` the page as the call left it. A
 * side with no capture, or whose capture was too large to digest, is left
 * unsaid; with neither, the key is absent.
 *
 * The route state is of `left` alone, because it is what Core's routing
 * records as the state a step left; with no `left`, or one too large to read,
 * `routeState` is absent.
 */
export function withCallStates(
  execution: WebLlmEvidenceToolExecution,
  found: WebLlmSnapshotBinding | undefined,
  left: WebLlmSnapshotBinding | undefined
): WebLlmEvidenceToolExecution {
  const digests = present<NonNullable<WebLlmEvidenceToolExecution["stateDigests"]>>({ before: found?.stateDigest, after: left?.stateDigest });
  if (digests.before !== undefined || digests.after !== undefined) execution.stateDigests = digests;
  if (left?.routeState !== undefined) execution.routeState = left.routeState;
  return execution;
}

/**
 * The result, marked as needing a person, with the draft statement the call
 * stands on once the person has cleared the check.
 *
 * Written onto the result just built, like `withCallStates`, so the refusal's
 * own code, reason and states are kept exactly as an ordinary refusal would
 * carry them; only the draft is replaced, because Core reads it as the step
 * that stands after Continue (`AS/runtime/llm/evidence-loop/tool-execution.ts`).
 */
export function withPersonNeeded(
  execution: WebLlmEvidenceToolExecution,
  draft: WebLlmEvidenceToolExecution["draft"]
): WebLlmEvidenceToolExecution {
  execution.personNeeded = true;
  if (draft === undefined) delete execution.draft;
  else execution.draft = draft;
  return execution;
}

/**
 * The result with any member Core's reader has not learned removed, and the one
 * place this domain withholds a fact it has computed.
 *
 * Today that is exactly `assumed`: the whole chain that produces it is built and
 * tested (`./name-assumption.ts`, `plan-resolution/resolve-plan-node.ts`,
 * `node-run/run.ts`), and it stops here because Core's allow-list would refuse
 * the call rather than the field
 * (`WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`). Removing something from a wire
 * value is otherwise exactly the defect `./present.ts` exists to prevent, so it
 * happens once, by name, against a list that says why -- never by a projection
 * that copies the members it happens to know.
 */
function readable(result: WebLlmEvidenceToolExecution): WebLlmEvidenceToolExecution {
  const readableResult: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result)) {
    if (WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS.includes(key)) readableResult[key] = value;
  }
  return readableResult as unknown as WebLlmEvidenceToolExecution;
}

/**
 * The reason inside a refusal a caller is already handing back.
 *
 * Every refusal site in this package answers with a `WebLlmToolRejection`, and
 * the reason is in it; lifting it here is what makes a site that gains a reason
 * later carry it into the trace with no edit at all -- including the one site
 * that raises a refusal outside this directory's own files (`../tools.ts`
 * catches what `./structure/detect.ts` throws). Nothing is derived and nothing
 * is invented: a value that is not one of this domain's closed reasons is
 * dropped rather than published, so a packet that ever carried something else
 * could not put it on a decision row.
 *
 * A success is not a refusal and never matches: a page packet and a structure
 * packet each carry their own `schemaVersion`, neither of which is this one.
 */
function refusedReason(evidence: JsonValue): WebLlmToolRejectionReason | undefined {
  if (evidence === null || typeof evidence !== "object" || Array.isArray(evidence)) return undefined;
  const packet = evidence as JsonObject;
  if (packet.schemaVersion !== WEB_LLM_TOOL_RESULT_SCHEMA_VERSION || packet.ok !== false) return undefined;
  const detail = packet.detail;
  if (detail === null || typeof detail !== "object" || Array.isArray(detail)) return undefined;
  const reason = (detail as JsonObject).reason;
  return typeof reason === "string" && (WEB_LLM_TOOL_REJECTION_REASONS as readonly string[]).includes(reason)
    ? (reason as WebLlmToolRejectionReason)
    : undefined;
}

/** Cancellation is fatal, never a recoverable rejection: nothing is left to tell the model. */
export function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new Error("web evidence operation was cancelled");
}

/** One capture of the whole page, sanitized, with its selectors kept behind. */
export async function captureEvidence(
  gateway: WebLlmEvidenceGateway,
  sessionId: string,
  request: WebLlmEvidenceToolRequest,
  signal?: AbortSignal,
  expectedOrigin?: string
): Promise<WebLlmSnapshotBinding> {
  const result = await gateway.executeAction(sessionId, {
    actionType: "web.dom.capture_snapshot",
    parameters: {},
    metadata: toolMetadata(request),
  });
  assertActive(signal);
  // A look that met a robot check is the person's, not the model's: it is not
  // "unreadable", and a model told so would look again and again at the check.
  // Checks that clear themselves were already waited out by the client.
  if (result.status !== "succeeded" && webActionNeedsPerson(result)) throw new RecoverableToolRejection("needs_person", undefined, undefined, true);
  // A page that cannot be read now -- still loading, mid-navigation -- is a
  // condition the model can wait out or work around, not a fault.
  if (result.status !== "succeeded") recoverable("page_unreadable");
  const payload = jsonRecord(result.payload, "web evidence action payload");
  const sanitized = sanitizeWebLlmSnapshotWithBindings(payload.snapshot, present<WebLlmSanitizeOptions>({
    expectedOrigin,
    // An exploration packet is an observation, not a failure, so it marks no
    // target at all -- neither a handle nor a "the target is gone".
    failedAction: undefined,
  }));
  // Digested and projected now, before any caller writes on the packet, so a
  // call's own capture answers for the state it saw
  // (`./state-digest/snapshot-states.ts`).
  const states = webLlmSnapshotStates(sanitized);
  return present<WebLlmSnapshotBinding>({
    evidence: sanitized.evidence,
    selectors: sanitized.selectors,
    records: sanitized.records,
    shadowHosts: sanitized.shadowHosts,
    stateDigest: states.stateDigest,
    routeState: states.routeState,
    pageQuery: sanitized.pageQuery
  });
}

/**
 * How long, and how often, the page an action left is asked for again while it
 * cannot be read.
 *
 * The window is measured from the first look after the action, and a look is
 * only started inside it: one already sent runs to its own end, which in the
 * extension includes the tab's readiness wait (`apps/extension/src/runtime/
 * automation-tab.ts`, `waitForTabReady`). So in practice the second look is
 * already the new document, and the window only bounds a page that never
 * becomes readable.
 */
export type WebLlmAfterActionTiming = {
  windowMs: number;
  retryMs: number;
  now: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
};

const AFTER_ACTION_TIMING: WebLlmAfterActionTiming = { windowMs: 5_000, retryMs: 250, now: () => Date.now(), sleep: pause };

/**
 * The page an action left, once there is one to read: `undefined` when none
 * could be read inside the window.
 *
 * An action can start a navigation of the page it acted on -- a "Set as my
 * store" button that saves and then reloads, a form that submits, a link. The
 * old document is then torn down under the look that follows, and that look
 * comes back `page_unreadable`: the channel to the old document closed, or the
 * new one had nothing listening yet (the bigbox store switch of
 * `run-muncqlr0-3348202b` does exactly this). That is not the action failing --
 * it already succeeded, and acting again would act twice -- and not the page
 * being unreadable either: it is the page being *between* documents. So the
 * look is taken again until the new document answers, bounded by the window,
 * and cancellation ends the wait at once.
 *
 * Only `page_unreadable` is waited out. Every other refusal a look can raise
 * is about the page that did answer, and is raised as it was.
 */
export async function captureAfterAction(
  gateway: WebLlmEvidenceGateway,
  sessionId: string,
  request: WebLlmEvidenceToolRequest,
  signal?: AbortSignal,
  expectedOrigin?: string,
  timing: WebLlmAfterActionTiming = AFTER_ACTION_TIMING
): Promise<WebLlmSnapshotBinding | undefined> {
  const startedAt = timing.now();
  for (;;) {
    const page = await readablePage(gateway, sessionId, request, signal, expectedOrigin);
    if (page !== undefined) return page;
    if (timing.now() - startedAt + timing.retryMs >= timing.windowMs) return undefined;
    await timing.sleep(timing.retryMs, signal);
    assertActive(signal);
  }
}

/** One look, or `undefined` when the page could not be read at all. */
async function readablePage(
  gateway: WebLlmEvidenceGateway,
  sessionId: string,
  request: WebLlmEvidenceToolRequest,
  signal: AbortSignal | undefined,
  expectedOrigin: string | undefined
): Promise<WebLlmSnapshotBinding | undefined> {
  try {
    return await captureEvidence(gateway, sessionId, request, signal, expectedOrigin);
  } catch (error) {
    if (error instanceof RecoverableToolRejection && error.code === "page_unreadable") return undefined;
    throw error;
  }
}

/** A wait that cancellation ends at once, with the cancellation's own reason. */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("web evidence operation was cancelled"));
      return;
    }
    const cancel = (): void => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("web evidence operation was cancelled"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal?.addEventListener("abort", cancel, { once: true });
  });
}

/**
 * Do one thing to the page, then look again from where it left us.
 *
 * The recapture asserts where it landed. By default that is the origin the
 * action started from, which is what an interaction must never leave; a caller
 * that is deliberately moving -- a scoped navigation whose policy allowed
 * another place -- passes the destination instead, so the assertion still holds
 * and still means something rather than being waived.
 *
 * The recapture waits out a page that is between documents
 * (`captureAfterAction`), because a press that reloads the page is a press
 * that worked. A page still unreadable once the window has passed is refused
 * `page_unreadable`, as it always was: this path returns a page or refuses.
 */
export async function actAndCapture(
  gateway: WebLlmEvidenceGateway,
  sessionId: string,
  request: WebLlmEvidenceToolRequest,
  actionType: string,
  parameters: JsonObject,
  current: WebLlmSnapshotBinding,
  signal?: AbortSignal,
  expectedOrigin?: string
): Promise<WebLlmSnapshotBinding> {
  const result = await gateway.executeAction(sessionId, { actionType, parameters, metadata: toolMetadata(request) });
  assertActive(signal);
  if (result.status !== "succeeded") throw await pageRefusal(gateway, sessionId, request, current, webActionFailureRefusal(result), signal);
  const after = await captureAfterAction(gateway, sessionId, request, signal, expectedOrigin ?? new URL(current.evidence.location).origin);
  return after ?? recoverable("page_unreadable");
}

/**
 * The refusal for an action the page did not let happen, carrying the page as
 * it now stands: whatever got in the way -- a dialog, a banner -- is on it,
 * with a handle the model can press. Captured on the origin the action started
 * from, whole; a page that cannot be captured leaves the refusal without one.
 * Cancellation still ends the call.
 *
 * It takes the whole refusal rather than its code, and that is the point of the
 * signature. Until 2026-09-28 it took a code and wrote `detail: undefined`
 * beside it, three times over, so every reason this domain computed about a
 * failed action was dropped one line after being decided
 * (`./action-failure/read-shortfall.ts` has what that cost). A parameter that
 * carries both is one a caller cannot half-use.
 */
export async function pageRefusal(
  gateway: WebLlmEvidenceGateway,
  sessionId: string,
  request: WebLlmEvidenceToolRequest,
  current: WebLlmSnapshotBinding,
  refusal: WebActionRefusal,
  signal?: AbortSignal
): Promise<RecoverableToolRejection> {
  try {
    const page = await captureEvidence(gateway, sessionId, request, signal, new URL(current.evidence.location).origin);
    return new RecoverableToolRejection(refusal.code, refusal.detail, page, refusal.personNeeded);
  } catch (error) {
    if (signal?.aborted) throw error;
    return new RecoverableToolRejection(refusal.code, refusal.detail, undefined, refusal.personNeeded);
  }
}
