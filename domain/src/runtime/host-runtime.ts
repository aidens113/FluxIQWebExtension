// The web-automation host runtime: the object Core asks about page state.
//
// Core's executor calls `captureStateSnapshot` at `before_action`,
// `after_action`, `after_wait_retry` and `after_patch_test`, hands the two refs
// back to `inspectStateDiff`, and stores the result on the attempt as
// `stateRefs`. Nothing downstream had ever bound the boundary, so every web
// attempt reached the trace with no state at all and Core's adaptive layer had
// nothing to compare. This module binds it.
//
// The same object carries `expectationEvaluator`. Core deliberately put the
// evaluator on the boundary rather than adding a second binding call, so a host
// that binds a runtime gets the evaluator with it and there is nothing to
// forget; see the Core report `core-expectation-evaluator.md`.
//
// Three decisions worth knowing:
//
//  - **Only web nodes are snapshotted.** `captureStateSnapshot` runs for every
//    node attempt in every Flow, including LLM, code and router nodes. A page
//    snapshot around a node that never touched the page is noise, and it costs
//    a gateway round trip each time, so the boundary declines a node whose
//    definition is not a web output node. The seam has no way to say "not this
//    one" other than to throw, and Core catches, which is why declining looks
//    like a rejection here.
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

/**
 * Core's `AutomationStudioHostRuntimeBoundary`. Core does not put the type on
 * its public entry, so it is read off the method that consumes it rather than
 * restated here, where a copy would silently drift.
 */
export type WebAutomationHostRuntimeBoundary = Parameters<FluxIQ["programs"]["automationStudio"]["bindHostRuntime"]>[0];

/** How the boundary reaches the paired browser; the expectation evaluator shares it. */
export type WebAutomationHostRuntimeGateway = { dispatch: WebAutomationExpectationDispatch };

/** `web-state-diff.v1`, the shape `stateRefs.stateDiff` carries for a web attempt. */
export const WEB_STATE_DIFF_SCHEMA_VERSION = "web-state-diff.v1" as const;

const SNAPSHOT_OUTPUT_ID = "web.dom.capture_snapshot";
const HOST_RUNTIME_SOURCE = "web-automation-host-runtime";

/** At most this many selectors are listed on each side of a diff; the counts stay exact. */
const MAX_DIFF_SELECTORS = 10;

/**
 * Derived from the action vocabulary rather than from the `web.output.` string,
 * so a new action type is covered the day it is registered.
 */
const WEB_AUTOMATION_NODE_IDS: ReadonlySet<string> = new Set(WEB_AUTOMATION_ACTION_TYPES.map(webAutomationOutputNodeId));

/** What this host can answer, in Core's capability vocabulary. */
const HOST_RUNTIME_CAPABILITIES = Object.freeze(["state-snapshot", "state-diff", "expectation-evaluation"] as const);

export function createWebAutomationHostRuntime(gateway: WebAutomationHostRuntimeGateway): WebAutomationHostRuntimeBoundary {
  const evaluate = createWebAutomationExpectationEvaluator(gateway.dispatch);
  let captures = 0;
  return {
    capabilities: HOST_RUNTIME_CAPABILITIES,
    async captureStateSnapshot(input) {
      if (!WEB_AUTOMATION_NODE_IDS.has(input.node.definitionId)) {
        throw new Error(`Node ${input.node.definitionId} does not act on a page, so no web state was captured.`);
      }
      const result = await gateway.dispatch({
        outputId: SNAPSHOT_OUTPUT_ID,
        payload: {},
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
    inspectStateDiff(input) {
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
 * the document is called, and which interactive selectors appeared or left.
 * Selectors are element identity, not page content, so the diff says what moved
 * without restating what the page says.
 */
export function webAutomationStateDiff(
  before: JsonObject | undefined,
  after: JsonObject | undefined,
  beforeStateRef?: string,
  afterStateRef?: string
): JsonObject {
  const beforeSelectors = evidenceSelectors(before);
  const afterSelectors = evidenceSelectors(after);
  const added = afterSelectors.filter((selector) => !beforeSelectors.includes(selector));
  const removed = beforeSelectors.filter((selector) => !afterSelectors.includes(selector));
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
    beforeElementCount: beforeSelectors.length,
    afterElementCount: afterSelectors.length,
    addedElementCount: added.length,
    removedElementCount: removed.length,
    addedSelectors: added.slice(0, MAX_DIFF_SELECTORS),
    removedSelectors: removed.slice(0, MAX_DIFF_SELECTORS)
  };
}

/** The DOM snapshot inside a dispatched action's wrapped result payload. */
function actionSnapshot(payload: JsonObject | undefined): unknown {
  const action = payload?.result;
  return isRecord(action) ? action.snapshot : undefined;
}

function evidenceSelectors(summary: JsonObject | undefined): string[] {
  const elements = summary?.elements;
  if (!Array.isArray(elements)) return [];
  return elements
    .map((element) => (isRecord(element) && typeof element.selector === "string" ? element.selector : undefined))
    .filter((selector): selector is string => selector !== undefined);
}

function evidenceText(summary: JsonObject | undefined, field: string): string | undefined {
  const value = summary?.[field];
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
