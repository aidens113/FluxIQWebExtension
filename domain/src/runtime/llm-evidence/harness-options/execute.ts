// What each runtime harness option actually does to the page.
//
// Five actions, in increasing order of what they are allowed to do: inspect
// observes; wait observes again after a bounded pause; reveal uncovers
// structure through one narrowly safe disclosure; act dismisses or switches a
// view through the semantic ladder in `safety.ts`; navigate moves, but only
// where Core's scope policy says it may. Form entry, option selection and
// submission are absent here as they are absent from the authoring tools, and
// for a stronger reason: this runs while a real workflow is mid-failure, so a
// wrong click is a side effect on somebody's live account.
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
import { currentElementForReturnedTarget, safeRevealElement } from "../reveal";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { recoverable, RecoverableToolRejection, toolRejection } from "../tool-rejection";
import { boundedIdentifier } from "../untrusted-json";
import { webLlmToolRejectionResultCode, WEB_LLM_ACTION_RESULT_CODE, WEB_LLM_INSPECT_RESULT_CODE } from "../vocabulary";
import { webRecoverySafeActionVerdict } from "./safety";
import {
  webAutomationExplorationScope,
  WEB_RECOVERY_ACT_OPTION_ID,
  WEB_RECOVERY_INSPECT_OPTION_ID,
  WEB_RECOVERY_NAVIGATE_OPTION_ID,
  WEB_RECOVERY_REVEAL_OPTION_ID,
  WEB_RECOVERY_WAIT_OPTION_ID,
  type WebRecoveryHarnessOptionId
} from "./vocabulary";

/** A bounded pause, so a page that is still settling gets one chance to settle. */
export const WEB_RECOVERY_WAIT_BOUNDS = Object.freeze({ minMs: 100, maxMs: 5_000, defaultMs: 1_000 });

export type WebRecoveryHarnessContext = {
  gateway: WebLlmEvidenceGateway;
  /** Core's policy, compared against opaque scope strings this domain supplies. */
  scopePolicy: AutomationStudioExplorationScopePolicy;
  /** Injectable so a test does not spend real seconds proving a bounded wait. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

/** One implementation per option id, sharing the handles this exploration has issued. */
export function webRecoveryHarnessImplementations(context: WebRecoveryHarnessContext): Record<WebRecoveryHarnessOptionId, AutomationStudioHarnessOptionImplementation> {
  const returned = new Map<string, WebLlmSnapshotBinding>();
  const sleep = context.sleep ?? defaultSleep;
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
      return toolExecution(remember(returned, input, await capture(context, input)).evidence, false, WEB_LLM_INSPECT_RESULT_CODE);
    }),
    [WEB_RECOVERY_REVEAL_OPTION_ID]: run(async (input) => {
      const target = targetHandle(input.request.value);
      const current = await capture(context, input);
      const element = currentElementForReturnedTarget(returned.get(input.scopeKey), current, target);
      // The reveal allowlist is narrower than the action ladder and stays as it
      // is: a disclosure, a tab, a menu item, and nothing else.
      if (!safeRevealElement(element)) recoverable("target_unsafe");
      return await clickAndReport(context, input, current, element.selector, returned);
    }),
    [WEB_RECOVERY_ACT_OPTION_ID]: run(async (input) => {
      const target = targetHandle(input.request.value);
      const current = await capture(context, input);
      const element = currentElementForReturnedTarget(returned.get(input.scopeKey), current, target);
      const verdict = webRecoverySafeActionVerdict(element, current.evidence);
      if (!verdict.ok) recoverable(verdict.code);
      return await clickAndReport(context, input, current, element.selector, returned);
    }),
    [WEB_RECOVERY_WAIT_OPTION_ID]: run(async (input) => {
      const waitMs = boundedWait(input.request.value);
      const before = await capture(context, input);
      await sleep(waitMs, input.request.signal);
      assertActive(input.request.signal);
      const after = await capture(context, input);
      // Nothing moved, so the wait bought nothing. Saying so is the point: a
      // packet identical to the last one reads to a model as fresh evidence.
      if (sameEvidence(before, after)) recoverable("no_progress");
      return toolExecution(remember(returned, input, after).evidence, false, WEB_LLM_INSPECT_RESULT_CODE);
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
      return toolExecution(remember(returned, input, moved).evidence, true, WEB_LLM_ACTION_RESULT_CODE);
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

async function clickAndReport(
  context: WebRecoveryHarnessContext,
  input: Handled,
  current: WebLlmSnapshotBinding,
  selector: string,
  returned: Map<string, WebLlmSnapshotBinding>
): Promise<WebLlmEvidenceToolExecution> {
  const after = await actAndCapture(context.gateway, input.sessionId, input.request, "web.dom.click", { selector }, current, input.request.signal);
  if (sameEvidence(current, after)) recoverable("no_progress");
  return toolExecution(remember(returned, input, after).evidence, true, WEB_LLM_ACTION_RESULT_CODE);
}

function remember(returned: Map<string, WebLlmSnapshotBinding>, input: Handled, binding: WebLlmSnapshotBinding): WebLlmSnapshotBinding {
  returned.set(input.scopeKey, binding);
  return binding;
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
