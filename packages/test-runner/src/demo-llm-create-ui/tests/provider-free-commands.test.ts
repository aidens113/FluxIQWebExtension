// The five `demo:llm:*` commands that must never reach a provider: the Phase 3
// launcher and the settings, readiness, pending-proposal and revert probes.
// One premise for all of them -- each strips provider secrets from the
// environment it hands the run, and each is read as source text so that a key
// load or a generation call added later is a failing row rather than a bill.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..");

test("Phase 3 launcher strips provider secrets and never loads a provider key", async () => {
  const source = await readFile(path.join(root, "scripts", "run-demo-llm-creation.mjs"), "utf8");
  assert.match(source, /withoutProviderSecrets\(process\.env\)/u);
  assert.match(source, /runDemoLlmCreation/u);
  assert.match(source, /skipPrerequisiteBuilds/u);
  assert.match(source, /--no-build/u);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|recordDemoWorkspace|latestRecordingId/u);
});

test("settings-only probe cannot load provider secrets or reach generation", async () => {
  const source = await readFile(path.join(root, "scripts", "run-demo-llm-creation-settings.mjs"), "utf8");
  assert.match(source, /withoutProviderSecrets\(process\.env\)/u);
  assert.match(source, /runDemoLlmCreationSettingsProbe/u);
  assert.match(source, /providerCallCount: 0/u);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|runDemoLlmCreation\(|generate-flow-bootstrap-adaptation/u);
});
test("readiness-only command strips provider secrets and stops at the exact GET gate", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(packageJson.scripts?.["demo:llm:readiness"], "node scripts/run-demo-llm-creation-readiness.mjs");
  const source = await readFile(path.join(root, "scripts", "run-demo-llm-creation-readiness.mjs"), "utf8");
  assert.match(source, /withoutProviderSecrets\(process\.env\)/u);
  assert.match(source, /runDemoLlmCreationReadinessProbe/u);
  assert.match(source, /providerCallCount: 0/u);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|generate-flow-bootstrap-adaptation|buildApproveApplyCreationViaUi|configureFirstLiveCreationViaUi/u);
});
test("pending-proposal inspection is provider-free and uses the exact scoped control path", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(packageJson.scripts?.["demo:llm:pending"], "node scripts/inspect-demo-llm-pending-creation.mjs");
  const source = await readFile(path.join(root, "scripts", "inspect-demo-llm-pending-creation.mjs"), "utf8");
  assert.match(source, /withoutProviderSecrets\(process\.env\)/u);
  assert.match(source, /runDemoLlmPendingCreationProbe/u);
  assert.match(source, /providerCallCount: 0/u);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|generate-flow-bootstrap-adaptation|rejectFlowAdaptation/u);
});
test("applied bootstrap revert is an explicit provider-free repair command", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(packageJson.scripts?.["demo:llm:revert"], "node scripts/revert-demo-llm-applied-creation.mjs");
  const source = await readFile(path.join(root, "scripts", "revert-demo-llm-applied-creation.mjs"), "utf8");
  assert.match(source, /withoutProviderSecrets\(process\.env\)/u);
  assert.match(source, /runDemoLlmAppliedCreationRevertProbe/u);
  assert.match(source, /providerCallCount: 0/u);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|generate-flow-bootstrap-adaptation/u);
});
