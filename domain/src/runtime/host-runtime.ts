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
// Four decisions worth knowing:
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
//  - **Snapshots are not stored here.** Core hands both refs back to
//    `inspectStateDiff`, so the diff reads the summaries it was given. A cache
//    keyed by `stateRef` would be a second copy of state Core already holds.

import type { FluxIQ } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_ACTION_TYPES } from "../actions/types";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { dispatchWebAutomationOutput } from "../io/gateway-output-dispatcher";
import { webAutomationOutputNodeId } from "../output-nodes";
import { webAutomationActLanded } from "./act-landing";
import { createWebAutomationExpectationEvaluator, type WebAutomationExpectationDispatch } from "./expectation";
import { createWebAutomationFactEvaluator, type WebAutomationFactEvaluator } from "./facts";
import { publishedWebLlmPage, sanitizeWebLlmSnapshot, screenedEvidenceUrl } from "./llm-evidence";
import {
  compareWebAutomationRouteSignatures,
  WEB_AUTOMATION_ROUTE_STATE_PATHS,
  webAutomationRouteEffect,
  webAutomationRouteEffectHolds,
  webAutomationRouteSignature,
  webAutomationRouteState
} from "./route-state";
import { webAutomationStateDiff } from "./state-diff";

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
export type WebAutomationHostRuntime = WebAutomationHostRuntimeBoundary & { factEvaluator: WebAutomationFactEvaluator };

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

export function createWebAutomationHostRuntime(gateway: WebAutomationHostRuntimeGateway): WebAutomationHostRuntime {
  const evaluate = createWebAutomationExpectationEvaluator(gateway.dispatch);
  const factEvaluator = createWebAutomationFactEvaluator(gateway.dispatch);
  let captures = 0;
  return {
    capabilities: HOST_RUNTIME_CAPABILITIES,
    async captureStateSnapshot(input) {
      if (!actsOnPage(input.node)) {
        throw new Error(`Node ${input.node.definitionId} does not act on a page, so no web state was captured.`);
      }
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
      const packet = sanitizeWebLlmSnapshot(snapshot);
      const documentTimeOrigin = packet.navigation?.timeOrigin;
      const summary = {
        ...publishedWebLlmPage(packet),
        ...(documentTimeOrigin === undefined ? {} : { documentTimeOrigin })
      } as unknown as JsonObject;
      captures += 1;
      const stateSnapshotId = `web.state.${captures}`;
      const from = resetToken(snapshot);
      return { stateSnapshotId, stateRef: `${stateSnapshotId}@${input.attemptId}:${input.point}`, capturedAt: Date.now(), summary, ...(from ? { from } : {}) };
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
    inspectStateDiff(input) {
      if (input.before?.summary === undefined || input.after?.summary === undefined) {
        throw new Error("A web state diff needs a snapshot on both sides, so none was computed.");
      }
      return webAutomationStateDiff(input.before?.summary, input.after?.summary, input.before?.stateRef, input.after?.stateRef);
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
  }));
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
