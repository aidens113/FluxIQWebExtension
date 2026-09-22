// Core's own ending for a Flow build that stopped to ask a person, for the
// created-Flow lane's tests. Made by Core's own permission gate and failure
// builder, then carried through JSON as the wire carries it, so the Lab is
// tested against exactly what Core sends rather than a hand-written copy that
// Core's strict parser might refuse.

import assert from "node:assert/strict";
import { AutomationStudioActionPermissionGate, flowBootstrapPermissionRequiredFailure } from "fluxiq/automation-studio";

/**
 * A build that pressed nothing it was not allowed to: its second decision
 * asked to press "Schedule post", which would publish, and neither a grant nor
 * the instruction allowed that.
 */
export async function permissionRequiredDiagnostic(): Promise<unknown> {
  const gate = new AutomationStudioActionPermissionGate({ stage: "authoring", instructionIds: ["instruction.schedule"], now: () => 5, newRequestId: () => "permission-request:one" });
  gate.observe({ controls: [{ handle: "c7", name: "Schedule post" }] });
  await gate.checkFor({ kind: "exploration_step", id: "web.press_control", ref: "call-3" })({ consequences: ["send_or_publish"], control: { name: "Schedule post", kind: "button" }, verb: "press" });
  assert.ok(gate.request, "the gate raised a request");
  const trace = [
    { iteration: 1, decision: "tool_call" as const, callId: "call-1", toolId: "web.inspect_current_page", evidenceBytes: 900, effectApplied: false },
    { iteration: 2, decision: "tool_call" as const, callId: "call-3", toolId: "web.press_control", effectApplied: false, resultCode: "web.action.rejected.permission_required" },
  ];
  const spent = { iterations: 2, toolCalls: 2, evidenceBytes: 900, inputTokens: 9_000, outputTokens: 300, totalTokens: 9_300, estimatedCostUsd: 0.003 };
  const error = flowBootstrapPermissionRequiredFailure(gate.request, { trace, accounting: spent }, { requestId: "evidence.one", estimatedInputTokens: 9_000, provider: "deepseek", model: "deepseek-chat", inputTokens: 9_000, outputTokens: 300, totalTokens: 9_300, estimatedCostUsd: 0.003 });
  return JSON.parse(JSON.stringify(error.diagnostic)) as unknown;
}
