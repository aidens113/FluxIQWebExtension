// Live Chromium A/B for Core's optional multi-action evidence decision.

import { runAutomationStudioLlmEvidenceLoop } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_ENTER_FIELD_TOOL_ID,
  WEB_LLM_PRESS_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";

const ENTRIES = [
  ["Post text", "Trail update for Thursday morning"],
  ["Account", "photogram-northwind-trails"],
  ["Date", "2026-09-24"],
  ["Time", "09:00"]
] as const;

for (const batched of [false, true]) {
  test(`${batched ? "multi-action" : "single-action"} decisions fill the live composer`, async ({ openHarness, page }) => {
    const harness = await openHarness("social-scheduler");
    let command = 0;
    let providerCalls = 0;
    let decision = 0;
    const gateway: WebLlmEvidenceGateway = {
      eligibleSessionIds: () => ["session.live-batch"],
      executeAction: async (_sessionId, request) => {
        const reply = await harness.runAction({
          commandId: `live-batch.${++command}`,
          actionType: request.actionType,
          ...request.parameters
        } as Parameters<typeof harness.runAction>[0]);
        const snapshot = reply.snapshot === undefined ? undefined : JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
        return { status: reply.status, ...(snapshot ? { payload: { snapshot } } : {}) };
      }
    };
    const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
    const result = await runAutomationStudioLlmEvidenceLoop({
      tools: runtime.tools,
      decide: async (input) => {
        providerCalls += 1;
        const evidence = latestEvidence(input.evidence);
        if (decision++ === 0) {
          return { kind: "tool_call", callId: "call.open", toolId: WEB_LLM_PRESS_TOOL_ID, input: { target: targetNamed(evidence, "New post"), consequences: [] } };
        }
        if (batched && decision === 2) {
          return {
            kind: "tool_calls",
            calls: ENTRIES.map(([name, value], index) => ({ callId: `call.enter.${index + 1}`, toolId: WEB_LLM_ENTER_FIELD_TOOL_ID, input: { target: targetNamed(evidence, name), value } }))
          };
        }
        if (!batched && decision <= ENTRIES.length + 1) {
          const [name, value] = ENTRIES[decision - 2]!;
          return { kind: "tool_call", callId: `call.enter.${decision - 1}`, toolId: WEB_LLM_ENTER_FIELD_TOOL_ID, input: { target: targetNamed(evidence, name), value } };
        }
        return { kind: "complete", result: { ready: true } };
      },
      executeTool: async (request) => await runtime.executeTool({ projectId: "project.live-batch", flowId: "flow.live-batch", ...request })
    });

    expect(result).toMatchObject({ ok: true, result: { ready: true }, accounting: { toolCalls: 6 } });
    expect(providerCalls).toBe(batched ? 3 : 6);
    const batchSteps = result.trace.filter((step) => step.batch !== undefined);
    expect(batchSteps).toHaveLength(batched ? 4 : 0);
    if (batched) {
      expect(batchSteps.map((step) => step.batch)).toEqual([
        { position: 1, size: 4 },
        { position: 2, size: 4 },
        { position: 3, size: 4 },
        { position: 4, size: 4 }
      ]);
    }
    await expect(page.locator("#composer-body")).toHaveValue(ENTRIES[0][1]);
    await expect(page.locator("#composer-account")).toHaveValue(ENTRIES[1][1]);
    await expect(page.locator("#composer-date")).toHaveValue(ENTRIES[2][1]);
    await expect(page.locator("#composer-time")).toHaveValue(ENTRIES[3][1]);
  });
}

function latestEvidence(entries: Array<{ value: JsonValue }>): JsonValue {
  const value = entries.at(-1)?.value;
  if (value === undefined) throw new Error("The live evidence loop supplied no page evidence.");
  return value;
}

function targetNamed(evidence: JsonValue, name: string): string {
  const elements = (evidence as { elements?: Array<Record<string, unknown>> }).elements ?? [];
  const found = elements.find((element) => element.name === name || element.text === name);
  if (typeof found?.target !== "string") throw new Error(`Live evidence did not contain an actionable ${name} field.`);
  return found.target;
}
