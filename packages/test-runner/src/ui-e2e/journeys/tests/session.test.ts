// Each journey provisions under its own project, and no project's name may
// contain another's, because the panel's project search matches by substring.

import assert from "node:assert/strict";
import test from "node:test";
import type { DemoWorkspaceConfiguration } from "../../../demo-workspace/index.js";
import { journeyFlowConfiguration } from "../session.js";

const base: DemoWorkspaceConfiguration = {
  repositoryRoot: "/repo", runsDirectory: "/runs", workspaceDirectory: "/runs/ws", fluxiqRepositoryRoot: "/core", extensionSourceDirectory: "/ext",
  fluxiqRoot: "/runs/ws/fluxiq-root", storageDirectory: "/runs/ws/fluxiq-root/.fluxiq", origin: "http://127.0.0.1:33000", gatewayUrl: "ws://127.0.0.1:43000/client",
  username: "runner", password: "not-a-real-password", pin: "123456", projectId: "project.shared", projectName: "UI Journeys", flowId: "flow.demo", flowName: "Demo", headless: true,
};

test("each journey and each failure task gets its own project, and a configured shared project id is not used", () => {
  const extraction = journeyFlowConfiguration(base, "extraction", { flowId: "flow.extraction", flowName: "Extraction" });
  const missing = journeyFlowConfiguration(base, "failure-missing-target", { flowId: "flow.failure", flowName: "Failure" });
  const redesigned = journeyFlowConfiguration(base, "failure-redesigned-field", { flowId: "flow.failure", flowName: "Failure" });
  assert.equal(extraction.projectName, "UI Journeys: extraction");
  assert.equal(missing.projectName, "UI Journeys: failure-missing-target");
  assert.equal(redesigned.projectName, "UI Journeys: failure-redesigned-field");
  assert.equal("projectId" in extraction, false);
  assert.deepEqual([extraction.flowId, extraction.flowName], ["flow.extraction", "Extraction"]);
  const names = [extraction.projectName, missing.projectName, redesigned.projectName];
  for (const name of names) for (const other of names) if (name !== other) assert.equal(other.toLowerCase().includes(name.toLowerCase()), false);
  assert.equal(extraction.origin, base.origin);
});
