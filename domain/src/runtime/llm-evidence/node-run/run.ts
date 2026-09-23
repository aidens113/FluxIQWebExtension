// Running one node of the library against the live page, now.
//
// This is the whole of what replaced five invented exploration verbs. The model
// names a node of the catalog and gives that node's own parameters; the
// parameters go through the same resolver the finished Flow's parameters go
// through (`../plan-resolution/`), the command goes out through the same
// gateway the finished Flow dispatches through
// (`io/gateway-output-dispatcher.ts` sends exactly this shape), and what comes
// back is the node's own outcome. A node that worked is then a step of the
// Flow, with the parameters it worked with, because nothing else was ever
// written down.
//
// **Nothing is refused on FluxIQ's own judgement of a control.** The model says
// what its call would lastingly do, Core's gate answers from the person's
// instruction and grant, and a refusal carries the request the person will
// answer (`../permission.ts`). The one thing this module decides for itself is
// that exploration stays on the origin it started on, which is the scope policy
// the authoring navigation has always had.
//
// **A build may begin nowhere.** When Core says where the Flow starts
// (`AS/runtime/flow-bootstrap/start-location.ts`), nothing was opened for this
// build: the capture every call makes first comes back refused, and the only
// call that gets past that is the move that goes there. `./start-location.ts`
// holds the whole of that rule and why it is a rule at all.
//
// **A failure is a result, never an exception.** Every refusal this module can
// produce comes back as the call's result, carrying the page as it now stands
// so whatever got in the way has a handle the model can act on next, and
// carrying the record of the step under the node's own name with
// `proposes: false` so a step that did not work cannot reach the Flow.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webActionFailureRejectionCode } from "../action-failure";
import {
  assertActive,
  captureEvidence,
  pageRefusal,
  toolExecution,
  toolMetadata,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution,
  type WebLlmEvidenceToolRequest
} from "../capture";
import { evidenceByteLimit, WEB_LLM_EVIDENCE_BYTE_BUDGETS, serializedBytes } from "../limits";
import { present } from "../present";
import { webActionPermission } from "../permission";
import { resolveWebPlanNodeParameters, type WebPlanHandleStores } from "../plan-resolution";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "../sanitize";
import { WEB_LLM_TARGET_HANDLE_PATTERN } from "../stable-handles";
import { withoutWebLlmDeniedKeys } from "../denied-keys";
import { WEB_LLM_EXTRACTION_HANDLE_PATTERN } from "../structure";
import { RecoverableToolRejection, rejectionDetail, toolRejection, type WebLlmToolRejectionCode } from "../tool-rejection";
import { isJsonRecord } from "../untrusted-json";
import { webLlmToolRejectionResultCode, WEB_LLM_ACTION_RESULT_CODE, WEB_LLM_INSPECT_RESULT_CODE, WEB_LLM_RUN_NODE_TOOL_ID } from "../vocabulary";
import { webRunnableNode, webRunnableNodeIds, WEB_LLM_OBSERVATION_NODE_ACTION, type WebRunnableNode } from "./catalog";
import { webNodeReadResult } from "./read-result";
import { webMovesThePage, webScopeAnchor, webStartLocationRefusal, WEB_NAVIGATION_ACTION } from "./start-location";
import { replayWebOutputNode, webNodeReplayCall, webNodeReplayStatement, type WebNodeReplayStatement } from "./replay";

const TARGET_HANDLE = new RegExp(WEB_LLM_TARGET_HANDLE_PATTERN, "u");
const EXTRACTION_HANDLE = new RegExp(WEB_LLM_EXTRACTION_HANDLE_PATTERN, "u");
/**
 * The slots a handle may be written in, the one it is kept in, and the shape a
 * refusal names.
 *
 * It is kept in `target` rather than `selector` for a reason that is not
 * cosmetic: `selector` is a key this domain *denies*, so a call written with
 * one cannot be shown back to the model in the draft without Core refusing the
 * whole request. `target` is the slot the Flow script's own examples use, the
 * resolver reads a handle in either, and a resolved `target` handle writes the
 * selector and the element identity anyway.
 */
