// What each runtime harness option actually does to the page.
//
// Six actions: describe prints one element in full, as the authoring tool does
// (`../page-find/`); detect observes the repeating structure a scrape reads,
// exactly as the authoring detection does (`../structure/`); wait observes
// again after a bounded pause; press presses one observed control, through the
// same `../press.ts` the authoring tool uses; navigate moves, but only where
// Core's scope policy says it may. Form entry and option selection share one
// inferred field-entry action with authoring. There is no look (t1042): a
// navigate with no address -- Core's opening call, which the model is never
// offered -- captures the page where it stands, and every result carries the
// page through Core's page channel.
//
// **Every capture is numbered by the run's stable handles (t1042)**, as every
// authoring capture is (`../stable-handles.ts`): an element keeps its handle
// across this exploration's captures and pages, the same handle `core.full_page`
// prints for it, so the channel sends only the lines that changed, and a handle
// the page now still gives to an element binds to it there
// (`../structure/held-now.ts`). Until t1042 each capture numbered its own
// elements, so every press renumbered the page.
//
// Press refuses nothing on its own judgement of what a control looks like.
// This runs while a real workflow is mid-failure, on somebody's live account,
// which is exactly why the answer to a lasting press is permission carried by
// Core and put to the person -- not a word list here. That seam is marked in
// `../press.ts`; until Core carries it, press presses.
//
// A target handle is bound through a packet this exploration returned, or the
// page as it is now where that still gives the handle to an element; never
// before this exploration has shown a page at all. Every packet returned is
// also handed to the runtime's retention, so a repair that names one of its
// handles -- Core writes it `explored.N:tM` and strips the qualifier before
// asking -- finds the structured packet and the selector hint behind exactly
// that control. What the model is handed is the compact view of the packet
// (`web-llm-page.v3`, `../page-view/`), and the retention is keyed by it.
//
// A robot check met by any option -- a look of one, a press or an entry that
// raises one, a navigation that lands on one -- comes back marked
// `personNeeded`, exactly as the authoring tools mark theirs, so Core hands it
// to the person and no repair model ever sees it.
//
// A refusal says why it refused, and never more than that: one closed reason,
// the handle the call named, and the keys the tool's own schema declares. A
// refusal must never become a side channel for the page content the refusal was
// protecting, which is what `../tool-rejection.ts` bounds.

