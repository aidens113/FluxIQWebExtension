import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { resolveScenarioWorkflow, validateWebScenario, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import { loadDeclaredFlowRepairs, parseDeclaredFlowRepairs, withDeclaredFlowRepair } from "../declared-repair.js";

// `renamed-redesign` declared the repaired run's save, so a live `adapt` run --
// which only proposes a repair and never retries -- was "unexpected" however
// well it repaired. The scenario now declares what such a run ends with and
// what it must propose; these hold the runner to reading that, and to nothing
// else.

const NOTHING_SAVED = { id: "nothing-saved", subject: "save-status", predicate: "text", value: "" };
const SAVED = { id: "settings-saved", subject: "save-status", predicate: "text", value: "Saved: Aurora Field Team" };

const scenario: WebScenario = {
  schemaVersion: "0.1",
  id: "identity-drift",
  title: "Identity drift",
  tags: ["forms"],
  seed: 121,
  startPath: "/scenarios/identity-drift/",
  capabilities: ["forms"],
  networkPolicy: "loopback-only",
  recordingScript: [
    { id: "enter-workspace-name", operation: "type", target: "testid:display-name", value: "Aurora Field Team" },
    { id: "save-changes", operation: "click", target: "testid:save-changes" },
  ],
  expected: { actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }], finalState: [SAVED] },
  variants: [
    { id: "renamed-redesign", description: "Save is renamed.", arm: { operation: "set-mode", payload: { mode: "renamed-redesign" } }, expected: { actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }], finalState: [SAVED] } },
    { id: "selector-only", description: "Save's id changes.", arm: { operation: "set-mode", payload: { mode: "selector-only" } }, expected: {} },
  ],
} as WebScenario;

const declaration = {
  variantId: "renamed-redesign",
  proposalOnlyOutcome: {
    actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "failed" }],
    finalState: [NOTHING_SAVED],
    failure: { category: "target_not_found", code: "web.target.not_found" },
  },
  proposal: { patchKind: "temporary_target_override", target: { tagName: "button", accessibleName: "Apply changes", controlType: "submit" } },
};

/** A scenario lab build holding `scenarios/identity-drift/repair.js` exporting `source`, or no module at all. */
async function labDist(t: TestContext, source?: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-declared-repair-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  if (source !== undefined) {
    await mkdir(path.join(root, "scenarios", "identity-drift"), { recursive: true });
    await writeFile(path.join(root, "scenarios", "identity-drift", "repair.js"), source);
  }
  return root;
}

const moduleExporting = (value: unknown) => `export const SCENARIO_REPAIRS = ${JSON.stringify(value)};\n`;

test("the fixture this file uses is a valid scenario", () => {
  assert.equal(validateWebScenario(scenario).valid, true);
});

test("a proposal-only Flow-lane run of a declared variant is held to the declared outcome and judged on the declared proposal", async (t) => {
  const dist = await labDist(t, moduleExporting([declaration]));
  const workflow = resolveScenarioWorkflow(scenario, { variantId: "renamed-redesign" });
  const held = await withDeclaredFlowRepair(workflow, { scenario, scenarioLabDist: dist, flowLane: true, proposalOnly: true });
  assert.deepEqual(held.workflow.expected, { ...workflow.expected, ...declaration.proposalOnlyOutcome });
  assert.equal(held.workflow.variant?.id, "renamed-redesign");
  assert.deepEqual(held.workflow.recordingScript, workflow.recordingScript);
  assert.deepEqual(held.repair, declaration.proposal);
});