const ELEMENT_SLOTS = ["selector", "target", "element"];
const KEPT_ELEMENT_SLOT = "target";
const EXTRACTION_SLOT = "extractList";
const HANDLE_SHAPE = ['target: {"handle": "target.N"}', 'extractList: {"handle": "extraction.N"}'];
/** The keys the library verb takes, and all it takes (`Core runtime/llm/node-tools/`). */
const CALL_KEYS = ["node", "parameters", "consequences"];
/** Room kept for what a look says about itself, beside the packet it returns. */
const LOOK_ENVELOPE_BYTES = 128;

/**
 * What a node call says about itself, beside the page it left behind.
 *
 * Written by name rather than spread, because a field that quietly stops
 * arriving here costs nothing that shows: the model simply reasons with less
 * (`../present.ts`).
 */
export type WebNodeOutcome = {
  ok: true;
  /** The node that ran, as the catalog names it. */
  node: string;
  /** The command's own status, as the page reported it. */
  status: string;
  /** Whether the page looked different afterwards. Absent where it was not compared. */
  pageChanged?: boolean;
  /** The control it acted on, in the words the model was shown. */
  control?: string;
  /** What a reading node read, bounded (`./read-result.ts`). */
  read?: JsonValue;
  /** Whether a successful run of this node is a step of the Flow. */
  inFlow: boolean;
};

/** What the call reports to the draft Core is accruing (`AS/runtime/flow-draft/`). */
export type WebNodeDraftStatement = NonNullable<WebLlmEvidenceToolExecution["draft"]>;

export type WebNodeRun = {
  gateway: WebLlmEvidenceGateway;
  sessionId: string;
  request: WebLlmEvidenceToolRequest;
  stores: WebPlanHandleStores;
  /** Renumber a capture's handles so they keep naming what they named. */
  restamp: (binding: WebLlmSnapshotBinding) => WebLlmSnapshotBinding;
  /** Remember a packet the model has now been shown. */
  shown: (binding: WebLlmSnapshotBinding) => void;
};

