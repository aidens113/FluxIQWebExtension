// T1 for Phase 1.2 step 5 and Phase 1.5 steps 3 and 4 on the runtime path.
//
// Phase 1.5 half: every command that did not succeed leaves the adapter with a
// structured failure record drawn from the closed code set, and a failed one
// carries the sanitized `web-llm-evidence.v1` packet built from the snapshot
// the client captured at the instant of failure. Records are run through Core's
// own `parseAutomationStudioFailureRecord`, because Core drops an inconsistent
// record whole rather than repairing it -- a record that does not survive the
// parser loses the failure silently.
//
// Phase 1.2 half. The adapter must report the
// command's own status: flattening `timed_out` and `cancelled` to `failed`
// left Core with an undifferentiated failure it could not classify
// (`failureForCommandStatus`, Core `io-policy.ts`), and a message the client
// reported without an `error` never reached the node attempt, which builds its
// reason from `result.message ?? result.error`. The `rejected` answer for an
// output this domain does not own is unchanged.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import {
  AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES,
  parseAutomationStudioFailureRecord,
  sanitizeAutomationStudioLlmFailureEvidence
} from "fluxiq/automation-studio";
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

// --- Phase 1.5 steps 3 and 4: the structured failure and the evidence packet ---

/**
 * The client's action-result payload, as `webAutomationActionResultPayload`
 * shapes it. `dispatchWebAutomationOutput` is what nests it under `result`, so
 * this is the inner object, not the wrapper.
 */
function failedPayload(overrides: JsonObject = {}): JsonObject {
  return {
    commandId: "client.command.one",
    actionType: "web.dom.click",
    status: "failed",
    url: "https://fixture.test/checkout/pay?session=secret-token#step2",
    title: "Checkout",
    element: { selector: "#pay", tagName: "button" },
    snapshot: {
      url: "https://fixture.test/checkout/pay?session=secret-token",
      title: "Checkout",
      interactiveElements: [
        { tagName: "button", selector: "#pay", role: "button", name: "Pay now" },
        { tagName: "input", selector: "#card", inputType: "password", name: "Card number" }
      ]
    },
    ...overrides
  };
}

test("a failed command with no client record still leaves with one from the closed code set", async () => {
  const result = await runCommand({ commandId: "client.command.seven", status: "failed", message: "The click did not take." });
  assert.equal(result.failure?.code, "web.action.failed", "the message is a reason, so the failure is action_failed rather than unknown");
  assert.equal(result.failure?.category, "action_failed");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure, "Core keeps the record whole");
});

test("a timed out command leaves with the timeout code, not a bare status", async () => {
  const result = await runCommand({ commandId: "client.command.eight", status: "timed_out", message: "The element never became visible." });
  assert.equal(result.status, "timed_out");
  assert.equal(result.failure?.code, "web.action.timeout");
  assert.equal(result.failure?.category, "timeout");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("a failure with nothing to say is UNKNOWN rather than no record at all", async () => {
  const result = await runCommand({ commandId: "client.command.nine", status: "unknown" });
  assert.equal(result.failure?.code, "web.action.unknown");
  assert.equal(result.failure?.category, "ambiguous_or_unknown");
});

test("a succeeded command carries no failure and no failure evidence", async () => {
  const result = await runCommand({ ...succeeded, payload: failedPayload() });
  assert.equal(result.failure, undefined);
  assert.equal((result.metadata as JsonObject | undefined)?.failureEvidence, undefined);
  assert.equal((result.metadata as JsonObject | undefined)?.failureDiagnostics, undefined);
});

test("an output this domain does not own is rejected with the unsupported-type code", async () => {
  const result = await runCommand(succeeded, { kind: "execute_action", commandId: "command.three", outputId: "web.dom.teleport" });
  assert.equal(result.status, "rejected");
  assert.equal(result.failure?.code, "web.action.unsupported_type");
  assert.equal(result.failure?.category, "blocked_by_capability_or_policy");
  assert.equal(result.failure?.retryable, false, "Core forbids this category from being retryable");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("a failed command carries the sanitized evidence packet, digest-bound to its own failure record", async () => {
  const result = await runCommand({ commandId: "client.command.ten", status: "failed", message: "Click failed.", payload: failedPayload() });
  const metadata = result.metadata as JsonObject;
  const evidence = metadata.failureEvidence as JsonObject;
  assert.equal(evidence.schemaVersion, "web-llm-evidence.v1");
  assert.equal(evidence.trust, "untrusted-page-evidence");
  assert.equal(evidence.location, "https://fixture.test/checkout/pay", "the packet's location drops the query, which is where a session token rides");

  const bytes = Buffer.byteLength(JSON.stringify(evidence), "utf8");
  assert.ok(bytes <= AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES, `the packet is bounded to Core's failure-evidence gate (${bytes} bytes)`);
  // Core's own gate, applied to the packet exactly as the diagnosis path will.
  assert.deepEqual(sanitizeAutomationStudioLlmFailureEvidence("runtime_diagnosis", evidence), evidence);

  const diagnostics = metadata.failureDiagnostics as JsonObject;
  assert.equal(diagnostics.url, "https://fixture.test/checkout/pay", "no query string reaches the attempt trace");
  assert.equal(diagnostics.selector, "#pay", "the target the client resolved rides with the failure");
  assert.equal(diagnostics.evidenceDigest, createHash("sha256").update(JSON.stringify(evidence)).digest("hex"));
  assert.equal(result.failure?.evidenceDigest, diagnostics.evidenceDigest, "the record names the packet it was captured with");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure, "the digest does not cost the record its validity");
});

test("the evidence packet never carries a sensitive control", async () => {
  const result = await runCommand({ commandId: "client.command.eleven", status: "failed", message: "Click failed.", payload: failedPayload() });
  const evidence = (result.metadata as JsonObject).failureEvidence as { elements: Array<{ selector: string }> };
  assert.deepEqual(evidence.elements.map((element) => element.selector), ["#pay"], "the password control is dropped, not reported");
});

test("a client's own failure record survives the hop and only gains the digest", async () => {
  const failure: AutomationStudioFailureRecord = {
    category: "target_not_found",
    code: "web.target.not_found",
    retryable: true,
    stage: "target_resolution",
    expected: "an element matching #pay",
    actual: "nothing matched"
  };
  const result = await runCommand({ commandId: "client.command.twelve", status: "failed", message: "Nothing matched #pay.", failure, payload: failedPayload() });
  assert.deepEqual({ ...result.failure, evidenceDigest: undefined }, { ...failure, evidenceDigest: undefined }, "the producer stood nearest the page, so its record is not relabelled");
  assert.match(String(result.failure?.evidenceDigest), /^[a-f0-9]{64}$/u);
});

test("an unusable snapshot costs the packet, never the failure it was meant to explain", async () => {
  const result = await runCommand({
    commandId: "client.command.thirteen",
    status: "failed",
    message: "Click failed.",
    payload: failedPayload({ snapshot: { url: "about:blank", title: "", interactiveElements: [] } })
  });
  assert.equal((result.metadata as JsonObject).failureEvidence, undefined, "a non-HTTP location is refused by the sanitizer");
  assert.equal(result.failure?.code, "web.action.failed", "the failure is reported anyway");
  assert.equal(result.failure?.evidenceDigest, undefined);
  assert.equal((result.metadata as JsonObject | undefined)?.failureDiagnostics !== undefined, true, "the URL and target still ride with it");
});
