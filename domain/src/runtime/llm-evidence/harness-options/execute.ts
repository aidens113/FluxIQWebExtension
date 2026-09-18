// What each runtime harness option actually does to the page.
//
// Five actions: inspect observes; detect observes the repeating structure a
// scrape reads, exactly as the authoring detection does (`../structure/`);
// wait observes again after a bounded pause; press presses one observed
// control, through the same `../press.ts` the authoring tool uses; navigate
// moves, but only where Core's scope policy says it may. Form entry and option
// selection are absent here as they are from the authoring tools.
//
// Press refuses nothing on its own judgement of what a control looks like.
// This runs while a real workflow is mid-failure, on somebody's live account,
// which is exactly why the answer to a lasting press is permission carried by
// Core and put to the person -- not a word list here. That seam is marked in
// `../press.ts`; until Core carries it, press presses.
//
// A target handle is bound only through a packet this exploration returned,
// never through a capture the model was not shown. Every packet returned is
// also handed to the runtime's selector retention, so a repair that names one
// of its handles -- Core writes it `explored.N:target.M` and strips the
// qualifier before asking -- gets the selector hint behind exactly that
// control.
//
// Every refusal returns a bare code. A refusal must never become a side channel
// for the page content the refusal was protecting.

import type { AutomationStudioExplorationScopePolicy, AutomationStudioHarnessOptionExecution, AutomationStudioHarnessOptionImplementation } from "fluxiq/automation-studio";
import { automationStudioExplorationScopeAllows } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import {
  actAndCapture,
  assertActive,
  captureEvidence,
  selectSession,
  toolExecution,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution,
  type WebLlmEvidenceToolRequest
} from "../capture";
import { present } from "../present";
import { evidenceLocation, safeEvidenceUrl } from "../location";
import { currentElementForReturnedTarget, pressControl } from "../press";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { detectRepeatingStructure, type WebLlmExtractionHandles } from "../structure";
import { recoverable, RecoverableToolRejection, toolRejection } from "../tool-rejection";
import { boundedIdentifier } from "../untrusted-json";
import { webLlmToolRejectionResultCode, WEB_LLM_ACTION_RESULT_CODE, WEB_LLM_INSPECT_RESULT_CODE } from "../vocabulary";
import { webAutomationExplorationScope } from "./exploration-terms";
import {
  WEB_RECOVERY_DETECT_OPTION_ID,
  WEB_RECOVERY_INSPECT_OPTION_ID,
  WEB_RECOVERY_NAVIGATE_OPTION_ID,
  WEB_RECOVERY_PRESS_OPTION_ID,
  WEB_RECOVERY_WAIT_OPTION_ID,
  type WebRecoveryHarnessOptionId
} from "./vocabulary";

/** A bounded pause, so a page that is still settling gets one chance to settle. */
export const WEB_RECOVERY_WAIT_BOUNDS = Object.freeze({ minMs: 100, maxMs: 5_000, defaultMs: 1_000 });