/** Run the node a call named, and answer with what it did. */
export async function runWebOutputNode(run: WebNodeRun): Promise<WebLlmEvidenceToolExecution> {
  const value = run.request.value;
  // A call Core made rather than the model: the draft being run again before it
  // may be proposed (`./replay.ts`). It goes to the same executor so it passes
  // the same permission gate, and it is answered in Core's closed replay
  // vocabulary rather than this domain's, because Core reads the answer.
  const replaying = webNodeReplayCall(value);
  if (replaying) return await replayWebOutputNode(run, replaying);
  const node = webRunnableNode(value.node);
  // Before anything is captured: a call naming nothing runnable costs the page
  // nothing and is answered from what the catalog says.
  if (!node) return refusal(undefined, "invalid_input", unknownNode(value.node), undefined, { call: value });
  const parameters = isJsonRecord(value.parameters) ? value.parameters : undefined;
  const record = { actionId: node.definitionId, effect: node.effect, proposes: node.proposes, call: value, parameters: isJsonRecord(value.parameters) ? value.parameters : {} };
  if (!parameters || Object.keys(value).some((key) => !CALL_KEYS.includes(key))) {
    return refusal(undefined, "invalid_input", rejectionDetail({ reason: "unexpected_input_keys", target: undefined, instead: CALL_KEYS, missing: undefined, requestId: undefined }), undefined, record);
  }
  let current: WebLlmSnapshotBinding | undefined;
  try {
    // A look is one round trip. The capture this domain takes to read the page
    // *is* the snapshot node running, so taking one before it and one after it
    // would make the cheapest thing a build does cost three.
    if (node.actionType === WEB_LLM_OBSERVATION_NODE_ACTION) {
      // Room for what the node says about itself, so the packet plus those few
      // keys stays inside what the call was allowed rather than overshooting it.
      const looking = run.request.maxEvidenceBytes === undefined
        ? run.request
        : { ...run.request, maxEvidenceBytes: Math.max(1, run.request.maxEvidenceBytes - LOOK_ENVELOPE_BYTES) };
      const looked = await currentPage(run, looking);
      // Nothing to look at: this build was told where its Flow starts and has
      // not got there. The free first look is where that is said, so the
      // model's first paid decision is made knowing where it is meant to be.
      if (!looked) return notThereYet(run, record);
      run.shown(looked);
      return toolExecution(
        nodeEvidence(looked.evidence, present<WebNodeOutcome>({ ok: true, node: node.definitionId, status: "succeeded", pageChanged: false, control: undefined, read: undefined, inFlow: false })),
        false,
        WEB_LLM_INSPECT_RESULT_CODE,
        undefined,
        present<WebNodeDraftStatement>({ actionId: node.definitionId, effect: "observe", input: safeCall(value, parameters), ranWith: nodeCall(value, parameters), proposes: false, replay: undefined })
      );
    }
    current = await currentPage(run, run.request);
    // From nowhere, the only call that runs is the one that goes to the start
    // location. Everything else is refused with where to go, rather than with
    // `page_unreadable`, which says what happened and not what to do about it.
    if (!current && !webMovesThePage(node)) return notThereYet(run, record);
    if (current) run.shown(current);
    // A handle written bare -- `selector: target.3` -- is the shape the Flow
    // script writes and the shape a model reaches for, and the resolver only
    // knows `{handle}`. Left alone it is not a handle at all: it goes to the
    // page as a literal selector, which is nothing, and the node fails
    // `target_not_found` with nothing said about why. So it is put into the
    // shape the resolver reads before anything else happens, and the *written*
    // form is what the draft keeps, so the step the Flow gains resolves the
    // same way this run did.
    const written = withHandleShape(parameters);
    // `gatedByCaller`, because this call's permission is decided a few lines
    // below against the page the model is looking at, with a refusal that
    // carries that page back to it. Resolution gates a *step of a Flow*, which
    // is a different question asked at a different time.
    const resolved = await resolveWebPlanNodeParameters(
      { projectId: run.request.projectId, flowId: run.request.flowId, nodeDefinitionId: node.definitionId, parameters: written, gatedByCaller: true },
      run.stores
    );
    if (resolved.status === "refused") {
      // The handle codes say which way the handle stopped naming one control,
      // and each implies a different next call.
      return refusal(undefined, "target_unobserved", handleRefusal(written, resolved.issueCodes), run.request.maxEvidenceBytes, record);
    }
    // A node that acts on an element, whose parameters named no handle, is
    // acting on a locator the model invented: it has never been shown one.
    // Refused here, where the packet and the reason can be handed back, rather
    // than on the page as a bare `target_not_found`.
    if (resolved.status === "unchanged" && node.definition.metadata?.elementTarget === true) {
      return refusal(undefined, "target_unobserved", rejectionDetail({
        reason: "target_not_a_handle", target: undefined, instead: HANDLE_SHAPE, missing: undefined, requestId: undefined
      }), run.request.maxEvidenceBytes, record);
    }
    const ran = resolved.status === "resolved" ? resolved.parameters : written;
    // No page, no control to have observed: the move that goes to the start
    // location acts on the browser rather than on anything in front of it.
    const control = current ? observedControl(current.evidence, written) : { name: undefined, kind: "step" };
    // A node that acts must say what acting would lastingly do, `[]` included.
    // Saying nothing is not the same as saying it causes nothing: a step that
    // declared nothing would be waved past the gate every time the Flow ran,
    // and the one fact nobody but the model holds is what its own step means on
    // this site.
    if (node.effect === "mutate" && value.consequences === undefined) {
      return refusal(undefined, "invalid_input", rejectionDetail({
        reason: "missing_input_keys", target: undefined, instead: CALL_KEYS, missing: undefined, requestId: undefined
      }), run.request.maxEvidenceBytes, record);
    }
    const permission = await webActionPermission({
      check: run.request.permission,
      declared: value.consequences,
      control,
      verb: node.definition.label.toLowerCase()
    });
    if (permission.kind === "invalid") {
      return refusal(undefined, "invalid_input", rejectionDetail({ reason: "consequences_unreadable", target: undefined, instead: undefined, missing: undefined, requestId: undefined }), run.request.maxEvidenceBytes, record);
    }
    if (permission.kind === "refused") {
      return refusal(undefined, "permission_required", rejectionDetail({
        reason: permission.requestId === null ? "nobody_to_ask" : "consequences_not_granted",
        target: undefined, instead: undefined, missing: permission.missing, requestId: permission.requestId ?? undefined
      }), run.request.maxEvidenceBytes, record);
    }
    // Exploration stays where it started. The URL is the node's own parameter
    // and is run as written; where it may go is this domain's scope policy,
    // which the authoring navigation has always had.
    const leaving = crossOrigin(node, ran, webScopeAnchor(current?.evidence.location, run.request.startLocation));
    if (leaving) {
      return refusal(undefined, "cross_origin", rejectionDetail({ reason: "another_origin", target: undefined, instead: undefined, missing: undefined, requestId: undefined }), run.request.maxEvidenceBytes, record);
    }
    const result = await run.gateway.executeAction(run.sessionId, { actionType: node.actionType, parameters: ran, metadata: toolMetadata(run.request) });
    assertActive(run.request.signal);
    if (result.status !== "succeeded") {
      // The node's own failure, under the node's own name. The page comes with
      // it -- whatever stood in the way is on it, with a handle to act on --
      // captured to fit inside what this call was allowed, which is what
      // `pageRefusal` is for.
      // A refusal carries the page so the model can act on whatever got in the
      // way. From nowhere there is no such page, and the code alone is the
      // whole of what can honestly be said.
      throw current
        ? await pageRefusal(run.gateway, run.sessionId, run.request, current, webActionFailureRejectionCode(result), run.request.signal)
        : new RecoverableToolRejection(webActionFailureRejectionCode(result), webStartLocationRefusal(run.request.startLocation ?? ""));
    }
    const after = run.restamp(await captureEvidence(run.gateway, run.sessionId, run.request, run.request.signal));
    run.shown(after);
    const budget = evidenceByteLimit(run.request.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration);
    // What the node read, for a node that reads. Never for the look itself:
    // its payload is the raw snapshot, which is the page before any of this
    // domain's sanitizing, and the packet beside it already says what the page
    // is. Returning it would be the one path by which a page's own markup
    // reached a decision.
    const read = node.proposes ? webNodeReadResult(result.payload as JsonValue | undefined, Math.max(0, Math.floor(budget / 4))) : undefined;
    // Arriving from nowhere changed the page by definition: there was none.
    const changed = current === undefined || JSON.stringify(after.evidence) !== JSON.stringify(current.evidence);
    // The page, with what the node did to it written on the same packet rather
    // than around it. One shape, the one every other packet has: a handle is
    // read out of `elements` wherever it is read, and a consumer that knew
    // where to look in an exploration packet still does.
    const outcome = present<WebNodeOutcome>({
      ok: true,
      node: node.definitionId,
      status: result.status,
      // Said, never inferred: a press that left the page looking the same may
      // still have been the right step, and a model that is told so can decide.
      pageChanged: changed,
      control: control.name,
      read,
      inFlow: node.proposes
    });
    return toolExecution(
      bounded(nodeEvidence(after.evidence, outcome), budget, after.evidence, outcome),
      // The node ran and the command succeeded, so this step worked -- which is
      // what the draft reads it as. Whether the page then looked different is a
      // separate fact, reported as `pageChanged`: a press that applies a filter
      // can leave a sanitized packet identical and still be the step the Flow
      // needs, and reading "nothing changed" as "nothing happened" would also
      // let the loop answer the next identical call from its cache.
      true,
      node.effect === "mutate" ? WEB_LLM_ACTION_RESULT_CODE : WEB_LLM_INSPECT_RESULT_CODE,
      undefined,
      // Two arguments, and they are not the same argument.
      //
      // `input` is what the model wrote, and is the only one it is ever shown
      // back. It goes through the denied-key declaration first: a call may name
      // a locator the model invented, and one such key anywhere in the evidence
      // makes Core refuse the next decision request outright rather than send
      // it (`run-mud9yc6f-0bd9fc87`).
      //
      // `ranWith` is what the node ran with, and is what the Flow keeps. A
      // handle is a name for a control on a page as it was, and a page that
      // re-renders -- which a search, a filter or a sort does -- stops having
      // it: live, a build ran four nodes successfully and had its Flow refused
      // `web.handle.unknown` when the draft was assembled
      // (`run-mud9rpmz-16de647b`). A selector and an element identity that
      // provably worked cannot go stale that way.
      // Written out by name, not spread: the record this function carries holds
      // the raw call for a refusal to fall back on, and Core reads a draft
      // statement strictly -- an extra key and the whole result is not one.
      // What running this step again would need, so the whole draft can be run
      // once more before it is proposed (`./replay.ts`). The page it found is
      // recorded on every step and only the first proposed one's is used; what
      // it read is recorded so a replay that reads nothing can be told from one
      // that reads the same rows in another order.
      present<WebNodeDraftStatement>({
        actionId: record.actionId,
        effect: record.effect,
        input: safeCall(value, written),
        ranWith: nodeCall(value, flowParameters(written, ran)),
        proposes: node.proposes,
        // Where this step found the page. The draft's first step is the one a
        // replay resets to, and for a Flow that starts by going somewhere that
        // step found no page at all -- so what it records is where it was sent,
        // which is what a reset has to put the page back to (`./replay.ts`).
        replay: webNodeReplayStatement({ location: current?.evidence.location ?? run.request.startLocation ?? after.evidence.location, payload: result.payload as JsonValue | undefined, reads: node.proposes })
      })
    );
  } catch (error) {
    if (error instanceof RecoverableToolRejection) {
      // Only a refusal the page caused carries the page, and only the page the
      // refusal itself captured: whatever stood in the way is on it, with a
      // handle the model can act on next. Every other refusal is codes alone,
      // which is what keeps a refusal from repeating a word of the page it
      // refused (`../tool-rejection.ts`).
      const page = error.page ? run.restamp(error.page) : undefined;
      if (page) run.shown(page);
      return refusal(page, error.code, error.detail, run.request.maxEvidenceBytes, record);
    }
    throw error;
  }
}

