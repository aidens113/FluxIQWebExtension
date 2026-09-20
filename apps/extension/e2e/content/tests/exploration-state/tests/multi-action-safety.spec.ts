// Live Chromium safety boundaries for Core's ordered evidence-action batches.

import { runAutomationStudioLlmEvidenceLoop } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_ENTER_FIELD_TOOL_ID,
  WEB_LLM_INSPECT_TOOL_ID,
  WEB_LLM_PRESS_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import { expect, test, type ContentHarness } from "../../../index.js";

type ToolCall = { callId: string; toolId: string; input: JsonObject };

test("stable field entries continue in one ordered batch", async ({ openHarness, page }) => {
  const harness = await openHarness("social-scheduler");
  const actionTypes: string[] = [];
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFor(harness, actionTypes));
  let decision = 0;
  const result = await runAutomationStudioLlmEvidenceLoop({
    tools: runtime.tools,
    decide: async (input) => {
      const evidence = latestEvidence(input.evidence);
      decision += 1;
      if (decision === 1) return call("open", WEB_LLM_PRESS_TOOL_ID, { target: targetNamed(evidence, "New post"), consequences: [] });
      if (decision === 2) {
        return calls([
          callValue("body", WEB_LLM_ENTER_FIELD_TOOL_ID, { target: targetNamed(evidence, "Post text"), value: "Stable batch body" }),
          callValue("account", WEB_LLM_ENTER_FIELD_TOOL_ID, { target: targetNamed(evidence, "Account"), value: "photogram-northwind-trails" })
        ]);
      }
      return { kind: "complete" as const, result: { ready: true } };
    },
    executeTool: async (request) => await runtime.executeTool({ projectId: "project.batch-safety", flowId: "flow.stable", ...request })
  });

  expect(result.ok).toBe(true);
  expect(result.trace.filter((step) => step.batch !== undefined).map((step) => step.batch)).toEqual([
    { position: 1, size: 2 },
    { position: 2, size: 2 }
  ]);
  await expect(page.locator("#composer-body")).toHaveValue("Stable batch body");
  await expect(page.locator("#composer-account")).toHaveValue("photogram-northwind-trails");
  expect(actionTypes.filter((type) => type === "web.dom.type" || type === "web.dom.select")).toEqual(["web.dom.type", "web.dom.select"]);
});

test("target instability stops the batch before its observation", async ({ openHarness, page }) => {
  const harness = await openHarness("social-scheduler");
  const actionTypes: string[] = [];
  const result = await runOneBatch(harness, actionTypes, (evidence) => [
    callValue("open", WEB_LLM_PRESS_TOOL_ID, { target: targetNamed(evidence, "New post"), consequences: [] }),
    callValue("after", WEB_LLM_INSPECT_TOOL_ID, {})
  ], "flow.target-instability");

  expect(batchTrace(result)).toEqual([
    expect.objectContaining({ batch: { position: 1, size: 2, stoppedBy: "targets_may_have_changed" } })
  ]);
  await expect(page.getByTestId("composer")).toBeVisible();
  // One initial capture, then the press's before/after captures. A fourth
  // capture would mean the listed inspect ran after handles became unsafe.
  expect(actionTypes).toEqual(["web.dom.capture_snapshot", "web.dom.capture_snapshot", "web.dom.click", "web.dom.capture_snapshot"]);
});

test("a refused target stops the batch before a later action", async ({ openHarness }) => {
  const harness = await openHarness("social-scheduler");
  const actionTypes: string[] = [];
  const result = await runOneBatch(harness, actionTypes, () => [
    callValue("unknown", WEB_LLM_PRESS_TOOL_ID, { target: "target.99", consequences: [] }),
    callValue("after", WEB_LLM_INSPECT_TOOL_ID, {})
  ], "flow.refusal");

  expect(batchTrace(result)).toEqual([
    expect.objectContaining({
      resultCode: "web.action.rejected.target_unobserved",
      batch: { position: 1, size: 2, stoppedBy: "action_refused" }
    })
  ]);
  expect(actionTypes).toEqual(["web.dom.capture_snapshot", "web.dom.capture_snapshot"]);
});

test("same-document navigation stops the batch before the next observation", async ({ openHarness, page }) => {
  const harness = await openHarness("admin-console");
  const actionTypes: string[] = [];
  const start = page.url();
  const result = await runOneBatch(harness, actionTypes, (evidence) => [
    callValue("navigate", WEB_LLM_PRESS_TOOL_ID, { target: targetNamed(evidence, "Settings"), consequences: [] }),
    callValue("after", WEB_LLM_INSPECT_TOOL_ID, {})
  ], "flow.navigation");

  expect(batchTrace(result)).toEqual([
    expect.objectContaining({ batch: { position: 1, size: 2, stoppedBy: "targets_may_have_changed" } })
  ]);
  await expect(page).not.toHaveURL(start);
  expect(actionTypes).toEqual(["web.dom.capture_snapshot", "web.dom.capture_snapshot", "web.dom.click", "web.dom.capture_snapshot"]);
});

