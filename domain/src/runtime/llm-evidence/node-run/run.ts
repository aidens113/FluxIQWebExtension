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
// instruction and permission, and a refusal carries the request the person will
// answer (`../permission.ts`). The one thing this module decides for itself is
// where exploration may go: the origin it started on, and there only to an
// address the build was shown (`./shown-addresses.ts`).
//
// **A build may begin nowhere.** When Core says where the Flow starts
// (`AS/runtime/flow-bootstrap/start-location.ts`), nothing was opened for this
// build: the capture every call makes first comes back refused, and the only
// call that gets past that is the move that goes there. The same holds when
// the tab is already on a page, because arrival is remembered per build
// (`./arrival.ts`) rather than read off the tab. `./start-location.ts`
// holds the whole of that rule and why it is a rule at all.
//
// **A failure is a result, never an exception.** Every refusal this module can
// produce comes back as the call's result, carrying the page as it now stands
// so whatever got in the way has a handle the model can act on next, and
// carrying the record of the step under the node's own name with
// `proposes: false` so a step that did not work cannot reach the Flow.
//
// **Except a robot check, which is not the model's.** A call that meets one
// (`USER_INTERVENTION_REQUIRED`) is marked `personNeeded`, and its draft
// statement is the step as it stands once the person has cleared the check
// (`personDraft`): Core asks the person and never shows the model the refusal.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webActionFailureRefusal } from "../action-failure";
import {
  assertActive,
  captureAfterAction,
  captureEvidence,
  pageRefusal,
  toolExecution,
  toolMetadata,
  withCallStates,
  withPersonNeeded,
  type WebLlmEvidenceToolExecution,
  type WebLlmEvidenceToolRequest
} from "../capture";
import type { WebLlmNameAssumption } from "../name-assumption";
import { publishedWebLlmPage } from "../page-view";
import { present } from "../present";
import { webBuildRefusalDiagnostic } from "../refusal-diagnostic";
import { webActionPermission } from "../permission";
import { resolveWebPlanNode } from "../plan-resolution";
import { WEB_DECLINED_PRESS_INSTEAD } from "../press";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "../sanitize";
import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import { withoutWebLlmDeniedKeys } from "../denied-keys";
import { WEB_LLM_EXTRACTION_HANDLE_PATTERN } from "../structure";
import { RecoverableToolRejection, rejectionDetail, toolRejection, type WebLlmToolRejectionCode } from "../tool-rejection";
import { isJsonRecord } from "../untrusted-json";
import { webLlmToolRejectionResultCode, WEB_LLM_ACTION_RESULT_CODE, WEB_LLM_INSPECT_RESULT_CODE, WEB_LLM_RUN_NODE_TOOL_ID } from "../vocabulary";
import { webRunnableNode, webRunnableNodeIds, WEB_LLM_OBSERVATION_NODE_ACTION, type WebRunnableNode } from "./catalog";
import { withClearedWait } from "./cleared-wait";
import { webCoveredTarget } from "./covered-target";
import type { WebNodeRun } from "./context";
import { webObservedControl } from "./observed-control";
import { webNodeDispatchParameters, webNodeReadWithRejectedRows } from "./rejected-rows";
import { webUnshownAddressRefusal } from "./shown-addresses";
import { webMovesThePage, webScopeAnchor, webStartLocationRefusal, WEB_NAVIGATION_ACTION } from "./start-location";
import { replayWebOutputNode, webNodeReplayCall, webNodeReplayStatement, type WebNodeReplayStatement } from "./replay";

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
const HANDLE_SHAPE = ['target: {"handle": "tN"}', 'extractList: {"handle": "extraction.N"}'];
/** The keys the library verb takes, and all it takes (`Core runtime/llm/node-tools/`). */
const CALL_KEYS = ["node", "parameters", "consequences"];

/**
 * What a node call says about itself, beside the page it left behind.
 *
 * Written by name rather than spread, because a field that quietly stops
 * arriving here costs nothing that shows: the model simply reasons with less
 * (`../present.ts`).
 */