/** A refusal as the call's result: the code, why, and the page as it now stands. */
function refusal(
  page: WebLlmSnapshotBinding | undefined,
  code: WebLlmToolRejectionCode,
  detail: ReturnType<typeof rejectionDetail> | undefined,
  maxEvidenceBytes: number | undefined,
  record: { actionId?: string; effect?: "observe" | "mutate"; proposes?: boolean; call?: JsonObject; parameters?: JsonObject; status?: string }
): WebLlmEvidenceToolExecution {
  const budget = evidenceByteLimit(maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration);
  const bare = toolRejection(code, undefined, detail);
  const withPage = page ? toolRejection(code, page.evidence, detail) : bare;
  // The page inside a refusal was already captured to fit what this call was
  // allowed, envelope included (`pageRefusal`), so the only question left is
  // whether the refusal as a whole fits.
  const value = serializedBytes(withPage) <= budget ? withPage : bare;
  return toolExecution(value as unknown as JsonValue, false, webLlmToolRejectionResultCode(code), undefined, present<WebNodeDraftStatement>({
    actionId: record.actionId,
    effect: record.effect,
    // `input` is always given, even for a refusal, because the loop would
    // otherwise record the call as the model wrote it -- and a refused call is
    // exactly the one likely to carry a key the domain denies.
    input: safeCall(record.call ?? {}, record.parameters ?? {}),
    ranWith: undefined,
    // Whether a call of this kind belongs in a result, which is a property of
    // the node and not of this attempt. That it did not work is said by
    // `effectApplied: false`, and the two are held apart so a failed step stays
    // on the draft the model is shown with `inResult: false` beside it.
    proposes: record.proposes,
    // A step that did not work is a step nothing will run again: the replay
    // gate reads the absence of this as "not replayable", which is right.
    replay: undefined
  }));
}