test("every other run is left exactly as it came, with nothing to judge", async (t) => {
  const dist = await labDist(t, moduleExporting([declaration]));
  const declared = resolveScenarioWorkflow(scenario, { variantId: "renamed-redesign" });
  const cases = [
    ["a provider-free run, or one whose grant executes", declared, { flowLane: true, proposalOnly: false }],
    ["a run off the Flow lane", declared, { flowLane: false, proposalOnly: true }],
    ["a run with no variant", resolveScenarioWorkflow(scenario), { flowLane: true, proposalOnly: true }],
    ["a variant with no declaration", resolveScenarioWorkflow(scenario, { variantId: "selector-only" }), { flowLane: true, proposalOnly: true }],
  ] as const;
  for (const [name, workflow, flags] of cases) {
    const held = await withDeclaredFlowRepair(workflow, { scenario, scenarioLabDist: dist, ...flags });
    assert.equal(held.workflow, workflow, name);
    assert.equal(held.repair, undefined, name);
  }
  // A scenario that declares no repair module declares nothing.
  const bare = await labDist(t);
  assert.deepEqual(await loadDeclaredFlowRepairs(bare, "identity-drift"), []);
  const held = await withDeclaredFlowRepair(declared, { scenario, scenarioLabDist: bare, flowLane: true, proposalOnly: true });
  assert.equal(held.workflow, declared);
  assert.equal(held.repair, undefined);
});

test("a declaration no run could meet refuses before anything starts, as the scenario's defect", async (t) => {
  const unrecordable = { ...declaration, proposalOnlyOutcome: { ...declaration.proposalOnlyOutcome, actions: [{ action: "web.dom.select", outcome: "failed" }] } };
  const dist = await labDist(t, moduleExporting([unrecordable]));
  await assert.rejects(
    withDeclaredFlowRepair(resolveScenarioWorkflow(scenario, { variantId: "renamed-redesign" }), { scenario, scenarioLabDist: dist, flowLane: true, proposalOnly: true }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid" && /The declared repair of renamed-redesign is not a valid expectation: \$\.variants\[0\]\.expected\.actions/u.test(error.message),
  );
});

test("a malformed declaration is refused by position and field, never by what it says", () => {
  const refused = (value: unknown, pattern: RegExp) => assert.throws(
    () => parseDeclaredFlowRepairs(value),
    (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid" && pattern.test(error.message) && !error.message.includes("Apply changes"),
    pattern.source,
  );
  refused({ variantId: "renamed-redesign" }, /SCENARIO_REPAIRS must be an array/u);
  refused([{ ...declaration, extra: true }], /SCENARIO_REPAIRS\[0\] has an unsupported field \(extra\)/u);
  refused([{ ...declaration, variantId: "Renamed Redesign" }], /SCENARIO_REPAIRS\[0\]\.variantId must be a kebab-case variant id/u);
  refused([declaration, declaration], /SCENARIO_REPAIRS\[1\]\.variantId repeats a variant/u);
  refused([{ ...declaration, proposalOnlyOutcome: {} }], /SCENARIO_REPAIRS\[0\]\.proposalOnlyOutcome must replace at least one expectation/u);
  refused([{ ...declaration, proposalOnlyOutcome: { pageFacts: [] } }], /proposalOnlyOutcome has an unsupported field \(pageFacts\)/u);
  refused([{ ...declaration, proposal: { ...declaration.proposal, patchKind: "temporary_reroute" } }], /proposal\.patchKind must be one of temporary_target_override/u);
  refused([{ ...declaration, proposal: { ...declaration.proposal, target: {} } }], /proposal\.target must name at least one field/u);
  refused([{ ...declaration, proposal: { ...declaration.proposal, target: { selector: "#save" } } }], /proposal\.target has an unsupported field \(selector\)/u);
  refused([{ ...declaration, proposal: { ...declaration.proposal, target: { accessibleName: "" } } }], /proposal\.target\.accessibleName must be a string of 1 to 200 characters/u);
  assert.deepEqual(parseDeclaredFlowRepairs([declaration]), [declaration]);
});

test("a repair module that does not export the declarations is the scenario's defect", async (t) => {
  const dist = await labDist(t, "export const OTHER = [];\n");
  await assert.rejects(loadDeclaredFlowRepairs(dist, "identity-drift"), /SCENARIO_REPAIRS must be an array/u);
  await assert.rejects(loadDeclaredFlowRepairs(dist, "../escape"), /scenarioId must be a kebab-case scenario id/u);
});
