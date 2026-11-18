import assert from "node:assert/strict";
import test from "node:test";
import { restartAttemptCore, type AttemptCoreRestartInput } from "../restart-core.js";

for (const [name, keys, expected] of [
  ["missing", [], "missing"],
  ["unavailable", [{ kind: "llm", enabled: true, availability: { state: "unavailable", code: "host_protection_unavailable" } }], "unavailable:host_protection_unavailable"]
] as const) {
  test(`restart with ${name} model configuration preserves deterministic chat readiness`, async () => {
    const calls: string[] = [];
    const input = {
      projectId: "project.fixture", log: () => undefined,
      topology: { restartCore: async () => { calls.push("restart"); } },
      control: { reauthenticate: async () => undefined, selectProject: async () => { calls.push("project"); } },
      browser: {
        control: { evaluate: async (_fn: unknown, message?: { type: string }) => message?.type === "fluxiq.getStatus" ? { ok: true, status: { connectionState: "connected" } } : { ok: true, payload: { keys } } },
        panel: { projectScope: async () => ({ projectId: "project.fixture", scopeState: "ready", composerEnabled: true, composerAvailable: true }) },
        openPanel: async () => { assert.fail("A model configuration issue must not require reopening the ready chat"); }
      }
    } as unknown as AttemptCoreRestartInput;
    const result = await restartAttemptCore(input);
    assert.equal(result.modelKey, expected);
    assert.equal(result.panel, "carried_on");
    assert.deepEqual(calls, ["restart", "project"]);
  });
}
