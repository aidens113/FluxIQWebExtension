import assert from "node:assert/strict";
import { test } from "node:test";
import { CLEAN_ENVIRONMENT_STEPS, OWNER_ACTIONS, evaluateReleaseCandidate } from "../release-candidate-checklist.mjs";

const passing = { status: "pass", at: "2026-10-01T10:00:00Z", browser: "Chrome 134", notes: "" };
const everyStep = (steps, record) => Object.fromEntries(steps.map((step) => [step.id, record]));
const rate = (value) => ({ count: 0, total: 0, workflows: 0, rate: value });
const benchReport = (overrides = {}) => ({
  schemaVersion: "0.1", corpusId: "fluxbench-week1", repeatCount: 3, workflows: [{}], llm: { mode: "disabled", profileId: null, calls: 0 },
  metrics: { ratesByLane: { flow: { flowCreationSuccess: rate(0.9), initialExecutionSuccess: rate(0.95), deterministicReplaySuccess: rate(1), fuzzyRecovery: rate(0.8), failureClassificationAccuracy: rate(0.95), falseSuccess: rate(0), ...overrides } } }
});
const base = { packaging: { ok: true, detail: "" }, docsMissing: [] };

test("with no evidence and no bench report, nothing passes that was not checked", () => {
  const { ready, items } = evaluateReleaseCandidate({ ...base, evidence: {}, benchReports: [] });
  assert.equal(ready, false);
  assert.equal(items.filter((item) => item.status === "pending").length, CLEAN_ENVIRONMENT_STEPS.length + OWNER_ACTIONS.length + 1);
  assert.deepEqual(items.filter((item) => item.status === "pass").map((item) => item.id), ["store-packages", "user-docs"]);
});

test("complete evidence and a qualifying bench report make the candidate ready", () => {
  const evidence = { owner: everyStep(OWNER_ACTIONS, passing), cleanEnvironment: everyStep(CLEAN_ENVIRONMENT_STEPS, passing) };
  const result = evaluateReleaseCandidate({ ...base, evidence, benchReports: [{ file: "a/report.json", report: benchReport() }] });
  assert.equal(result.ready, true, JSON.stringify(result.items.filter((item) => item.status !== "pass")));
});

test("a pass without a time, a failed step, a failed package and a weak bench each block the candidate", () => {
  const evidence = { owner: everyStep(OWNER_ACTIONS, passing), cleanEnvironment: { ...everyStep(CLEAN_ENVIRONMENT_STEPS, passing), onboarding: { status: "pass" }, persistence: { status: "fail", at: "x", notes: "lost after restart" } } };
  const result = evaluateReleaseCandidate({ packaging: { ok: false, detail: "placeholder id" }, docsMissing: ["docs/user/install.md"], evidence, benchReports: [{ file: "b/report.json", report: benchReport({ falseSuccess: rate(0.1) }) }] });
  const failed = Object.fromEntries(result.items.filter((item) => item.status === "fail").map((item) => [item.id, item.detail]));
  assert.deepEqual(Object.keys(failed).sort(), ["fluxbench-1", "onboarding", "persistence", "store-packages", "user-docs"]);
  assert.match(failed["fluxbench-1"], /falseSuccess 0\.100 > 0\.02/);
  assert.match(failed.onboarding, /must say when/);
});

test("a bench report with too few repeats or no flow lane does not qualify", () => {
  const thin = evaluateReleaseCandidate({ ...base, evidence: {}, benchReports: [{ file: "c/report.json", report: { ...benchReport(), repeatCount: 1, metrics: {} } }] });
  const item = thin.items.find((entry) => entry.id === "fluxbench-1");
  assert.equal(item.status, "fail");
  assert.match(item.detail, /repeatCount 1 < 3/);
  assert.match(item.detail, /no flow-lane rates/);
});
