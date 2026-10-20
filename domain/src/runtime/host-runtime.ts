// The web-automation host runtime: the object Core asks about page state.
//
// Core's executor calls `captureStateSnapshot` at `before_action`,
// `after_action`, `after_wait_retry` and `after_patch_test`, hands the two refs
// back to `inspectStateDiff`, and stores what it got on the attempt as
// `stateRefs`. Binding the boundary is not enough on its own: a capture or diff
// this module declines leaves its key off the attempt, so an attempt carries
// only the state this module recognised its node for and actually captured.
//
// The same object carries `expectationEvaluator`. Core deliberately put the
// evaluator on the boundary rather than adding a second binding call, so a host
// that binds a runtime gets the evaluator with it and there is nothing to
// forget; see the Core report `core-expectation-evaluator.md`.
//
// Decisions worth knowing:
//
//  - **Only web nodes are snapshotted.** `captureStateSnapshot` runs for every
//    node attempt in every Flow, including LLM, code and router nodes. A page
//    snapshot around a node that never touched the page is noise, and it costs
//    a gateway round trip each time, so the boundary declines every other node.
//    A web node is a web output node (`web.output.*`), or a recorded action:
//    Core runs those as `builtin.policy.action` and names the web output in
//    `parameterValues.outputId`, so such a node is recognised only by the
//    `outputId` Core passes with it. The seam has no way to say "not this one"
//    other than to throw, and Core catches, which is why declining looks like a
//    rejection here.
//  - **A diff needs a snapshot on both sides.** With one side missing, every
//    element on the other would read as added or removed, a claim about a page
//    nobody observed, so `inspectStateDiff` declines instead.
//  - **A snapshot is the page as the model reads it.** `sanitizeWebLlmSnapshot`
//    is what already decides what page evidence may travel -- every element,
//    whole, with sensitive controls dropped and secrets screened (t200) -- and
//    the summary is that packet written as the compact view (`web-llm-page.v3`,
//    t223), because Core returns it to a recovery model as `core.state_snapshot`.
//    A state ref cannot carry more, or more sensitive, page data than a page the
//    model is shown, and the diff (`./state-diff/`) is of the view's own lines.
//  - **A snapshot says how to come back to it.** `from` is `{ location }`, the
//    token a step's `replay.from` is and a reset navigates to
//    (`llm-evidence/node-run/replay.ts`), so a re-author can put the page back
//    where a node started in the run it repairs (t194 C-D, `run-murwcmx2`: a
//    rerun of the Flow's list read ran on results page 5). It is the page's
//    real address, because a reset to a screened one would not reach the page,
//    and it is written only when that address is exactly what the packet
//    already publishes -- nothing in it withheld -- so it carries no secret.
//  - **One capture between two steps, not two.** The page a step ended on is
//    the page the next one starts on when nothing ran between them, so when
//    Core offers it back (`previousStateRef` on a `before_action` capture,
//    only moments after it arrived and with no other step started) it is
//    returned as that step's starting page instead of being read again. It
//    keeps every key a later reader uses -- the view, `from`, the document's
//    identity -- because it is the same snapshot; only the gateway round trip
//    is gone, about half of every web step's state cost (t480).
//  - **Snapshots are not stored here.** Core hands both refs back to
//    `inspectStateDiff`, so the diff reads the summaries it was given. A cache
//    keyed by `stateRef` would be a second copy of state Core already holds.
//  - **Their places are, briefly (t609).** A diff also says where the step's
//    control sat (`spot`) and which items each page listed (`items`), the
//    opaque tokens Core ties a trial's act to its own item by (Core t598). Both
//    are read from the capture's records and selectors, which a summary must
//    not carry: it is returned to a recovery model. So each capture's places
//    (`./state-diff/places/`) are remembered here by `stateRef`, for the last
//    few snapshots only, and a diff of refs this memory no longer holds names
//    neither key. `items` holds only the lists both pages show, so a list the
//    step merely revealed (a mini-cart drawer over lines that were there before
//    the build) never reads as lines the step made. Neither key is page data,
//    and both stay under Core's withholding of `stateDiff` in a saved trace.
//  - **A snapshot says its option groups and result count as data (t655).**
//    Beside the view, `groups` -- each named set of options with each option's
//    words, the count the page shows beside it and whether it is chosen -- and
//    `resultCount`, the one number of results the page states
//    (`./llm-evidence/page-groups/`). Core says what a narrowing step chose and
//    left out from them (its `result-verification/narrowed-before.ts`) without
//    reading a line of the view (A8 frozen pair 5 towels,
//    `run-mva6mlo8-f519063c`). Read off the same screened packet as the view,
//    so they say nothing the view does not.