test("an intervention aborts before the later action, exposing the missing batch stop projection", async ({ openHarness, page }) => {
  const harness = await openHarness("modal-flows");
  const actionTypes: string[] = [];
  let interventionCode: string | undefined;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.batch-safety"],
    executeAction: async (_sessionId, request) => {
      actionTypes.push(request.actionType);
      if (request.actionType === "web.dom.click") {
        await page.locator('[data-testid="open-invite"]').click();
        await expect(page.locator('[data-testid="invite-dialog"]')).toBeVisible();
      }
      const reply = await harness.runAction({
        commandId: `batch-safety.${actionTypes.length}`,
        actionType: request.actionType,
        ...request.parameters
      } as Parameters<typeof harness.runAction>[0]);
      interventionCode = reply.failure?.code ?? interventionCode;
      return gatewayReply(reply);
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  let decision = 0;
  const result = await runAutomationStudioLlmEvidenceLoop({
    tools: runtime.tools,
    decide: async (input) => {
      decision += 1;
      if (decision === 1) {
        const evidence = latestEvidence(input.evidence);
        return calls([
          callValue("blocked", WEB_LLM_PRESS_TOOL_ID, { target: targetNamed(evidence, "Add section"), consequences: [] }),
          callValue("after", WEB_LLM_INSPECT_TOOL_ID, {})
        ]);
      }
      return { kind: "complete" as const, result: { ready: true } };
    },
    executeTool: async (request) => await runtime.executeTool({ projectId: "project.batch-safety", flowId: "flow.intervention", ...request })
  });

  // The browser correctly refuses the click, and Core never executes the next
  // call. Today the evidence gateway turns that failed action into a thrown
  // interaction error, so no `batch.stoppedBy` can be projected. This passing
  // assertion preserves the live safety fact while making that contract gap
  // explicit instead of claiming the action_refused stop code was observed.
  expect(result).toMatchObject({ ok: false, code: "llm_evidence_loop.tool_failed" });
  expect(batchTrace(result)).toEqual([]);
  expect(interventionCode).toBe("web.intervention.required");
  expect(actionTypes).toEqual(["web.dom.capture_snapshot", "web.dom.capture_snapshot", "web.dom.click"]);
  expect((await harness.finalState()).state).toMatchObject({ sectionCount: 0 });
});

async function runOneBatch(
  harness: ContentHarness,
  actionTypes: string[],
  batch: (evidence: JsonValue) => ToolCall[],
  flowId: string
): Promise<Awaited<ReturnType<typeof runAutomationStudioLlmEvidenceLoop>>> {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFor(harness, actionTypes));
  let decision = 0;
  return await runAutomationStudioLlmEvidenceLoop({
    tools: runtime.tools,
    decide: async (input) => {
      decision += 1;
      if (decision === 1) return calls(batch(latestEvidence(input.evidence)));
      return { kind: "complete" as const, result: { ready: true } };
    },
    executeTool: async (request) => await runtime.executeTool({ projectId: "project.batch-safety", flowId, ...request })
  });
}

function gatewayFor(harness: ContentHarness, actionTypes: string[]): WebLlmEvidenceGateway {
  return {
    eligibleSessionIds: () => ["session.batch-safety"],
    executeAction: async (_sessionId, request) => {
      actionTypes.push(request.actionType);
      const reply = await harness.runAction({
        commandId: `batch-safety.${actionTypes.length}`,
        actionType: request.actionType,
        ...request.parameters
      } as Parameters<typeof harness.runAction>[0]);
      return gatewayReply(reply);
    }
  };
}

function gatewayReply(reply: Awaited<ReturnType<ContentHarness["runAction"]>>): { status: string; payload?: JsonObject; error?: string } {
  const snapshot = reply.snapshot === undefined ? undefined : JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
  return {
    status: reply.status,
    ...(snapshot ? { payload: { snapshot } } : {}),
    ...(reply.status === "failed" && typeof reply.message === "string" ? { error: reply.message } : {})
  };
}

function call(id: string, toolId: string, input: JsonObject) {
  return { kind: "tool_call" as const, callId: `call.${id}`, toolId, input };
}

function callValue(id: string, toolId: string, input: JsonObject): ToolCall {
  return { callId: `call.${id}`, toolId, input };
}

function calls(list: ToolCall[]) {
  return { kind: "tool_calls" as const, calls: list };
}

function batchTrace(result: Awaited<ReturnType<typeof runAutomationStudioLlmEvidenceLoop>>) {
  return result.trace.filter((step) => step.batch !== undefined);
}

function latestEvidence(entries: Array<{ value: JsonValue }>): JsonValue {
  const value = entries.at(-1)?.value;
  if (value === undefined) throw new Error("The live evidence loop supplied no page evidence.");
  return value;
}

function targetNamed(evidence: JsonValue, name: string): string {
  const elements = (evidence as { elements?: Array<Record<string, unknown>> }).elements ?? [];
  const found = elements.find((element) => element.name === name || element.text === name);
  if (typeof found?.target !== "string") throw new Error(`Live evidence did not contain an actionable ${name} control.`);
  return found.target;
}