/** The press node, by the id the catalog gives it. */
const PRESS_NODE_ID = "web.output.dom-click";

/** What a press that left the page looking the same is told, beside `pageChanged: false`. */
const PRESS_AGAIN = "The press landed and the page did not change. Some pages take the first press after they load only as a wake-up: press the same control once more before trying anything else, and keep both presses, since the Flow will need them too.";

export type WebNodeOutcome = {
  ok: true;
  /** The node that ran, as the catalog names it. */
  node: string;
  /** The command's own status, as the page reported it. */
  status: string;
  /** Whether the page looked different afterwards. Absent where it was not compared. */
  pageChanged?: boolean;
  /**
   * Said beside `pageChanged: false` after a press, and nowhere else
   * (`PRESS_AGAIN`): some pages take the first press after they load only as a
   * wake-up. Lane t195's run `run-munuxns5-833f4313` pressed bigbox's Add to cart,
   * saw nothing change, navigated away and back, and did it again for forty
   * decisions without ever pressing twice in a row.
   */
  unchangedPress?: string;
  /**
   * The node ran and the page it left could not be read, however long it was
   * waited for (`../capture.ts`, `captureAfterAction`). The packet then has no
   * page in it, and the next call's own look is where the page is read again.
   */
  pageUnreadable?: true;
  /** The control it acted on, in the words the model was shown. */
  control?: string;
  /** What a reading node read, whole but for its secrets (`./read-result.ts`). */
  read?: JsonValue;
  /** Whether a successful run of this node is a step of the Flow. */
  inFlow: boolean;
};

/** What the call reports to the draft Core is accruing (`AS/runtime/flow-draft/`). */
export type WebNodeDraftStatement = NonNullable<WebLlmEvidenceToolExecution["draft"]>;

/**
 * What one call was, accumulated as the call proceeds, so a refusal raised at
 * any point records the same facts a success does.
 *
 * `assumed` is set once the resolution has run and then stands for every
 * refusal after it -- a missing declaration, a permission the person has not
 * given, another origin, and the page's own failure, which arrives as an
 * exception caught outside the block the resolution ran in. Threading it
 * through each of those call sites instead would mean the one site somebody
 * forgot silently lost the guess, which is the shape of defect this field
 * exists to close.
 */
type WebNodeCallRecord = {
  actionId?: string;
  effect?: "observe" | "mutate";
  proposes?: boolean;
  call?: JsonObject;
  parameters?: JsonObject;
  status?: string;
  assumed?: WebLlmNameAssumption[] | undefined;
  /**
   * The page as the call found it, once it has been read: the state a refusal
   * says it found (`stateDigests.before`), and, for a refusal raised before the
   * node's command went out, the state it left as well.
   */
  found?: WebLlmSnapshotBinding | undefined;
  /**
   * The node's command has gone to the page. From here a refusal cannot say
   * the page is as it was found; only a page captured afterwards says what the
   * call left.
   */
  acted?: true;
  /**
   * The step as a succeeded call of this node would have stated it, written
   * just before its command goes out: what the model may be shown (`input`),
   * what the Flow keeps (`ranWith`), and what a replay needs (`replay`).
   *
   * Read only when the command met a robot check (`personNeeded`). Core then
   * asks the person, and on Continue the call stands with this statement --
   * the navigation or press did happen, and the person cleared what stood
   * behind it -- so it is the same statement a success would have made
   * (`personDraft`).
   */
  standing?: { input: JsonObject; ranWith: JsonObject; replay: WebNodeReplayStatement };
};