/**
 * The whole result when it fits, and the page with only what the node did to it
 * when it does not.
 *
 * The page is never what goes: it is the one thing the next decision cannot be
 * made without, and it was already sanitized to this call's own budget.
 */
function bounded(evidence: JsonValue, budget: number, page: WebLlmPageEvidence, outcome: WebNodeOutcome): JsonValue {
  if (serializedBytes(evidence) <= budget) return evidence;
  return nodeEvidence(page, present<WebNodeOutcome>({
    ok: outcome.ok, node: outcome.node, status: outcome.status,
    pageChanged: undefined, control: undefined, read: undefined, inFlow: outcome.inFlow
  }));
}

/** What the call could have named instead: every node this domain can run. */
function unknownNode(named: unknown) {
  return rejectionDetail({
    reason: "node_not_runnable_here",
    target: typeof named === "string" ? named.slice(0, 200) : undefined,
    instead: webRunnableNodeIds(),
    missing: undefined,
    requestId: undefined
  });
}

/** The handle refusal, carrying the handle the call named and the resolver's own codes. */
function handleRefusal(parameters: JsonObject, issueCodes: readonly string[]) {
  return rejectionDetail({
    reason: "parameters_not_resolved",
    target: firstHandle(parameters),
    // The codes, and then the shapes a handle is accepted in. A live build was
    // refused `web.handle.extraction_required` fifteen times and never once
    // corrected the shape, because a code is a name for a mistake and not a
    // statement of what is accepted instead (`run-mudabxqd-266e728d`).
    instead: [...issueCodes.map((code) => String(code).slice(0, 100)).slice(0, 12), ...HANDLE_SHAPE],
    missing: undefined,
    requestId: undefined
  });
}

