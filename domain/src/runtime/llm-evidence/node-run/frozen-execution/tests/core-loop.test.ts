import assert from "node:assert/strict";
import test from "node:test";
import { runAutomationStudioLlmEvidenceLoop, type AutomationStudioLlmEvidenceLoopInput } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { TYPE } from "./harness";
import { pairedHost } from "./paired-host";

type DecisionInput = Parameters<AutomationStudioLlmEvidenceLoopInput["decide"]>[0];

async function runPaired(changeDocument = false) {
  const host = pairedHost();
  await host.prime();
  const decisions: DecisionInput[] = [];
  const result = await runAutomationStudioLlmEvidenceLoop({
    tools: host.tools, executeTool: host.executeTool, rerunAuthority: host.authority,
    maxIterations: 8, maxToolCalls: 8, maxStepsWithoutProgress: 8, draft: false, dryRun: false,
    decide: async (input) => {
      decisions.push(input);
      if (decisions.length === 1) return {
        kind: "tool_call", callId: "original", toolId: "core.run_node",
        input: { node: TYPE, parameters: { target: { handle: "t1" }, text: "Fixed value", submit: false }, consequences: [] }
      };
      if (decisions.length === 2) {
        assert.ok(input.tools.some((tool) => tool.toolId === "core.run_nodes"), "actual permission/receipt proof makes the original eligible");
        if (changeDocument) host.changeDocument();
        else await host.replaceMap();
        return { kind: "tool_call", callId: "batch", toolId: "core.run_nodes", input: { calls: ["original"] } };
      }
      return { kind: "complete", result: { done: true } };
    }
  });
  const entry = decisions.flatMap((input) => input.evidence).find((item) => item.toolId === "core.run_nodes" && item.callId === "batch");
  assert.ok(entry, `the real loop records its batch's closed outcome: ${JSON.stringify({
    code: result.ok ? "completed" : result.code, decisions: decisions.length, ...host.diagnostics()
  })}`);
  const summary = entry.value as JsonObject;
  assert.equal(JSON.stringify(decisions).includes("reportDispatch"), false);
  assert.ok(Object.keys(summary).every((key) => ["status", "requested", "executed", "skipped", "unproven", "stoppedAt", "reason"].includes(key)));
  return { host, result, summary };
}

test("public Core loop, actual permission gate and web adapter preserve the original subject across a reused target map", async () => {
  const { host, result, summary } = await runPaired();
  assert.equal(result.ok, true);
  assert.equal(summary.status, "completed");
  assert.equal(summary.requested, 1);
  assert.equal(summary.executed, 1);
  assert.equal(summary.skipped, 0);
  assert.deepEqual(host.main.map((parameters) => parameters.selector), ["#original", "#refreshed"]);
  assert.deepEqual(host.main.map((parameters) => parameters.text), ["Fixed value", "Fixed value"]);
  assert.equal(result.accounting.toolCalls, 2, "the envelope spends no extra executed-node allowance");
  assert.equal(result.steps.length, 1, "the ordinary original remains; the batch adds no authored step");
});

test("a changed actual document prevents a second main dispatch through the paired path", async () => {
  const { host, summary } = await runPaired(true);
  assert.equal(host.main.length, 1);
  assert.notEqual(summary.status, "completed");
  assert.equal(summary.executed, 0);
});
