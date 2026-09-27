import assert from "node:assert/strict";
import test from "node:test";
import type { WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import { unarmedWorkflow } from "../unarmed-workflow.js";

const scenario: WebScenario = {
  schemaVersion: "0.1",
  id: "auth-gate",
  title: "A fixture with an armable variant",
  tags: ["auth"],
  seed: 7,
  startPath: "/scenarios/auth-gate/",
  capabilities: [],
  networkPolicy: "loopback-only",
  recordingScript: [{ id: "sign-in", operation: "click", target: "[data-testid=sign-in]" }],
  expected: { pageFacts: [{ id: "unarmed", subject: "banner", predicate: "text", value: "Sign in" }] },
  variants: [{ id: "expired", description: "The session has expired", arm: { operation: "expire-session" }, expected: { pageFacts: [{ id: "armed", subject: "banner", predicate: "text", value: "Session expired" }] } }],
  workflows: [{ id: "recover", description: "Recover a locked account", recordingScript: [{ id: "recover", operation: "click", target: "[data-testid=recover]" }], expected: {} }],
};

test("the variant is dropped, so the Flow lane records the fixture as it ships", () => {
  const resolved = unarmedWorkflow(scenario, {});
  assert.equal(resolved.variant, undefined, "no variant is applied, whatever the run selected");
  assert.deepEqual(resolved.expected.pageFacts?.map(fact => fact.id), ["unarmed"], "the expectations judged are the workflow's own, not the armed ones");
});

test("a named workflow is still honoured, because only the arming is dropped", () => {
  assert.deepEqual(unarmedWorkflow(scenario, { workflowId: "recover" }).recordingScript.map(step => step.id), ["recover"]);
  assert.deepEqual(unarmedWorkflow(scenario, {}).recordingScript.map(step => step.id), ["sign-in"], "an absent id selects the primary workflow rather than asking for one with no id");
});

test("a workflow the fixture does not declare is the fixture's defect, raised as fixture.invalid", () => {
  assert.throws(
    () => unarmedWorkflow(scenario, { workflowId: "absent" }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid",
    "the bench skips a fixture defect rather than recording a product failure against it",
  );
});
