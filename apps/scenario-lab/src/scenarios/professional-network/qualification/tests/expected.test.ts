import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { PROFESSIONAL_NETWORK_LIVE_TASKS } from "../../live-tasks.js";
import { professionalNetworkManifest } from "../../manifest.js";
import { staleRequestAuditExpected } from "../index.js";

test("the new read-only audit resolves its own dataset and preserves invitation membership", () => {
  const task = PROFESSIONAL_NETWORK_LIVE_TASKS.find(({ id }) => id === "professional-network-audit-stale-requests")!;
  assert.equal(task.judgeBy, "expected-dataset");
  const resolved = resolveScenarioWorkflow(professionalNetworkManifest, { workflowId: "audit-stale-requests" });
  assert.deepEqual(resolved.expected, staleRequestAuditExpected);
  const dataset = resolved.expected.extracted![0]!;
  assert.equal(task.expectedDatasetId, dataset.step);
  assert.equal(dataset.count, 12);
  assert.equal(new Set(dataset.records!.map(({ name }) => name)).size, 12);
  assert.ok(dataset.records!.every((record) => Object.keys(record).join() === "name"));
  assert.ok(!dataset.records!.some(({ name }) => name === "Rosa Meijer"));
  assert.ok(!resolved.recordingScript.some(({ target }) => target?.includes("withdraw-confirm")));
  assert.equal(resolved.expected.finalState![0]!.subject, "invitation-store");
});
