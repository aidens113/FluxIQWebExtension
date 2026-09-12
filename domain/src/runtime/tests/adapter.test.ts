// T1 for Phase 1.2 step 5 on the runtime path. The adapter must report the
// command's own status: flattening `timed_out` and `cancelled` to `failed`
// left Core with an undifferentiated failure it could not classify
// (`failureForCommandStatus`, Core `io-policy.ts`), and a message the client
// reported without an `error` never reached the node attempt, which builds its
// reason from `result.message ?? result.error`. The `rejected` answer for an
// output this domain does not own is unchanged.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { FluxIQRuntimeCommand, FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import { createWebAutomationRuntimeAdapter } from "../adapter";

type GatewayActionResult = {
  commandId: string;
  status: "succeeded" | "failed" | "timed_out" | "cancelled" | "unknown";
  message?: string;
  error?: string;
  payload?: JsonObject;
  failure?: AutomationStudioFailureRecord;
};

const readySession = {
  sessionId: "session.one",
  clientId: "client.one",
  status: "ready",
  clientType: "extension",
  capabilities: [{ id: "web.actions", actionTypes: ["web.dom.click"] }]
};

const clickCommand: FluxIQRuntimeCommand = {
  kind: "execute_action",
  commandId: "command.one",
  outputId: "web.dom.click",
  parameters: { selector: "#save" }
};

const succeeded: GatewayActionResult = {
  commandId: "client.command.one",
  status: "succeeded",
  message: "Option selected.",
  payload: { value: "team" }
};

async function runCommand(
  result: GatewayActionResult,
  command: FluxIQRuntimeCommand = clickCommand,
  sessions: unknown[] = [readySession]
): Promise<FluxIQRuntimeCommandResult> {
  const fluxiq = {
    programs: {
      clientGateway: { snapshot: () => ({ sessions }) },
      automationStudioClientGateway: { executeAction: async () => result }
    }
  } as unknown as FluxIQ;
  const adapter = createWebAutomationRuntimeAdapter({ fluxiq });
  return await adapter.execute(command, {});
}

test("a succeeded command keeps its status and promotes the client's message", async () => {
  const result = await runCommand(succeeded);
  assert.equal(result.status, "succeeded");
  assert.equal(result.message, "Option selected.", "the post-condition the client reported reaches the runtime result");
  assert.equal(result.error, undefined, "a success never gains an error");
  assert.deepEqual(result.payload, { status: "succeeded", message: "Option selected.", result: { value: "team" } });
  assert.deepEqual(result.metadata, { outputId: "web.dom.click" });
});

test("a timed out command stays timed_out rather than flattening to failed", async () => {
  const result = await runCommand({ commandId: "client.command.two", status: "timed_out", message: "The element never became visible." });
  assert.equal(result.status, "timed_out");
  assert.equal(result.message, "The element never became visible.");
});

test("a cancelled command stays cancelled rather than flattening to failed", async () => {
  const result = await runCommand({ commandId: "client.command.three", status: "cancelled", message: "The operator stopped the run." });
  assert.equal(result.status, "cancelled");
  assert.equal(result.message, "The operator stopped the run.");
});

test("an unknown command status survives, and carries no invented message", async () => {
  const result = await runCommand({ commandId: "client.command.four", status: "unknown" });
  assert.equal(result.status, "unknown");
  assert.equal(result.message, undefined);
  assert.equal(result.error, undefined);
});

test("a reported error stays the error and becomes the message", async () => {
  const result = await runCommand({
    commandId: "client.command.five",
    status: "failed",
    error: "No element matches #save.",
    message: "Click failed."
  });
  assert.equal(result.status, "failed");
  assert.equal(result.error, "No element matches #save.");
  assert.equal(result.message, "No element matches #save.", "an explicit error outranks the payload message");
});

test("the client's structured failure record reaches the runtime result", async () => {
  const failure: AutomationStudioFailureRecord = {
    category: "output_not_observed",
    code: "web.action.output_not_observed",
    retryable: true
  };
  const result = await runCommand({
    commandId: "client.command.six",
    status: "failed",
    message: "Expected the value to be team, but it stayed starter.",
    failure
  });
  assert.deepEqual(result.failure, failure, "Core classifies from the record before it matches the message");
  assert.equal(result.message, "Expected the value to be team, but it stayed starter.");
});

test("an output this domain does not own is still rejected before anything is dispatched", async () => {
  const result = await runCommand(succeeded, { kind: "execute_action", commandId: "command.two", outputId: "web.dom.teleport" });
  assert.equal(result.status, "rejected");
  assert.match(result.message ?? "", /Unsupported web automation output/u);
  assert.equal(result.error, result.message);
});

test("a dispatch with no eligible client fails with the selection reason", async () => {
  const result = await runCommand(succeeded, clickCommand, []);
  assert.equal(result.status, "failed");
  assert.match(result.error ?? "", /single paired web-automation client/u);
});