/** Run the node a call named, and answer with what it did. */
export async function runWebOutputNode(run: WebNodeRun): Promise<WebLlmEvidenceToolExecution> {
  const value = run.request.value;
  // A call Core made rather than the model: the draft being run again before it
  // may be proposed (`./replay.ts`). It goes to the same executor so it passes
  // the same permission gate, and it is answered in Core's closed replay
  // vocabulary rather than this domain's, because Core reads the answer.
  const replaying = webNodeReplayCall(value);
  if (replaying) {
    const replayed = await replayWebOutputNode(run, replaying);
    // A replayed navigation that ran is the Flow's own first step reaching its
    // page, which is arrival as much as the original call was. This is what
    // keeps a resumed build -- a new process, nothing remembered -- from being
    // refused after its saved draft has been replayed from the start. A reset
    // is not: it is this domain's move, not a step of the Flow.
    if (replaying === "step" && replayed.effectApplied && run.request.startLocation !== undefined) {
      const replayedNode = webRunnableNode(value.node);
      if (replayedNode && webMovesThePage(replayedNode)) run.arrivals.arrive(buildOf(run));
    }
    return replayed;
  }
  // The build's opening call starts it not there, whatever the tab shows
  // (`./arrival.ts`). A build told no start location is not touched.
  if (run.request.startLocation !== undefined) run.arrivals.opening(buildOf(run), run.request.callId);
  run.addresses.opening(buildOf(run), run.request.callId);
  const node = webRunnableNode(value.node);
  // Before anything is captured: a call naming nothing runnable costs the page
  // nothing and is answered from what the catalog says.
  if (!node) return refusal(undefined, "invalid_input", unknownNode(value.node), { call: value });
  const parameters = isJsonRecord(value.parameters) ? value.parameters : undefined;
  const record: WebNodeCallRecord = { actionId: node.definitionId, effect: node.effect, proposes: node.proposes, call: value, parameters: isJsonRecord(value.parameters) ? value.parameters : {} };
  if (!parameters || Object.keys(value).some((key) => !CALL_KEYS.includes(key))) {
    return refusal(undefined, "invalid_input", rejectionDetail({ reason: "unexpected_input_keys", target: undefined, instead: CALL_KEYS, missing: undefined, requestId: undefined }), record);
  }
  let current: WebLlmSnapshotBinding | undefined;
  try {
    // A look is one round trip. The capture this domain takes to read the page
    // *is* the snapshot node running, so taking one before it and one after it
    // would make the cheapest thing a build does cost three.
    if (node.actionType === WEB_LLM_OBSERVATION_NODE_ACTION) {
      // A look reads the page as it stands, arrived or not, as find_on_page
      // does (`run-muqc07fh-eeffbc86` refused it on the start location). It is
      // never a step of the Flow, so it cannot stand in for arriving. Only an
      // unreadable page, the blank tab, answers it with where to go.
      const looked = await readablePage(run, run.request);
      if (!looked) return notThereYet(run, record);
      run.shown(looked);
      // One capture, which is both the state the look found and the one it left.
      return withCallStates(toolExecution(
        nodeEvidence(looked.evidence, present<WebNodeOutcome>({ ok: true, node: node.definitionId, status: "succeeded", pageChanged: false, unchangedPress: undefined, pageUnreadable: undefined, control: undefined, read: undefined, inFlow: false })),
        false,
        WEB_LLM_INSPECT_RESULT_CODE,
        undefined,
        present<WebNodeDraftStatement>({ actionId: node.definitionId, effect: "observe", input: safeCall(value, parameters), ranWith: nodeCall(value, parameters), proposes: false, replay: undefined }),
        // A look that worked refuses nothing, so it says neither why it refused
        // nor which node it would have named: the draft statement beside it
        // already carries `actionId`, and a successful call is not the row a
        // reader of a failed run is trying to tell apart from another. It named
        // nothing either, so it assumed nothing.
        { resultReason: undefined, nodeId: undefined, assumed: undefined }
      ), looked, looked);
    }
    current = await currentPage(run, run.request);
    // Absent from nowhere, which leaves the state this call found unsaid.
    record.found = current;
    // From nowhere, the only call that runs is the one that goes to the start
    // location. Everything else is refused with where to go, rather than with
    // `page_unreadable`, which says what happened and not what to do about it.
    if (!current && !webMovesThePage(node)) return notThereYet(run, record);
    // Not shown to the model, so a look cut short adds handles and forgets none:
    // remembered as shown, a notice that pushed a shown filter past this look's
    // forty controls took the filter's handle with it (`run-muohbi3e-e5847e5a`).
    if (current) run.looked(current);
    // A handle written bare -- `selector: t3` -- is the shape the Flow
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
    // `resolveWebPlanNode` rather than the narrow answer Core asks for, because
    // this is a record of a call: a column name the resolution had to guess at
    // is the difference between a wrong answer nobody can explain and one whose
    // cause is written down (`../name-assumption.ts`).
    const { resolution: resolved, assumed } = await resolveWebPlanNode(
      { projectId: run.request.projectId, flowId: run.request.flowId, nodeDefinitionId: node.definitionId, parameters: written, gatedByCaller: true },
      run.stores
    );
    record.assumed = assumed;
    if (resolved.status === "refused") {
      // The handle codes say which way the handle stopped naming one control,
      // and each implies a different next call. The page goes with the refusal
      // and is the page shown from now on: what took the control away -- a
      // popup that opened, a list that re-rendered -- and the handles to use
      // instead are on it, so the next call need not be a look to learn them
      // (`run-mup2i28c-6c7fc209`, C3).
      if (current) run.shown(current);
      return refusal(current, "target_unobserved", handleRefusal(written, resolved.issueCodes), record);
    }
    // A node that acts on an element, whose parameters named no handle, is
    // acting on a locator the model invented: it has never been shown one.
    // Refused here, where the packet and the reason can be handed back, rather
    // than on the page as a bare `target_not_found`.
    if (resolved.status === "unchanged" && node.definition.metadata?.elementTarget === true) {
      return refusal(undefined, "target_unobserved", rejectionDetail({
        reason: "target_not_a_handle", target: undefined, instead: HANDLE_SHAPE, missing: undefined, requestId: undefined
      }), record);
    }
    const ran = resolved.status === "resolved" ? resolved.parameters : written;
    // A press on a control the look just taken shows covered is not sent: it
    // would land on the cover (`./covered-target.ts`, C4). The refusal names
    // the cover and carries the page it is on, so the layer can be dealt with
    // first -- a popup that opened on a timer is named this way (C9).
    const covered = current && node.effect === "mutate" ? webCoveredTarget(current.evidence, firstHandle(written)) : undefined;
    if (current && covered) {
      run.shown(current);
      return refusal(current, covered.code, rejectionDetail({
        reason: "covered_by_layer", target: covered.target, instead: covered.covers, missing: undefined, requestId: undefined, closeWith: covered.closers
      }), record);
    }
    // No page, no control to have observed: the move that goes to the start
    // location acts on the browser rather than on anything in front of it.
    const control = current ? webObservedControl(current.evidence, firstHandle(written), ran) : { name: undefined, kind: "step" };
    // A node that acts must say what acting would lastingly do, `[]` included.
    // Saying nothing is not the same as saying it causes nothing: a step that
    // declared nothing would be waved past the gate every time the Flow ran,
    // and the one fact nobody but the model holds is what its own step means on
    // this site. An explicit `null` is the same as saying nothing: it is what a
    // stored call carried forward before `nodeCall` stopped writing it, and
    // "missing" is the refusal that tells the model what to write instead.
    if (node.effect === "mutate" && (value.consequences === undefined || value.consequences === null)) {
      return refusal(undefined, "invalid_input", rejectionDetail({
        reason: "missing_input_keys", target: undefined, instead: CALL_KEYS, missing: undefined, requestId: undefined
      }), record);
    }
    const permission = await webActionPermission({
      check: run.request.permission,
      declared: value.consequences,
      control,
      verb: node.definition.label.toLowerCase(),
      // Not the model's word, and the reason a read is never refused: a node
      // that only looks at the page cannot have left anything behind, so what
      // it declared is recorded and disregarded (`../permission.ts`).
      effect: node.effect
    });
    if (permission.kind === "invalid") {
      return refusal(undefined, "invalid_input", rejectionDetail({ reason: "consequences_unreadable", target: undefined, instead: undefined, missing: undefined, requestId: undefined }), record);
    }
    if (permission.kind === "refused") {
      return refusal(undefined, "permission_required", rejectionDetail({
        reason: permission.requestId === null ? "nobody_to_ask" : permission.declined ? "consequences_declined" : "consequences_not_granted",
        target: undefined, instead: permission.declined ? WEB_DECLINED_PRESS_INSTEAD : undefined, missing: permission.missing, requestId: permission.requestId ?? undefined
      }), record);
    }
    // Exploration stays where it started. The URL is the node's own parameter
    // and is run as written; where it may go is this domain's scope policy,
    // which the authoring navigation has always had.
    const leaving = crossOrigin(node, ran, webScopeAnchor(current?.evidence.location, run.request.startLocation));
    if (leaving) {
      return refusal(undefined, "cross_origin", rejectionDetail({ reason: "another_origin", target: undefined, instead: undefined, missing: undefined, requestId: undefined }), record);
    }
    // And only to an address this build was shown, with the page back so the link that goes there can be pressed.
    if (run.addresses.refuses(buildOf(run), node, ran, { location: current?.evidence.location, startLocation: run.request.startLocation })) {
      // This refusal hands the look back, so from here it is a packet shown.
      if (current) run.shown(current);
      return refusal(current, "address_not_shown", webUnshownAddressRefusal(run.request.startLocation), record);
    }
    // What this step is, should it meet a robot check: the statement a success
    // would make, less what only the page it left can say.
    record.standing = {
      input: safeCall(value, written),
      ranWith: nodeCall(value, flowParameters(written, ran)),
      replay: webNodeReplayStatement({ location: foundAt(current, run.request.startLocation, undefined), payload: undefined, reads: false })
    };
    record.acted = true;
    // A list read also asks for a few of the rows its conditions turned down,
    // on this command only: the Flow keeps `ran` (`./rejected-rows.ts`).
    const result = await run.gateway.executeAction(run.sessionId, { actionType: node.actionType, parameters: webNodeDispatchParameters(node, ran), metadata: toolMetadata(run.request) });
    assertActive(run.request.signal);
    if (result.status !== "succeeded") {
      // The node's own failure, under the node's own name. The page comes with
      // it -- whatever stood in the way is on it, with a handle to act on --
      // captured to fit inside what this call was allowed, which is what
      // `pageRefusal` is for.
      // A refusal carries the page so the model can act on whatever got in the
      // way, and the node's own account of what it could not do: a read that
      // came back short says how short, with the counts it already computed
      // (`../action-failure/read-shortfall.ts`). From nowhere there is no such
      // page, and where the Flow has not reached its start location that is the
      // whole of what can honestly be said, whatever the page then answered.
      const refused = webActionFailureRefusal(result);
      throw current
        ? await pageRefusal(run.gateway, run.sessionId, run.request, current, refused, run.request.signal)
        : new RecoverableToolRejection(refused.code, webStartLocationRefusal(run.request.startLocation ?? ""), undefined, refused.personNeeded);
    }
    // The command worked. Should the look after it meet a robot check, the step
    // stands with what it read, as a success's statement would say.
    record.standing.replay = webNodeReplayStatement({ location: foundAt(current, run.request.startLocation, undefined), payload: result.payload as JsonValue | undefined, reads: node.proposes });
    // The move that goes there has now gone there: from here on the page is an
    // ordinary page (`./arrival.ts`).
    if (run.request.startLocation !== undefined && webMovesThePage(node)) run.arrivals.arrive(buildOf(run));
    // The page the node left, once there is one. A node that starts a
    // navigation of the page it acted on -- a button that saves and reloads
    // (bigbox's "Set as my store", `run-muncqlr0-3348202b`), a form that
    // submits -- can leave the look after it between two documents. That
    // look's `page_unreadable` used to be raised as this call's refusal, so a
    // step that had worked came back `effectApplied: false` and could never be
    // a step of the Flow. It is now waited out until the new document answers
    // (`../capture.ts`, `captureAfterAction`); a page still unreadable once
    // that window has passed is reported without a packet, and the node is
    // still reported as having run, because it did.
    const settled = await captureAfterAction(run.gateway, run.sessionId, run.request, run.request.signal);
    const after = settled === undefined ? undefined : run.restamp(settled);
    if (after) run.shown(after);
    // What the node read, whole, for a node that reads. Never the raw page:
    // the look's payload is nothing else, and a press, a type or a navigation
    // carries the extension's own snapshot of the page and record of the
    // control too -- the page before any of this domain's sanitizing, which the
    // packet beside it already says. That record is taken out of the read
    // (`./page-record.ts`, `run-mup2i28c-6c7fc209`); it would be the one path
    // by which a page's own markup reached a decision. A list read's
    // rejected-row samples are shown here and taken out of what is `recorded`
    // for the replay, which otherwise keeps the payload as the node answered.
    // The parameters it ran with, so a text filter that dropped numeric rows can say "use atLeast" (`./numeric-text-filter.ts`).
    const { read: shownRead, recorded } = webNodeReadWithRejectedRows(result.payload as JsonValue | undefined, ran);
    const read = node.proposes ? shownRead : undefined;
    run.addresses.ran(buildOf(run), { actionType: node.actionType, parameters: ran, read, location: after?.evidence.location ?? current?.evidence.location });
    // Arriving from nowhere changed the page by definition: there was none. A
    // page that could not be read was not compared, so it is not said.
    const changed = after === undefined ? undefined : current === undefined || JSON.stringify(after.evidence) !== JSON.stringify(current.evidence);
    // The page, with what the node did to it written on the same result rather
    // than around it. One shape, the one every other page has: the compact
    // view's `page` text, where every handle the model may use is printed.
    const outcome = present<WebNodeOutcome>({
      ok: true,
      node: node.definitionId,
      status: result.status,
      // Said, never inferred: a press that left the page looking the same may
      // still have been the right step, and a model that is told so can decide.
      pageChanged: changed,
      unchangedPress: changed === false && node.definitionId === PRESS_NODE_ID ? PRESS_AGAIN : undefined,
      pageUnreadable: after === undefined ? true : undefined,
      control: control.name,
      read,
      inFlow: node.proposes
    });
    // The state the node found is the read before it acted, and the state it
    // left is the read after -- unsaid where the page could not be read in time.
    return withClearedWait(result.payload, withCallStates(toolExecution(
      // No page, no packet: the outcome alone, which says why.
      after === undefined ? outcome as unknown as JsonValue : nodeEvidence(after.evidence, outcome),
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
        replay: webNodeReplayStatement({ location: foundAt(current, run.request.startLocation, after), payload: recorded, reads: node.proposes })
      }),
      // The node ran and nothing was refused, so neither of the refusal fields
      // is said: the draft statement above already names the node under
      // `actionId`. What the resolution had to assume is said, because this is
      // the call the Flow's step is made of and the guess is in it.
      { resultReason: undefined, nodeId: undefined, assumed }
    ), current, after));
  } catch (error) {
    if (error instanceof RecoverableToolRejection) {
      // Only a refusal the page caused carries the page, and only the page the
      // refusal itself captured: whatever stood in the way is on it, with a
      // handle the model can act on next. Every other refusal is codes alone,
      // which is what keeps a refusal from repeating a word of the page it
      // refused (`../tool-rejection.ts`).
      const page = error.page ? run.restamp(error.page) : undefined;
      if (page) run.shown(page);
      const refused = refusal(page, error.code, error.detail, record);
      // A robot check is the person's. The refusal is kept as the run's record
      // says it, and Core puts the check to the person rather than to the model.
      return error.personNeeded ? withPersonNeeded(refused, personDraft(record)) : refused;
    }
    throw error;
  }
}

