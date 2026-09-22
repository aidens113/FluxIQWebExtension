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
//  - **A snapshot is bounded by the sanitized packet's own byte budget.**
//    `sanitizeWebLlmSnapshot` is what already decides how much page evidence may
//    travel, and it drops values and sensitive controls on the way. Reusing it
//    means a state ref cannot carry more, or more sensitive, page data than the
//    LLM packet may.
//  - **Snapshots are not stored here.** Core hands both refs back to
//    `inspectStateDiff`, so the diff reads the summaries it was given. A cache
//    keyed by `stateRef` would be a second copy of state Core already holds.

import type { FluxIQ } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_ACTION_TYPES } from "../actions/types";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { dispatchWebAutomationOutput } from "../io/gateway-output-dispatcher";
import { webAutomationOutputNodeId } from "../output-nodes";
import { createWebAutomationExpectationEvaluator, type WebAutomationExpectationDispatch } from "./expectation";
import { sanitizeWebLlmSnapshot } from "./llm-evidence";
import { WEB_AUTOMATION_ROUTE_STATE_PATHS, webAutomationRouteState } from "./route-state";

/**
 * Core's `AutomationStudioHostRuntimeBoundary`. Core does not put the type on
 * its public entry, so it is read off the method that consumes it rather than
 * restated here, where a copy would silently drift.
 */
export type WebAutomationHostRuntimeBoundary = Parameters<FluxIQ["programs"]["automationStudio"]["bindHostRuntime"]>[0];

/**
 * How the boundary reaches the paired browser; the expectation evaluator
 * shares it. Host-state captures add the same finite command bound as an
 * ordinary policy action, so a silent browser cannot strand a Flow run.
 */
type WebAutomationHostRuntimeDispatch = (
  request: Parameters<WebAutomationExpectationDispatch>[0] & { timeoutMs?: number }
) => ReturnType<WebAutomationExpectationDispatch>;
export type WebAutomationHostRuntimeGateway = { dispatch: WebAutomationHostRuntimeDispatch };

/** `web-state-diff.v1`, the shape `stateRefs.stateDiff` carries for a web attempt. */
export const WEB_STATE_DIFF_SCHEMA_VERSION = "web-state-diff.v2" as const;

const SNAPSHOT_OUTPUT_ID = "web.dom.capture_snapshot";
const HOST_RUNTIME_SOURCE = "web-automation-host-runtime";
/** Matches Core's default `builtin.policy.action` command timeout. */
const HOST_STATE_COMMAND_TIMEOUT_MS = 5_000;

/** At most this many elements are listed on each side of a diff; the counts stay exact. */
const MAX_DIFF_ELEMENTS = 10;

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
const HOST_RUNTIME_CAPABILITIES = Object.freeze(["action-dispatch", "state-snapshot", "state-diff", "expectation-evaluation", "route-state"] as const);

export function createWebAutomationHostRuntime(gateway: WebAutomationHostRuntimeGateway): WebAutomationHostRuntimeBoundary {
  const evaluate = createWebAutomationExpectationEvaluator(gateway.dispatch);
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
      const summary = sanitizeWebLlmSnapshot(actionSnapshot(result.payload)) as unknown as JsonObject;
      captures += 1;
      const stateSnapshotId = `web.state.${captures}`;
      return { stateSnapshotId, stateRef: `${stateSnapshotId}@${input.attemptId}:${input.point}`, capturedAt: Date.now(), summary };
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
    inspectStateDiff(input) {
      if (input.before?.summary === undefined || input.after?.summary === undefined) {
        throw new Error("A web state diff needs a snapshot on both sides, so none was computed.");
      }
      return webAutomationStateDiff(input.before?.summary, input.after?.summary, input.before?.stateRef, input.after?.stateRef);
    },
    expectationEvaluator: (conditions, mode, timeoutMs, context) => evaluate(conditions, mode, timeoutMs, context)
  };
}

/** Binds the boundary onto the running FluxIQ instance, beside the runtime service. */
export function bindWebAutomationHostRuntime(fluxiq: FluxIQ): void {
  fluxiq.programs.automationStudio.bindHostRuntime(createWebAutomationHostRuntime({
    dispatch: (request) => dispatchWebAutomationOutput(fluxiq, { domainId: WEB_AUTOMATION_DOMAIN_ID, ...request })
  }));
}