import type { ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import type { FluxIQ } from "fluxiq";
import type { AutomationStudioHostResourcePort } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_ACTION_TYPES } from "../actions/types";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { dispatchWebAutomationOutput } from "../io/gateway-output-dispatcher";
import { webAutomationOutputNodeId } from "../output-nodes";
import { webAutomationActLanded } from "./act-landing";
import { createWebAutomationExpectationEvaluator, type WebAutomationExpectationDispatch } from "./expectation";
import { createWebAutomationFactEvaluator, type WebAutomationFactEvaluator } from "./facts";
import { createWebAutomationHostResourcePort } from "./host-resources";
import { publishedWebLlmPage, webResetResource, sanitizeWebLlmSnapshot, sanitizeWebLlmSnapshotWithBindings, screenedEvidenceUrl } from "./llm-evidence";
import { webLlmPageOptionGroups, webLlmPageResultCount } from "./llm-evidence/page-groups";
import {
  compareWebAutomationRouteSignatures,
  WEB_AUTOMATION_ROUTE_STATE_PATHS,
  webAutomationRouteEffect,
  webAutomationRouteEffectHolds,
  webAutomationRouteEffectSeen,
  webAutomationRouteSignature,
  webAutomationRouteState
} from "./route-state";
import { createWebStatePlacesMemo, webAutomationStateDiff, webStateDiffPlaces, webStateSnapshotPlaces } from "./state-diff";

/**
 * Core's `AutomationStudioHostRuntimeBoundary`. Core does not put the type on
 * its public entry, so it is read off the method that consumes it rather than
 * restated here, where a copy would silently drift.
 */
export type WebAutomationHostRuntimeBoundary = Parameters<FluxIQ["programs"]["automationStudio"]["bindHostRuntime"]>[0];

/**
 * The boundary plus what Core's interface does not declare yet: `factEvaluator`
 * (plan B1, Core C9), a batched, zero-wait, three-valued check of fact
 * conditions, offered under the capability `fact-evaluation`. Core's R2 adds
 * the method to its boundary type; until then a caller holding this type can
 * call it, and Core ignores what it does not know.
 */
export type WebAutomationHostRuntime = WebAutomationHostRuntimeBoundary & {
  factEvaluator: WebAutomationFactEvaluator;
  /**
   * The browser lease Core's host-resource scheduler grants builders through:
   * capacity 1, the paired extension's automation tab (`./host-resources/`,
   * automation-project-agents plan). Core reads it off the boundary it binds.
   */
  hostResources: AutomationStudioHostResourcePort;
};

/**
 * How the boundary reaches the paired browser; the expectation evaluator
 * shares it. Host-state captures add the same finite command bound as an
 * ordinary policy action, so a silent browser cannot strand a Flow run.
 */
type WebAutomationHostRuntimeDispatch = (
  request: Parameters<WebAutomationExpectationDispatch>[0] & { timeoutMs?: number }
) => ReturnType<WebAutomationExpectationDispatch>;
export type WebAutomationHostRuntimeGateway = { dispatch: WebAutomationHostRuntimeDispatch };

const SNAPSHOT_OUTPUT_ID = "web.dom.capture_snapshot";
const HOST_RUNTIME_SOURCE = "web-automation-host-runtime";
/** What every snapshot this host captured is named with, so it knows its own when Core offers one back. */
const STATE_SNAPSHOT_ID_PREFIX = "web.state.";
/** Matches Core's default `builtin.policy.action` command timeout. */
const HOST_STATE_COMMAND_TIMEOUT_MS = 5_000;

/**
 * Derived from the action vocabulary rather than from the `web.output.` string,
 * so a new action type is covered the day it is registered.
 */
const WEB_AUTOMATION_NODE_IDS: ReadonlySet<string> = new Set(WEB_AUTOMATION_ACTION_TYPES.map(webAutomationOutputNodeId));

/** The web output ids a recorded action may name in `parameterValues.outputId`. */
const WEB_AUTOMATION_OUTPUT_IDS: ReadonlySet<string> = new Set(WEB_AUTOMATION_ACTION_TYPES);

/** Core's node definition for a recorded action. Core exports no constant for it. */
const POLICY_ACTION_DEFINITION_ID = "builtin.policy.action";

/**
 * What this host can answer, in Core's capability vocabulary.
 *
 * `action-dispatch` is what a runtime repair that re-points or replaces an
 * acting step needs before Core will run it (`live-patch.ts`), and this host
 * does dispatch every web action a Flow runs, through the gateway the boundary
 * is bound with. It was left off, so every executed target override was refused
 * at preflight with "Runtime patch requires host capability action-dispatch" --
 * in the Lab and in the panel alike, since both bind this one boundary
 * (`registerWebAutomationRuntime`).
 */