/**
 * Where a step found the page: the page it acted on, or for a step from nowhere
 * where it was sent, or failing both where it arrived.
 *
 * Never empty in practice -- a call with no page before it is one a start
 * location was given for (`currentPage`) -- and the empty string is only what
 * the type needs for the case that cannot occur: `./replay.ts` reads it as a
 * location it will not return to, which is the safe reading.
 */
function foundAt(current: WebLlmSnapshotBinding | undefined, startLocation: string | undefined, after: WebLlmSnapshotBinding | undefined): string {
  return current?.evidence.location ?? startLocation ?? after?.evidence.location ?? "";
}

/** A refusal as the call's result: the code, why, and the page as it now stands. */
function refusal(
  page: WebLlmSnapshotBinding | undefined,
  code: WebLlmToolRejectionCode,
  detail: ReturnType<typeof rejectionDetail> | undefined,
  record: WebNodeCallRecord
): WebLlmEvidenceToolExecution {
  // The refusal carries the whole page it found, whenever it has one.
  const value = page ? toolRejection(code, page.evidence, detail) : toolRejection(code, undefined, detail);
  // What the refusal found is the page the call read before doing anything.
  // What it left is that same page when nothing was sent to it, and otherwise
  // only a page captured after the attempt: a command that failed may still
  // have moved something, and a state nobody read is not said. The page is
  // digested even when it is too large to go back with the refusal.
  const left = page ?? (record.acted ? undefined : record.found);
  const result = withCallStates(toolExecution(value as unknown as JsonValue, false, webLlmToolRejectionResultCode(code), undefined, present<WebNodeDraftStatement>({
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
  }), {
    // Taken from the detail rather than derived again, so a refusal site that
    // gains a sharper reason later carries it into the trace with no edit here.
    resultReason: detail?.reason,
    // The node the call named, and only when the catalog resolved it: `record`
    // carries no `actionId` for a call that named nothing runnable, which is
    // what keeps the model's invented string out of the run's own record.
    nodeId: record.actionId,
    // What the resolution assumed, for a refusal raised after it ran. Absent
    // for every refusal before it, which is the honest answer: nothing had been
    // resolved, so nothing was guessed at.
    assumed: record.assumed
  }), record.found, left);
  const diagnostic = webBuildRefusalDiagnostic({ page: record.found?.evidence, parameters: record.parameters ?? (isJsonRecord(record.call?.parameters) ? record.call.parameters : undefined), target: detail?.target, code, reason: detail?.reason });
  if (diagnostic) result.diagnostic = diagnostic;
  return result;
}