import type { AutomationStudioExplorationScopePolicy, AutomationStudioHarnessOptionExecution, AutomationStudioHarnessOptionImplementation } from "fluxiq/automation";
import { automationStudioExplorationScopeAllows } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import { enterWebField } from "../enter-field";
import {
  actAndCapture,
  assertActive,
  captureEvidence,
  selectSession,
  toolExecution,
  withPersonNeeded,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution,
  type WebLlmEvidenceToolRequest
} from "../capture";
import { webLlmDescribeElement } from "../page-find";
import { publishedWebLlmPage } from "../page-view";
import { present } from "../present";
import { evidenceLocation, safeEvidenceUrl } from "../location";
import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import { currentElementForReturnedTarget, pressControl } from "../press";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { detectRepeatingStructure, type WebLlmExtractionHandles } from "../structure";
import { recoverable, RecoverableToolRejection, rejectionDetail, toolRejection } from "../tool-rejection";
import { boundedIdentifier } from "../untrusted-json";
import { webLlmToolRejectionResultCode, WEB_LLM_ACTION_RESULT_CODE, WEB_LLM_INSPECT_RESULT_CODE } from "../vocabulary";
import { webAutomationExplorationScope } from "./exploration-terms";
import {
  WEB_RECOVERY_DESCRIBE_OPTION_ID,
  WEB_RECOVERY_DETECT_OPTION_ID,
  WEB_RECOVERY_ENTER_FIELD_OPTION_ID,
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
  retainSelectors: (binding: WebLlmSnapshotBinding, shownAs?: JsonObject) => unknown;
  /**
   * The runtime's extraction-handle store, shared with authoring, so a handle a
   * recovery's detection issued resolves through `resolveExtractionHandle` and
   * the plan resolver for the same project and Flow.
   */
  extractionHandles: WebLlmExtractionHandles;
  /**
   * The run's stable handles (`../stable-handles.ts`), shared with authoring:
   * every capture an option takes is numbered by them (header). Required: a
   * bundle that numbered its own captures would print handles `core.full_page`
   * does not, and renumber the page on every press.
   */
  restamp: (scope: { projectId: string; flowId: string }, binding: WebLlmSnapshotBinding) => WebLlmSnapshotBinding;
  /** Injectable so a test does not spend real seconds proving a bounded wait. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

/** One implementation per option id, sharing the handles this exploration has issued. */
export function webRecoveryHarnessImplementations(context: WebRecoveryHarnessContext): Record<WebRecoveryHarnessOptionId, AutomationStudioHarnessOptionImplementation> {
  const returned = new Map<string, WebLlmSnapshotBinding>();
  const sleep = context.sleep ?? defaultSleep;
  // Every packet an option hands the model: the one a later target is bound
  // through, and one the repair check can find the selectors of.
  // A search or a description is retained under the result the model read
  // (`shownAs`), so a repair naming a handle from it finds the packet behind it.
  const shown = (input: Handled, binding: WebLlmSnapshotBinding, shownAs?: JsonObject): WebLlmSnapshotBinding => {
    returned.set(input.scopeKey, binding);
    context.retainSelectors(binding, shownAs);
    return binding;
  };
  // The packet a target handle was copied from. Before this exploration has
  // shown one, no handle can have been, whatever the current page numbers.
  const shownPacket = (input: Handled): WebLlmSnapshotBinding => returned.get(input.scopeKey)
    ?? recoverable("target_unobserved", rejectionDetail({ reason: "nothing_observed_yet", target: undefined, instead: undefined, missing: undefined, requestId: undefined }));
  const run = (handler: (input: Handled) => Promise<WebLlmEvidenceToolExecution>): AutomationStudioHarnessOptionImplementation =>
    async (execution) => {
      const handled = prepare(context, execution);
      try {
        return await handler(handled);
      } catch (error) {
        if (error instanceof RecoverableToolRejection) {
          // A refusal the page caused carries the page, shown like any packet
          // so its handles can be pressed next (`../capture.ts`).
          const page = error.page === undefined ? undefined : shown(handled, numbered(context, handled, error.page));
          // The reason goes out beside the code as well as inside the evidence:
          // the model reads the evidence, and whoever reads the run afterwards
          // reads the code, and one word for four refusals is what made
          // `run-mug776kx-0214b287` undiagnosable (`../capture.ts`).
          const refused = toolExecution(
            toolRejection(error.code, page?.evidence, error.detail),
            false,
            webLlmToolRejectionResultCode(error.code),
            undefined,
            undefined,
            // A harness option is not a node of the library: it names no
            // catalog id, so there is none to publish, and it resolves no plan
            // node, so there is no assumed name either.
            { resultReason: error.detail?.reason, nodeId: undefined, assumed: undefined },
            error.failure,
            error.actionability
          );
          // A robot check is the person's, never the repair model's: marked,
          // Core puts it to the person and shows the model nothing of it
          // (`AS/runtime/recovery/runtime-exploration.ts`). A recovery option
          // writes no draft, so none stands once the person has cleared it.
          return error.personNeeded ? withPersonNeeded(refused, undefined) : refused;
        }
        throw error;
      }
    };

  return {
    [WEB_RECOVERY_PRESS_OPTION_ID]: run(async (input) => {
      exactKeys(input.request.value, ["target", "consequences"]);
      const target = handleIn(input.request.value);
      const observed = shownPacket(input);
      const current = await capture(context, input);
      const element = currentElementForReturnedTarget(observed, current, target);
      const pressed = await pressControl({
        gateway: context.gateway,
        sessionId: input.sessionId,
        request: input.request,
        current,
        element,
        // The run's stable handles, as every capture here (header).
        restamp: (binding) => numbered(context, input, binding),
        consequences: input.request.value.consequences
      });
      const snapshot = shown(input, pressed.page);
      // Stable handles keep an element's handle, but nothing here proves a
      // target from the decision packet kept its meaning across this action
      // (`../target.ts` does that for authoring), so it stays unclaimed.
      return toolExecution(pageOf(snapshot), true, WEB_LLM_ACTION_RESULT_CODE, false, undefined, undefined, undefined, pressed.actionability);
    }),
    [WEB_RECOVERY_ENTER_FIELD_OPTION_ID]: run(async (input) => {
      exactKeys(input.request.value, ["target", "value"]);
      const target = handleIn(input.request.value);
      const observed = shownPacket(input);
      const current = await capture(context, input);
      const element = currentElementForReturnedTarget(observed, current, target);
      const entered = await enterWebField({
        gateway: context.gateway,
        sessionId: input.sessionId,
        request: input.request,
        current,
        element,
        value: input.request.value.value,
        restamp: (binding) => numbered(context, input, binding)
      });
      const snapshot = shown(input, entered.page);
      return toolExecution(pageOf(snapshot), true, WEB_LLM_ACTION_RESULT_CODE, false, undefined, undefined, undefined, entered.actionability);
    }),
    // The authoring detection, bound through this exploration's packets -- or
    // the page now, where it still gives the handle to an element (`restamp`,
    // `../structure/detect.ts`) -- and keeping its handle in the runtime's store.
    // It returns a structure packet, not a page, so nothing is shown or
    // retained: no target check reads one.
    [WEB_RECOVERY_DETECT_OPTION_ID]: run(async (input) => await detectRepeatingStructure({
      gateway: context.gateway,
      sessionId: input.sessionId,
      request: input.request,
      returned: Object.prototype.hasOwnProperty.call(input.request.value, "target") ? shownPacket(input) : undefined,
      handles: context.extractionHandles,
      restamp: (page) => numbered(context, input, page)
    })),
    // One element of the last packet this exploration showed: a handle means
    // something only against a packet the model was shown, and nothing moves.
    [WEB_RECOVERY_DESCRIBE_OPTION_ID]: run(async (input) => {
      exactKeys(input.request.value, ["target"]);
      const target = handleIn(input.request.value);
      const observed = shownPacket(input);
      const described = webLlmDescribeElement(observed.evidence, target);
      context.retainSelectors(observed, described as unknown as JsonObject);
      return toolExecution(described as unknown as JsonObject, false, WEB_LLM_INSPECT_RESULT_CODE);
    }),
    [WEB_RECOVERY_WAIT_OPTION_ID]: run(async (input) => {
      const waitMs = boundedWait(input.request.value);
      const before = await capture(context, input);
      await sleep(waitMs, input.request.signal);
      assertActive(input.request.signal);
      const after = await capture(context, input);
      // Nothing moved, so the wait bought nothing. Saying so is the point: a
      // packet identical to the last one reads to a model as fresh evidence.
      if (sameEvidence(before, after)) recoverable("no_progress", why("nothing_changed_while_waiting"));
      return toolExecution(pageOf(shown(input, after)), false, WEB_LLM_INSPECT_RESULT_CODE);
    }),
    [WEB_RECOVERY_NAVIGATE_OPTION_ID]: run(async (input) => {
      // Core's opening look, and the look after a person's Continue: no address,
      // which the schema requires of every call the model makes (`./options.ts`).
      // The page where it stands, and nothing moved.
      if (Object.keys(input.request.value).length === 0) return toolExecution(pageOf(shown(input, await capture(context, input))), false, WEB_LLM_INSPECT_RESULT_CODE);
      exactKeys(input.request.value, ["url"]);
      const current = await capture(context, input);
      const destination = requestedUrl(input.request.value.url);
      // Core decides; this only says what "where" means here.
      if (!automationStudioExplorationScopeAllows(context.scopePolicy, {
        currentScope: webAutomationExplorationScope(current.evidence.location),
        requestedScope: webAutomationExplorationScope(destination.href)
      })) recoverable("out_of_scope");
      if (evidenceLocation(destination) === current.evidence.location) recoverable("no_progress", why("already_at_destination"));
      // The recapture asserts it landed in the scope the policy allowed, not in
      // the one it started from: this is the one option permitted to move.
      const moved = await actAndCapture(context.gateway, input.sessionId, input.request, "web.browser.navigate", { url: destination.href }, current, input.request.signal, webAutomationExplorationScope(destination.href));
      return toolExecution(pageOf(shown(input, numbered(context, input, moved.page))), true, WEB_LLM_ACTION_RESULT_CODE, false, undefined, undefined, undefined, moved.actionability);
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
      referenceNow: execution.referenceNow,
      projectId: execution.projectId,
      flowId: execution.flowId,
      callId: execution.callId,
      toolId: execution.optionId,
      value: execution.value,
      signal: execution.signal,
      // These options explore a Flow that is already running and already
      // somewhere. A start location belongs to a build that has not started
      // yet, so there is never one here, and it is named rather than omitted
      // because `present` takes every field by name (`../present.ts`).
      startLocation: undefined,
      permission: execution.permission
    })
  };
}

async function capture(context: WebRecoveryHarnessContext, input: Handled): Promise<WebLlmSnapshotBinding> {
  return numbered(context, input, await captureEvidence(context.gateway, input.sessionId, input.request, input.request.signal));
}

/** `binding` numbered by the run's stable handles (header). Numbering a capture already numbered changes nothing. */
function numbered(context: WebRecoveryHarnessContext, input: Handled, binding: WebLlmSnapshotBinding): WebLlmSnapshotBinding {
  return context.restamp({ projectId: input.request.projectId, flowId: input.request.flowId }, binding);
}

/**
 * The page an option hands the model: the compact view (`web-llm-page.v3`),
 * never the structured packet, which stays here for the next press to bind its
 * target through (t223).
 */
function pageOf(binding: WebLlmSnapshotBinding): JsonObject {
  return publishedWebLlmPage(binding.evidence) as unknown as JsonObject;
}

function sameEvidence(left: WebLlmSnapshotBinding, right: WebLlmSnapshotBinding): boolean {
  return JSON.stringify(left.evidence) === JSON.stringify(right.evidence);
}

function boundedWait(value: JsonObject): number {
  exactKeys(value, ["maxWaitMs"]);
  const requested = value.maxWaitMs;
  if (typeof requested !== "number" || !Number.isFinite(requested)) recoverable("invalid_input", why("not_a_number"));
  return Math.min(Math.max(Math.trunc(requested), WEB_RECOVERY_WAIT_BOUNDS.minMs), WEB_RECOVERY_WAIT_BOUNDS.maxMs);
}

function targetHandle(value: JsonObject): string {
  exactKeys(value, ["target"]);
  return handleIn(value);
}

/**
 * The `target` handle in an input whose keys were already checked, in the
 * shape the options declare (`./options.ts`) and in the spelling the packets
 * use: `target.N` is read as `tN`.
 */
function handleIn(value: JsonObject): string {
  const target = canonicalWebLlmTargetHandle(value.target);
  if (target === undefined) {
    return recoverable("invalid_input", rejectionDetail({ reason: "malformed_handle", target: typeof value.target === "string" ? value.target : undefined, instead: undefined, missing: undefined, requestId: undefined }));
  }
  return target;
}

function requestedUrl(input: unknown): URL {
  try {
    return safeEvidenceUrl(input);
  } catch {
    return recoverable("invalid_input", why("not_a_url"));
  }
}

function exactKeys(value: JsonObject, allowed: string[]): void {
  const keys = new Set(allowed);
  const unexpected = Object.keys(value).some((key) => !keys.has(key));
  const missing = allowed.some((key) => !Object.prototype.hasOwnProperty.call(value, key));
  if (!unexpected && !missing) return;
  // The option's own declared keys, which is what it takes and all it takes.
  recoverable("invalid_input", rejectionDetail({
    reason: unexpected ? "unexpected_input_keys" : "missing_input_keys",
    target: undefined,
    instead: allowed,
    missing: undefined,
    requestId: undefined
  }));
}

/** A refusal whose reason is the whole of what the model needs. */
function why(reason: "nothing_changed_while_waiting" | "already_at_destination" | "not_a_number" | "not_a_url") {
  return rejectionDetail({ reason, target: undefined, instead: undefined, missing: undefined, requestId: undefined });
}

async function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
    signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}