const HOST_RUNTIME_CAPABILITIES = Object.freeze(["action-dispatch", "state-snapshot", "state-diff", "expectation-evaluation", "fact-evaluation", "route-state"] as const);

/**
 * `sessions` is the client gateway's sessions now, which the host-resource
 * port grants a lease from; absent, there is no browser to lend and every
 * acquisition answers `at_capacity`.
 */
export function createWebAutomationHostRuntime(gateway: WebAutomationHostRuntimeGateway, sessions: () => readonly ClientGatewaySession[] = () => []): WebAutomationHostRuntime {
  const evaluate = createWebAutomationExpectationEvaluator(gateway.dispatch);
  const factEvaluator = createWebAutomationFactEvaluator(gateway.dispatch);
  const places = createWebStatePlacesMemo();
  let captures = 0;
  return {
    capabilities: HOST_RUNTIME_CAPABILITIES,
    hostResources: createWebAutomationHostResourcePort({ sessions }),
    async captureStateSnapshot(input) {
      if (!actsOnPage(input.node)) {
        throw new Error(`Node ${input.node.definitionId} does not act on a page, so no web state was captured.`);
      }
      // The page the previous step ended on, which Core offers only when no
      // step started since and it arrived moments ago: the same page, so it is
      // answered rather than read a second time (t480).
      const ended = input.point === "before_action" ? input.previousStateRef : undefined;
      if (ended?.summary !== undefined && ended.stateSnapshotId.startsWith(STATE_SNAPSHOT_ID_PREFIX)) return ended;
      const result = await gateway.dispatch({
        outputId: SNAPSHOT_OUTPUT_ID,
        payload: {},
        timeoutMs: HOST_STATE_COMMAND_TIMEOUT_MS,
        metadata: {
          source: HOST_RUNTIME_SOURCE,
          domainId: WEB_AUTOMATION_DOMAIN_ID,
          nodeId: input.node.id,
          attemptId: input.attemptId,
          point: input.point
        }
      });
      if (!result.ok) throw new Error(result.error ?? "The web state snapshot was not captured.");
      // Throws when the client answered without a snapshot, which is the honest
      // outcome: Core catches it and the attempt carries no state ref, rather
      // than a ref pointing at nothing.
      // The page as the model reads every page (t223): Core returns this summary
      // to a recovery model as `core.state_snapshot`, and diffs two of them.
      // Beside the view, never in it: the document's identity, so the diff can
      // tell an address rewritten in place from a new document (run
      // `run-muw5zv4m-52d83027`). Put here rather than in `publishedWebLlmPage`,
      // which is every page a model is shown.
      const snapshot = actionSnapshot(result.payload);
      const binding = sanitizeWebLlmSnapshotWithBindings(snapshot);
      const action = result.payload?.result;
      const resetResource = webResetResource(result.metadata?.sessionId, isRecord(action) ? action.sourceId : undefined);
      if (resetResource !== undefined) binding.resetResource = resetResource;
      const packet = binding.evidence;
      const documentTimeOrigin = packet.navigation?.timeOrigin;
      // Its option groups and result count, as data beside the view (header, t655).
      const groups = webLlmPageOptionGroups(packet);
      const resultCount = webLlmPageResultCount(packet);
      const summary = {
        ...publishedWebLlmPage(packet),
        ...(documentTimeOrigin === undefined ? {} : { documentTimeOrigin }),
        ...(groups.length ? { groups } : {}),
        ...(resultCount === undefined ? {} : { resultCount })
      } as unknown as JsonObject;
      captures += 1;
      const stateSnapshotId = `${STATE_SNAPSHOT_ID_PREFIX}${captures}`;
      const from = resetToken(snapshot);
      const stateRef = `${stateSnapshotId}@${input.attemptId}:${input.point}`;
      // Beside the summary, never on it (header, t609).
      places.keep(stateRef, webStateSnapshotPlaces(binding));
      return { stateSnapshotId, stateRef, capturedAt: Date.now(), summary, ...(from ? { from } : {}) };
    },
    // What a Router's `state.*` conditions test, observed on the page the run
    // stands on before any step runs, and what a Flow build is shown so it can
    // write them. It is the evidence packet projected, never more of the page.
    async observeRouteState() {
      const result = await gateway.dispatch({
        outputId: SNAPSHOT_OUTPUT_ID,
        payload: {},
        timeoutMs: HOST_STATE_COMMAND_TIMEOUT_MS,
        metadata: { source: HOST_RUNTIME_SOURCE, domainId: WEB_AUTOMATION_DOMAIN_ID, point: "route" }
      });
      if (!result.ok) throw new Error(result.error ?? "The web route state was not captured.");
      return webAutomationRouteState(sanitizeWebLlmSnapshot(actionSnapshot(result.payload)));
    },
    routeStatePaths: WEB_AUTOMATION_ROUTE_STATE_PATHS,
    // The hashes-only signature Core keeps of each node's pre- and post-state,
    // and whether a recorded one is the page observed now (t243). Pure and
    // synchronous; the rule is in `./route-state/compare-signatures.ts`.
    signRouteState: (state) => webAutomationRouteSignature(state),
    compareRouteSignatures: (recorded, observed) => compareWebAutomationRouteSignatures(recorded, observed),
    // The hashes-only effect Core keeps of each node's step, and whether it is
    // already on the page when the step cannot run (t243). Pure and
    // synchronous; the rule is in `./route-state/effect/holds.ts`.
    signRouteEffect: (before, after) => webAutomationRouteEffect(before, after),
    routeEffectHolds: (effect, observed) => webAutomationRouteEffectHolds(effect, observed),
    // Whether a lasting step's effect appeared once it answered success, so a
    // step whose act never took effect is not counted as done (t476). Pure and
    // synchronous; the rule is in `./route-state/effect/seen.ts`.
    routeEffectSeen: (effect, observed) => webAutomationRouteEffectSeen(effect, observed),
    inspectStateDiff(input) {
      if (input.before?.summary === undefined || input.after?.summary === undefined) {
        throw new Error("A web state diff needs a snapshot on both sides, so none was computed.");
      }
      const diff = webAutomationStateDiff(input.before?.summary, input.after?.summary, input.before?.stateRef, input.after?.stateRef);
      // Where the step's control sat and the items of the lists both pages show (header, t609);
      // a loop pass's control in its own row, from the attempt's `item` (job rerun round 4).
      return { ...diff, ...webStateDiffPlaces(places.of(input.before?.stateRef), places.of(input.after?.stateRef), input.node, diff.documentChanged === true, input.inputs?.item) };
    },
    expectationEvaluator: (conditions, mode, timeoutMs, context) => evaluate(conditions, mode, timeoutMs, context),
    factEvaluator,
    // Whether a press whose answer was lost landed, for a node that declares no
    // expected state (t430): read from the pressed control on the page, never
    // from the step's declared consequences (`./act-landing/`).
    actLanded: (input) => webAutomationActLanded(input, factEvaluator)
  };
}

