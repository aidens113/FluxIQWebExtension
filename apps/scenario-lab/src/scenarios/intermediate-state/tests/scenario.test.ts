import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { intermediateStateScenario as scenario, type IntermediateStateState } from "../scenario.js";

const context = { runToken: "unit-test-run-token-0001", seed: 122 };
const claim = { employee: "Ada Lovelace", amount: "42.50" };

function apply(state: IntermediateStateState, ...operations: Array<[string, unknown?]>): IntermediateStateState {
  return operations.reduce((current, [operation, payload = {}]) => scenario.mutate(current, operation, payload), state);
}

test("the manifest is valid, loopback-only, and resolves its primary workflow and unannounced variant", () => {
  const manifest = scenario.manifest;
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.equal(manifest.networkPolicy, "loopback-only");
  assert.equal(manifest.workflows, undefined);
  assert.deepEqual(manifest.variants?.map(({ id }) => id), ["unannounced"]);

  const primary = resolveScenarioWorkflow(manifest);
  assert.deepEqual(primary.recordingScript.map(({ id, operation }) => `${id}:${operation}`), [
    "enter-employee:type", "enter-amount:type", "submit-claim:click", "await-result:waitForState", "result-shown:checkpoint",
  ]);
  assert.equal(primary.expected.failure, undefined);

  const unannounced = resolveScenarioWorkflow(manifest, { variantId: "unannounced" });
  assert.deepEqual(unannounced.variant?.arm, { operation: "set-mode", payload: { mode: "unannounced" } });
  assert.deepEqual(unannounced.expected.failure, { category: "output_not_observed" });
  assert.deepEqual(unannounced.expected.finalState?.map(({ id }) => id), ["confirmation-step-shown", "claim-result-absent"]);
  // Recording happens before arming, so what the recording must show is inherited.
  assert.deepEqual(unannounced.expected.pageFacts, primary.expected.pageFacts);
  assert.deepEqual(unannounced.expected.recordingEvents, primary.expected.recordingEvents);
  assert.deepEqual(unannounced.expected.allowedConsoleErrors, []);
  assert.deepEqual(unannounced.recordingScript, primary.recordingScript);
});

test("state is deterministic from the seed", () => {
  assert.deepEqual(scenario.createState(122), scenario.createState(122));
  assert.deepEqual(scenario.createState(122), {
    reference: "EXP-00122", mode: "baseline", phase: "idle", claim: null, submissionCount: 0, confirmationCount: 0, completionCount: 0,
  });
  assert.equal(scenario.createState(42).reference, "EXP-00042");
  assert.deepEqual({ ...scenario.createState(42), reference: "" }, { ...scenario.createState(122), reference: "" });
});

test("baseline: submit enters processing and finishing processing completes the claim without confirmation", () => {
  const seeded = scenario.createState(122);
  const processing = apply(seeded, ["submit", claim]);
  assert.deepEqual(processing, { ...seeded, phase: "processing", claim, submissionCount: 1 });
  assert.deepEqual(seeded, scenario.createState(122), "mutate must not modify its input");
  const complete = apply(processing, ["finish-processing"]);
  assert.deepEqual(complete, { ...processing, phase: "complete", completionCount: 1 });
});

test("submit normalizes the amount and rejects an invalid claim without changing state", () => {
  const seeded = scenario.createState(122);
  assert.deepEqual(apply(seeded, ["submit", { employee: "  Grace Hopper ", amount: "7" }]).claim, { employee: "Grace Hopper", amount: "7.00" });
  assert.deepEqual(apply(seeded, ["submit", { employee: "Grace Hopper", amount: "0042.5" }]).claim, { employee: "Grace Hopper", amount: "42.50" });
  for (const invalid of [{ employee: " ", amount: "42.50" }, { employee: "Ada", amount: "42.505" }, { employee: "Ada", amount: "-1" }, { employee: "Ada" }, "Ada", null]) {
    assert.equal(apply(seeded, ["submit", invalid]), seeded, JSON.stringify(invalid));
  }
});

test("finish-processing and confirm are inert outside their phase, and unknown operations are inert", () => {
  const seeded = scenario.createState(122);
  assert.equal(apply(seeded, ["finish-processing"]), seeded);
  assert.equal(apply(seeded, ["confirm", { confirmed: true }]), seeded);
  const processing = apply(seeded, ["submit", claim]);
  assert.equal(apply(processing, ["confirm", { confirmed: true }]), processing, "baseline processing needs no confirmation");
  const complete = apply(processing, ["finish-processing"]);
  assert.equal(apply(complete, ["finish-processing"]), complete);
  assert.equal(apply(complete, ["reveal"]), complete);
});

test("the unannounced arm clears the recorded claim and inserts a confirmation step before the result", () => {
  const recorded = apply(scenario.createState(122), ["submit", claim], ["finish-processing"]);
  const arm = scenario.manifest.variants?.[0]?.arm;
  assert.ok(arm);
  const armed = scenario.mutate(recorded, arm.operation, arm.payload);
  assert.deepEqual(armed, { ...recorded, mode: "unannounced", phase: "idle", claim: null });

  const awaiting = apply(armed, ["submit", claim], ["finish-processing"]);
  assert.deepEqual(awaiting, { ...armed, phase: "awaiting-confirmation", claim, submissionCount: 2 });
  assert.equal(awaiting.completionCount, 1, "the result is withheld until the unrecorded step is completed");
  for (const unconfirmed of [{}, { confirmed: false }, { confirmed: "true" }, null]) {
    assert.equal(apply(awaiting, ["confirm", unconfirmed]), awaiting, JSON.stringify(unconfirmed));
  }
  assert.deepEqual(apply(awaiting, ["confirm", { confirmed: true }]), { ...awaiting, phase: "complete", confirmationCount: 1, completionCount: 2 });
});

test("set-mode restores baseline and ignores unknown modes", () => {
  const armed = apply(scenario.createState(122), ["set-mode", { mode: "unannounced" }]);
  assert.equal(armed.mode, "unannounced");
  assert.equal(apply(armed, ["set-mode", { mode: "hidden" }]), armed);
  assert.equal(apply(armed, ["set-mode", "baseline"]), armed);
  const restored = apply(armed, ["set-mode", { mode: "baseline" }], ["submit", claim], ["finish-processing"]);
  assert.equal(restored.mode, "baseline");
  assert.equal(restored.phase, "complete");
});

test("the start page is identical in both modes and holds no processing, confirmation, or result markup", () => {
  const baseline = scenario.createState(122);
  const unannounced = apply(baseline, ["set-mode", { mode: "unannounced" }], ["submit", claim], ["finish-processing"]);
  const html = scenario.render(baseline, context);
  assert.equal(scenario.render(unannounced, context), html);
  const markup = html.slice(0, html.indexOf("<script"));
  for (const present of ["claim-form", "employee-name", "claim-amount", "submit-claim", "claim-progress"]) assert.match(markup, new RegExp(`data-testid="${present}"`));
  for (const absent of ["processing", "confirmation-step", "claim-result"]) assert.doesNotMatch(markup, new RegExp(`data-testid="${absent}"`));
  assert.match(html, /<label>Employee name <input/);
  assert.match(html, /const processingDelayMs = 800;/);
  assert.doesNotMatch(html, /Math\.random|Date\.now|new Date|performance\.now/);
});

test("the fixture serves no subpath documents", () => {
  assert.equal(scenario.route, undefined);
});