/**
 * The step as it stands once the person has cleared the robot check it met.
 *
 * A call whose command went out -- a navigation that landed on a check, a press
 * behind which one appeared -- did what it was asked, and the check was what
 * stood behind it: it stands as the step a success would have stated, proposing
 * whatever the node proposes, with the location a replay starts from. A call
 * that met the check before anything went out -- a look, or the read an action
 * takes before acting -- changed nothing, so it stands as a look and proposes
 * nothing; the model, shown the page fresh, makes its call again.
 */
function personDraft(record: WebNodeCallRecord): WebNodeDraftStatement {
  const input = record.standing?.input ?? safeCall(record.call ?? {}, record.parameters ?? {});
  if (!record.acted || record.standing === undefined) {
    return present<WebNodeDraftStatement>({ actionId: record.actionId, effect: "observe", input, ranWith: undefined, proposes: false, replay: undefined });
  }
  return present<WebNodeDraftStatement>({
    actionId: record.actionId,
    effect: record.effect,
    input,
    ranWith: record.standing.ranWith,
    proposes: record.proposes,
    replay: record.standing.replay
  });
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

/** The first target handle a call's parameters name, wherever it wrote it. */
function firstHandle(value: JsonValue | undefined, depth = 0): string | undefined {
  if (depth > 6 || value === undefined || value === null) return undefined;
  if (typeof value === "string") return canonicalWebLlmTargetHandle(value);
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
 * The page, with what the node did to it written on the same result rather than
 * around it. The page goes out as the model reads every page, the compact view
 * (`web-llm-page.v3`, `../page-view/`); the structured packet stays here.
 */
function nodeEvidence(page: WebLlmPageEvidence, outcome: WebNodeOutcome): JsonValue {
  const published: JsonObject = publishedWebLlmPage(page) as unknown as JsonObject;
  const said: JsonObject = outcome as unknown as JsonObject;
  return { ...published, ...said } as unknown as JsonValue;
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
 *
 * **`consequences` is written only when the call carried one.** Until t194-w35
 * a call with none was written back with `consequences: null`. Core takes this
 * as the step's input (`llm/evidence-loop/call-record.ts`), a rerun is a merge
 * patch over that input that never names the key, and the permission check
 * read the `null` as an unreadable declaration -- so live run 11's re-author had
 * sixteen reruns of a read refused `consequences_unreadable` for a word nobody
 * wrote (`run-muq4oaof-464f5bce`). A `null` that arrives is dropped the same
 * way, so a call already stored with one stops carrying it from its next run.
 */
function nodeCall(value: JsonObject, parameters: JsonObject): JsonObject {
  return present<{ node: JsonValue; parameters: JsonObject; consequences?: JsonValue }>({
    node: value.node ?? null,
    parameters,
    consequences: value.consequences === null ? undefined : value.consequences
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

/**
 * The target handle a value names, written bare or in the resolver's shape, in
 * the one spelling the domain issues: `target.N` is kept as `tN`, so the draft
 * shows the model the spelling every packet does.
 */
function elementHandle(value: JsonValue | undefined): string | undefined {
  if (typeof value === "string") return canonicalWebLlmTargetHandle(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return canonicalWebLlmTargetHandle((value as JsonObject).handle);
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
 * **The rule also holds when the page is already open.** Until a navigation
 * node has succeeded in this build (`./arrival.ts`) the answer is `undefined`
 * even when the capture read a page: on `run-muncqlr0-3348202b` the tab already
 * stood on the start location, the first look read it, no step ever reached
 * it, and the Flow was refused `bootstrap.cannot_reach_start_location`. The
 * capture is still taken, so the calls made are the same whichever tab the
 * build was handed. A look alone reads the page through {@link readablePage}.
 *
 * A build that was told no start location is unchanged in every respect: the
 * refusal is raised as it always was, because there is nowhere to send the
 * model and "the page could not be read" is then the whole truth.
 */
async function currentPage(run: WebNodeRun, request: WebLlmEvidenceToolRequest): Promise<WebLlmSnapshotBinding | undefined> {
  const page = await readablePage(run, request);
  return run.request.startLocation === undefined || run.arrivals.arrived(buildOf(run)) ? page : undefined;
}

/** The page as it stands, arrived or not; `undefined` only for the unreadable page of a build told its start location. */
async function readablePage(run: WebNodeRun, request: WebLlmEvidenceToolRequest): Promise<WebLlmSnapshotBinding | undefined> {
  try {
    return run.restamp(await captureEvidence(run.gateway, run.sessionId, request, run.request.signal));
  } catch (error) {
    if (run.request.startLocation !== undefined && error instanceof RecoverableToolRejection && error.code === "page_unreadable") return undefined;
    throw error;
  }
}

/** The build this call belongs to, as the arrival memory keys it. */
function buildOf(run: WebNodeRun): { projectId: string; flowId: string; sessionId: string } {
  return { projectId: run.request.projectId, flowId: run.request.flowId, sessionId: run.sessionId };
}

/** The refusal for a call made before the Flow has reached where it starts. */
function notThereYet(run: WebNodeRun, record: Parameters<typeof refusal>[3]): WebLlmEvidenceToolExecution {
  return refusal(undefined, "not_at_start_location", webStartLocationRefusal(run.request.startLocation ?? ""), record);
}

/** Republished so the runtime's tool table and this module cannot disagree. */
export { WEB_LLM_RUN_NODE_TOOL_ID };
