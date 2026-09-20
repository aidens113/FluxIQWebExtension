// Live Chromium proof for the field-entry tool and its target-stability claim.

import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_ENTER_FIELD_TOOL_ID,
  WEB_LLM_INSPECT_TOOL_ID,
  WEB_LLM_PRESS_TOOL_ID,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution
} from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";

const BASE = { projectId: "project.live-field-entry", flowId: "flow.live-field-entry", maxEvidenceBytes: 16_000 } as const;

test("enters a live form's text and select fields while existing handles stay stable", async ({ openHarness, page }) => {
  const harness = await openHarness("social-scheduler");
  let command = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({
        commandId: `live-field-entry.${++command}`,
        actionType: request.actionType,
        ...request.parameters
      } as Parameters<typeof harness.runAction>[0]);
      const snapshot = reply.snapshot === undefined ? undefined : JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      return {
        status: reply.status,
        ...(snapshot ? { payload: { snapshot } } : {}),
        ...(reply.status === "failed" && typeof reply.message === "string" ? { error: reply.message } : {})
      };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);

  const inspected = await runtime.executeTool({ ...BASE, callId: "call.inspect", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
  const opened = await runtime.executeTool({
    ...BASE,
    callId: "call.open",
    toolId: WEB_LLM_PRESS_TOOL_ID,
    value: { target: targetNamed(inspected, "New post"), consequences: [] }
  });
  // Opening the modal hides controls from the page behind it. Even on the same
  // URL those old handles are no longer actionable, so this must stay false.
  expect(opened.targetsUnchanged).toBe(false);

  const entries = [
    ["Post text", "Trail update for Thursday morning"],
    ["Account", "photogram-northwind-trails"],
    ["Date", "2026-09-24"],
    ["Time", "09:00"]
  ] as const;
  let latest = opened;
  for (const [name, value] of entries) {
    latest = await runtime.executeTool({
      ...BASE,
      callId: `call.enter.${name.toLowerCase().replaceAll(" ", "-")}`,
      toolId: WEB_LLM_ENTER_FIELD_TOOL_ID,
      value: { target: targetNamed(latest, name), value }
    });
    expect(latest.effectApplied, name).toBe(true);
    expect(latest.targetsUnchanged, name).toBe(true);
  }

  await expect(page.locator("#composer-body")).toHaveValue(entries[0][1]);
  await expect(page.locator("#composer-account")).toHaveValue(entries[1][1]);
  await expect(page.locator("#composer-date")).toHaveValue(entries[2][1]);
  await expect(page.locator("#composer-time")).toHaveValue(entries[3][1]);
  expect(JSON.stringify(latest.evidence)).not.toContain(entries[0][1]);
  expect(JSON.stringify(latest.evidence)).not.toContain(entries[2][1]);
  const timeEvidence = evidenceElementNamed(latest, "Time");
  expect(timeEvidence).toMatchObject({ name: "Time", hasValue: true });
  expect(timeEvidence).not.toHaveProperty("value");
  expect(timeEvidence).not.toHaveProperty("text", entries[3][1]);
});

function targetNamed(execution: WebLlmEvidenceToolExecution, name: string): string {
  const found = evidenceElementNamed(execution, name);
  if (typeof found?.target !== "string") throw new Error(`Live evidence did not contain an actionable ${name} field.`);
  return found.target;
}

function evidenceElementNamed(execution: WebLlmEvidenceToolExecution, name: string): Record<string, unknown> {
  const elements = (execution.evidence as { elements?: Array<Record<string, unknown>> }).elements ?? [];
  const found = elements.find((element) => element.name === name || element.text === name);
  if (!found) throw new Error(`Live evidence did not contain ${name}.`);
  return found;
}