/** The control a call acts on, as the person being asked would name it. */
function observedControl(evidence: WebLlmPageEvidence, parameters: JsonObject): { name: string | undefined; kind: string } {
  const handle = firstHandle(parameters);
  const element = handle === undefined ? undefined : evidence.elements.find((candidate) => candidate.target === handle);
  if (!element) return { name: undefined, kind: "step" };
  const kind = element.role && /^[a-z]+$/u.test(element.role) ? element.role : element.tag === "a" ? "link" : /^[a-z]+$/u.test(element.tag) ? element.tag : "control";
  return { name: element.name ?? element.text, kind };
}

/** The first target handle a call's parameters name, wherever it wrote it. */
function firstHandle(value: JsonValue | undefined, depth = 0): string | undefined {
  if (depth > 6 || value === undefined || value === null) return undefined;
  if (typeof value === "string") return TARGET_HANDLE.test(value) ? value : undefined;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstHandle(entry, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof value !== "object") return undefined;
  for (const entry of Object.values(value)) {
    const found = firstHandle(entry as JsonValue, depth + 1);
    if (found) return found;
  }
  return undefined;
}

/**
 * The page, with what the node did to it written on the same packet rather than
 * around it. One shape, the one every other packet has.
 */
function nodeEvidence(page: WebLlmPageEvidence, outcome: WebNodeOutcome): JsonValue {
  const packet: JsonObject = page as unknown as JsonObject;
  const said: JsonObject = outcome as unknown as JsonObject;
  return { ...packet, ...said } as unknown as JsonValue;
}

/**
 * The parameters the Flow's step keeps: resolved, except for the list an
 * extraction reads.
 *
 * An element is kept resolved because a handle names a control on a page as it
 * was, and a page that re-renders stops having it. A detected list is the other
 * way round: its handle belongs to the Flow rather than to a page, and the plan
 * resolver *refuses* a literal request outright once a list has been detected,
 * because a model that was shown a handle and wrote selectors instead can only
 * have guessed them. So the handle is what is written down, and it is resolved
 * again when the plan is assembled. Live, keeping the resolved request instead
 * had a build refused `web.handle.extraction_required` twenty-three times for
 * a fault in what Core had written down rather than in anything the model
 * wrote (`run-mudakzor-ec549d9d`).
 */
function flowParameters(written: JsonObject, ran: JsonObject): JsonObject {
  return written[EXTRACTION_SLOT] === undefined ? ran : { ...ran, [EXTRACTION_SLOT]: written[EXTRACTION_SLOT] };
}