/**
 * What changed between two bounded page summaries: where the browser is, what
 * the document is called, and which interactive elements appeared or left.
 *
 * `.v2` identifies an element by what it is and what it is called rather than
 * by a selector. The packet stopped carrying selectors when they stopped being
 * something a language model may read, and the opaque handle that replaced them
 * is positional -- `target.1` names the first element of whichever capture it
 * came from, so diffing handles would report that nothing ever changes. What is
 * listed is still element identity rather than page content, so the diff says
 * what moved without restating what the page says.
 */
export function webAutomationStateDiff(
  before: JsonObject | undefined,
  after: JsonObject | undefined,
  beforeStateRef?: string,
  afterStateRef?: string
): JsonObject {
  const beforeElements = evidenceElements(before);
  const afterElements = evidenceElements(after);
  const beforeKeys = new Set(beforeElements.map(elementKey));
  const afterKeys = new Set(afterElements.map(elementKey));
  const added = afterElements.filter((element) => !beforeKeys.has(elementKey(element)));
  const removed = beforeElements.filter((element) => !afterKeys.has(elementKey(element)));
  const beforeLocation = evidenceText(before, "location");
  const afterLocation = evidenceText(after, "location");
  return {
    schemaVersion: WEB_STATE_DIFF_SCHEMA_VERSION,
    ...(beforeStateRef === undefined ? {} : { beforeStateRef }),
    ...(afterStateRef === undefined ? {} : { afterStateRef }),
    ...(beforeLocation === undefined ? {} : { beforeLocation }),
    ...(afterLocation === undefined ? {} : { afterLocation }),
    locationChanged: beforeLocation !== undefined && afterLocation !== undefined && beforeLocation !== afterLocation,
    titleChanged: evidenceText(before, "title") !== evidenceText(after, "title"),
    beforeElementCount: beforeElements.length,
    afterElementCount: afterElements.length,
    addedElementCount: added.length,
    removedElementCount: removed.length,
    addedElements: added.slice(0, MAX_DIFF_ELEMENTS),
    removedElements: removed.slice(0, MAX_DIFF_ELEMENTS)
  };
}

/** The DOM snapshot inside a dispatched action's wrapped result payload. */
function actionSnapshot(payload: JsonObject | undefined): unknown {
  const action = payload?.result;
  return isRecord(action) ? action.snapshot : undefined;
}

/** A web output node, or a recorded action whose `outputId` names a web output. Nothing else acts on a page. */
function actsOnPage(node: { definitionId: string; parameterValues?: JsonObject }): boolean {
  if (WEB_AUTOMATION_NODE_IDS.has(node.definitionId)) return true;
  const outputId = node.parameterValues?.outputId;
  return node.definitionId === POLICY_ACTION_DEFINITION_ID && typeof outputId === "string" && WEB_AUTOMATION_OUTPUT_IDS.has(outputId);
}

/**
 * How an element is identified across two captures: by what it is and what it
 * is called. Never by the opaque handle, which is positional and would make
 * every element look unchanged, and never by a selector, which the packet no
 * longer carries.
 */
type WebStateDiffElement = { tag: string; role?: string; name?: string; text?: string; form?: string };

function evidenceElements(summary: JsonObject | undefined): WebStateDiffElement[] {
  const elements = summary?.elements;
  if (!Array.isArray(elements)) return [];
  const described: WebStateDiffElement[] = [];
  for (const element of elements) {
    if (!isRecord(element) || typeof element.tag !== "string" || !element.tag) continue;
    described.push({
      tag: element.tag,
      ...(typeof element.role === "string" ? { role: element.role } : {}),
      ...(typeof element.name === "string" ? { name: element.name } : {}),
      ...(typeof element.text === "string" ? { text: element.text } : {}),
      ...(typeof element.form === "string" ? { form: element.form } : {})
    });
  }
  return described;
}

function elementKey(element: WebStateDiffElement): string {
  return JSON.stringify([element.tag, element.role, element.name, element.text, element.form]);
}

function evidenceText(summary: JsonObject | undefined, field: string): string | undefined {
  const value = summary?.[field];
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