export type WebRecoveryHarnessContext = {
  gateway: WebLlmEvidenceGateway;
  /** Core's policy, compared against opaque scope strings this domain supplies. */
  scopePolicy: AutomationStudioExplorationScopePolicy;
  /**
   * The runtime's selector retention, handed every packet an option returns.
   * Core asks the target check about an explored packet without saying where
   * it came from, so the selectors behind its handles must already be where
   * that check looks. Required: a bundle that retained nothing would resolve
   * every explored repair without its hint, and nothing would say so.
   */
  retainSelectors: (binding: WebLlmSnapshotBinding) => unknown;
  /**
   * The runtime's extraction-handle store, shared with authoring, so a handle a
   * recovery's detection issued resolves through `resolveExtractionHandle` and
   * the plan resolver for the same project and Flow.
   */
  extractionHandles: WebLlmExtractionHandles;
  /** Injectable so a test does not spend real seconds proving a bounded wait. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

/** One implementation per option id, sharing the handles this exploration has issued. */
export function webRecoveryHarnessImplementations(context: WebRecoveryHarnessContext): Record<WebRecoveryHarnessOptionId, AutomationStudioHarnessOptionImplementation> {
  const returned = new Map<string, WebLlmSnapshotBinding>();
  const sleep = context.sleep ?? defaultSleep;
  // Every packet an option hands the model: the one a later target is bound
  // through, and one the repair check can find the selectors of.
  const shown = (input: Handled, binding: WebLlmSnapshotBinding): WebLlmSnapshotBinding => {
    returned.set(input.scopeKey, binding);
    context.retainSelectors(binding);
    return binding;
  };
  // The packet a target handle was copied from. Before this exploration has
  // shown one, no handle can have been, whatever the current page numbers.
  const shownPacket = (input: Handled): WebLlmSnapshotBinding => returned.get(input.scopeKey) ?? recoverable("target_unobserved");
  const run = (handler: (input: Handled) => Promise<WebLlmEvidenceToolExecution>): AutomationStudioHarnessOptionImplementation =>
    async (execution) => {
      const handled = prepare(context, execution);
      try {
        return await handler(handled);
      } catch (error) {
        if (error instanceof RecoverableToolRejection) return toolExecution(toolRejection(error.code), false, webLlmToolRejectionResultCode(error.code));
        throw error;
      }
    };

  return {
    [WEB_RECOVERY_INSPECT_OPTION_ID]: run(async (input) => {
      exactKeys(input.request.value, []);
      return toolExecution(shown(input, await capture(context, input)).evidence, false, WEB_LLM_INSPECT_RESULT_CODE);
    }),
    [WEB_RECOVERY_PRESS_OPTION_ID]: run(async (input) => {
      const target = targetHandle(input.request.value);
      const observed = shownPacket(input);
      const current = await capture(context, input);
      const element = currentElementForReturnedTarget(observed, current, target);
      const pressed = await pressControl({
        gateway: context.gateway,
        sessionId: input.sessionId,
        request: input.request,
        current,
        element,
        // The recovery options number each capture as it comes; only authoring
        // holds handles stable across captures of one page.
        restamp: (binding) => binding
      });
      return toolExecution(shown(input, pressed).evidence, true, WEB_LLM_ACTION_RESULT_CODE);
    }),
    // The authoring detection, bound through this exploration's packets and
    // keeping its handle in the runtime's store. It returns a structure packet,
    // not a page, so nothing is shown or retained: no target check reads one.
    [WEB_RECOVERY_DETECT_OPTION_ID]: run(async (input) => await detectRepeatingStructure({
      gateway: context.gateway,
      sessionId: input.sessionId,
      request: input.request,
      returned: Object.prototype.hasOwnProperty.call(input.request.value, "target") ? shownPacket(input) : undefined,
      handles: context.extractionHandles
    })),
    [WEB_RECOVERY_WAIT_OPTION_ID]: run(async (input) => {
      const waitMs = boundedWait(input.request.value);
      const before = await capture(context, input);
      await sleep(waitMs, input.request.signal);
      assertActive(input.request.signal);
      const after = await capture(context, input);
      // Nothing moved, so the wait bought nothing. Saying so is the point: a
      // packet identical to the last one reads to a model as fresh evidence.
      if (sameEvidence(before, after)) recoverable("no_progress");
      return toolExecution(shown(input, after).evidence, false, WEB_LLM_INSPECT_RESULT_CODE);
    }),
    [WEB_RECOVERY_NAVIGATE_OPTION_ID]: run(async (input) => {
      exactKeys(input.request.value, ["url"]);
      const current = await capture(context, input);
      const destination = requestedUrl(input.request.value.url);
      // Core decides; this only says what "where" means here.
      if (!automationStudioExplorationScopeAllows(context.scopePolicy, {
        currentScope: webAutomationExplorationScope(current.evidence.location),
        requestedScope: webAutomationExplorationScope(destination.href)
      })) recoverable("out_of_scope");
      if (evidenceLocation(destination) === current.evidence.location) recoverable("no_progress");
      // The recapture asserts it landed in the scope the policy allowed, not in
      // the one it started from: this is the one option permitted to move.
      const moved = await actAndCapture(context.gateway, input.sessionId, input.request, "web.browser.navigate", { url: destination.href }, current, input.request.signal, webAutomationExplorationScope(destination.href));
      return toolExecution(shown(input, moved).evidence, true, WEB_LLM_ACTION_RESULT_CODE);
    })
  };
}

type Handled = { sessionId: string; scopeKey: string; request: WebLlmEvidenceToolRequest };

function prepare(context: WebRecoveryHarnessContext, execution: AutomationStudioHarnessOptionExecution): Handled {
  assertActive(execution.signal);
  boundedIdentifier(execution.projectId, "projectId");
  boundedIdentifier(execution.flowId, "flowId");
  boundedIdentifier(execution.callId, "callId");
  const sessionId = selectSession(context.gateway.eligibleSessionIds());
  return {
    sessionId,
    scopeKey: `${sessionId}|${execution.projectId}|${execution.flowId}`,
    request: present<WebLlmEvidenceToolRequest>({
      projectId: execution.projectId,
      flowId: execution.flowId,
      callId: execution.callId,
      toolId: execution.optionId,
      value: execution.value,
      maxEvidenceBytes: execution.maxEvidenceBytes,
      signal: execution.signal
    })
  };
}

async function capture(context: WebRecoveryHarnessContext, input: Handled): Promise<WebLlmSnapshotBinding> {
  return await captureEvidence(context.gateway, input.sessionId, input.request, input.request.signal);
}

function sameEvidence(left: WebLlmSnapshotBinding, right: WebLlmSnapshotBinding): boolean {
  return JSON.stringify(left.evidence) === JSON.stringify(right.evidence);
}

function boundedWait(value: JsonObject): number {
  exactKeys(value, ["maxWaitMs"]);
  const requested = value.maxWaitMs;
  if (typeof requested !== "number" || !Number.isFinite(requested)) recoverable("invalid_input");
  return Math.min(Math.max(Math.trunc(requested), WEB_RECOVERY_WAIT_BOUNDS.minMs), WEB_RECOVERY_WAIT_BOUNDS.maxMs);
}

function targetHandle(value: JsonObject): string {
  exactKeys(value, ["target"]);
  const target = value.target;
  if (typeof target !== "string" || !/^target\.[1-9][0-9]?$/u.test(target)) recoverable("invalid_input");
  return target;
}

function requestedUrl(input: unknown): URL {
  try {
    return safeEvidenceUrl(input);
  } catch {
    return recoverable("invalid_input");
  }
}

function exactKeys(value: JsonObject, allowed: string[]): void {
  const keys = new Set(allowed);
  if (Object.keys(value).some((key) => !keys.has(key)) || allowed.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) recoverable("invalid_input");
}

async function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
    signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}