/**
 * The call as the model may be shown it again: its own words, with every key
 * the domain denies removed (`../denied-keys.ts`).
 */
function safeCall(value: JsonObject, parameters: JsonObject): JsonObject {
  return withoutWebLlmDeniedKeys(nodeCall(value, parameters));
}

/**
 * One library call, written by name: the node, its parameters and what the
 * call said running it would lastingly do.
 *
 * Never stripped. This is what the Flow's step is built from, and a web step
 * runs on a selector by necessity; the declaration is applied to what the model
 * is *shown* instead (`safeCall`).
 */
function nodeCall(value: JsonObject, parameters: JsonObject): JsonObject {
  return present<{ node: JsonValue; parameters: JsonObject; consequences: JsonValue }>({
    node: value.node ?? null,
    parameters,
    consequences: value.consequences ?? null
  }) as unknown as JsonObject;
}

/**
 * The call's parameters with every bare handle put into the shape the resolver
 * reads.
 *
 * Only in the slots a handle belongs in, and only for a token this domain
 * actually mints. Everything else is left exactly as written, because guessing
 * that some other string was meant to be a handle is the kind of inference this
 * whole design removes.
 */
function withHandleShape(parameters: JsonObject): JsonObject {
  const out: JsonObject = { ...parameters };
  const extraction = out[EXTRACTION_SLOT];
  if (typeof extraction === "string" && EXTRACTION_HANDLE.test(extraction)) out[EXTRACTION_SLOT] = { handle: extraction };
  for (const slot of ELEMENT_SLOTS) {
    const handle = elementHandle(out[slot]);
    if (handle === undefined) continue;
    delete out[slot];
    out[KEPT_ELEMENT_SLOT] = { handle };
    break;
  }
  return out;
}

/** The target handle a value names, written bare or in the resolver's shape. */
function elementHandle(value: JsonValue | undefined): string | undefined {
  if (typeof value === "string") return TARGET_HANDLE.test(value) ? value : undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const handle = (value as JsonObject).handle;
  return typeof handle === "string" && TARGET_HANDLE.test(handle) ? handle : undefined;
}

/** Whether a navigation would leave the origin the exploration is on. */
function crossOrigin(node: WebRunnableNode, parameters: JsonObject, location: string | undefined): boolean {
  if (node.actionType !== WEB_NAVIGATION_ACTION || typeof parameters.url !== "string" || location === undefined) return false;
  try {
    return new URL(parameters.url).origin !== new URL(location).origin;
  } catch {
    return false;
  }
}

/**
 * The page as it stands, or nothing at all.
 *
 * A build that was told where its Flow starts has had nothing opened for it:
 * the tab is the blank one a browser opens on, the extension refuses to read it
 * (`apps/extension/src/runtime/unsupported-page.ts`), and the capture comes back
 * `page_unreadable`. That is not a fault to report, it is the situation, and
 * `undefined` is how this module says so.
 *
 * A build that was told no start location is unchanged in every respect: the
 * refusal is raised as it always was, because there is nowhere to send the
 * model and "the page could not be read" is then the whole truth.
 */
async function currentPage(run: WebNodeRun, request: WebLlmEvidenceToolRequest): Promise<WebLlmSnapshotBinding | undefined> {
  const capture = async () => run.restamp(await captureEvidence(run.gateway, run.sessionId, request, run.request.signal));
  if (run.request.startLocation === undefined) return await capture();
  try {
    return await capture();
  } catch (error) {
    if (error instanceof RecoverableToolRejection && error.code === "page_unreadable") return undefined;
    throw error;
  }
}

/** The refusal for a call made before the Flow has reached where it starts. */
function notThereYet(run: WebNodeRun, record: Parameters<typeof refusal>[4]): WebLlmEvidenceToolExecution {
  return refusal(undefined, "not_at_start_location", webStartLocationRefusal(run.request.startLocation ?? ""), run.request.maxEvidenceBytes, record);
}

/** Republished so the runtime's tool table and this module cannot disagree. */
export { WEB_LLM_RUN_NODE_TOOL_ID };