/** Binds the boundary onto the running FluxIQ instance, beside the runtime service. */
export function bindWebAutomationHostRuntime(fluxiq: FluxIQ): void {
  fluxiq.programs.automationStudio.bindHostRuntime(createWebAutomationHostRuntime({
    dispatch: (request) => dispatchWebAutomationOutput(fluxiq, { domainId: WEB_AUTOMATION_DOMAIN_ID, ...request })
  }, () => fluxiq.programs.clientGateway.snapshot().sessions));
}

/** The DOM snapshot inside a dispatched action's wrapped result payload. */
function actionSnapshot(payload: JsonObject | undefined): unknown {
  const action = payload?.result;
  return isRecord(action) ? action.snapshot : undefined;
}

/**
 * The reset token for the captured page: its real address, the way a step's
 * `replay.from` names a page, or nothing when the address is not one the packet
 * publishes whole -- not HTTP(S), carrying credentials, or holding any part the
 * packet withholds (`llm-evidence/location.ts`).
 */
function resetToken(snapshot: unknown): JsonObject | undefined {
  const written = isRecord(snapshot) ? snapshot.url : undefined;
  // Undefined for an address that does not parse, is not HTTP(S) or carries credentials; after it, `new URL` cannot throw.
  const screened = typeof written === "string" ? screenedEvidenceUrl(written) : undefined;
  if (screened === undefined) return undefined;
  const location = new URL(written as string).href;
  return screened === location ? { location } : undefined;
}

/** A web output node, or a recorded action whose `outputId` names a web output. Nothing else acts on a page. */
function actsOnPage(node: { definitionId: string; parameterValues?: JsonObject }): boolean {
  if (WEB_AUTOMATION_NODE_IDS.has(node.definitionId)) return true;
  const outputId = node.parameterValues?.outputId;
  return node.definitionId === POLICY_ACTION_DEFINITION_ID && typeof outputId === "string" && WEB_AUTOMATION_OUTPUT_IDS.has(outputId);
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
