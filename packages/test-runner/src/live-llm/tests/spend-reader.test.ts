// Which Flow a live run spends on, and reading its spend from Core's purse.

import assert from "node:assert/strict";
import test from "node:test";
import type { ExistingFlowSpend } from "../../existing-fluxiq-control/index.js";
import { LiveLlmFlowSpendReader } from "../spend-reader.js";
import { flowPurse } from "./flow-purse.js";

const CEILING = 0.25;

/** A Core whose project holds `flows` (a Subflow graph among them when asked) and whose purses are `purses`. */
function core(flows: string[], purses: Record<string, ExistingFlowSpend | null> = {}) {
  const reads: string[] = [];
  return {
    flows,
    reads,
    async getFlowSpend(projectId: string, flowId: string): Promise<ExistingFlowSpend | null> {
      reads.push(`${projectId}/${flowId}`);
      return purses[flowId] ?? null;
    },
    async automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
      assert.equal(endpoint, "list-flows");
      assert.deepEqual(payload, { projectId: "project-1" });
      return { flows: [...this.flows.map((flowId) => ({ flow: { flowId } })), { flowId: "subflow-graph", metadata: { subflowGraph: true } }] };
    },
  };
}

test("a named Flow's purse is read by its id; one Core holds no record of is unknown, not zero", async () => {
  const control = core([], { "flow-1": flowPurse({ build: [5, 0.02] }) });
  const reader = new LiveLlmFlowSpendReader();
  assert.equal((await reader.read(CEILING)).source, "flow_unknown", "nothing named yet");
  reader.name(control, "project-1", "flow-1");
  const spend = await reader.read(CEILING);
  assert.deepEqual([spend.source, spend.calls, spend.totalEstimatedCostUsd], ["flow_purse", 5, 0.02]);
  reader.name(control, "project-1", "flow-2");
  assert.deepEqual([(await reader.read(CEILING)).source, (await reader.read(CEILING)).totalEstimatedCostUsd], ["no_record", null]);
  assert.deepEqual(control.reads, ["project-1/flow-1", "project-1/flow-2", "project-1/flow-2"]);
});

test("a chat build's Flow is the one the project gained, Subflow graphs left out; any other count names none", async () => {
  const control = core(["older-flow"], { "chat-flow": flowPurse({ chat: [1, 0.0003], build: [9, 0.03] }) });
  const reader = new LiveLlmFlowSpendReader();
  await reader.beforeChatBuild(control, "project-1");
  control.flows = ["older-flow", "chat-flow"];
  const spend = await reader.read(CEILING);
  assert.deepEqual([spend.source, spend.calls, spend.phases.chat], ["flow_purse", 10, { calls: 1, estimatedCostUsd: 0.0003 }]);
  assert.deepEqual(control.reads, ["project-1/chat-flow"]);

  for (const after of [["older-flow"], ["older-flow", "chat-flow", "another-flow"]]) {
    const ambiguous = core(["older-flow"]);
    const unnamed = new LiveLlmFlowSpendReader();
    await unnamed.beforeChatBuild(ambiguous, "project-1");
    ambiguous.flows = after;
    assert.equal((await unnamed.read(CEILING)).source, "flow_unknown", `${after.length - 1} new Flow(s)`);
    assert.deepEqual(ambiguous.reads, []);
  }
});

test("a control that cannot read spend lists nothing, and a read that fails is unreadable rather than raised", async () => {
  const listing = { async automationStudioCall(): Promise<unknown> { throw new Error("a control without the spend read must not list Flows"); } };
  const reader = new LiveLlmFlowSpendReader();
  await reader.beforeChatBuild(listing, "project-1");
  assert.equal((await reader.read(CEILING)).source, "flow_unknown");

  const failing = new LiveLlmFlowSpendReader();
  failing.name({ getFlowSpend: async () => { throw new Error("gone"); } }, "project-1", "flow-1");
  assert.equal((await failing.read(CEILING)).source, "unreadable");
});
