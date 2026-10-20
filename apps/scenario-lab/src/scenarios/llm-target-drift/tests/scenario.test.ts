import assert from "node:assert/strict";
import test from "node:test";
import { startScenarioLab } from "../../../server.js";
import { llmTargetDriftScenario } from "../scenario.js";

test("target drift state is seeded, switchable, restorable, and repeatably inert while missing", () => {
  const baseline = llmTargetDriftScenario.createState(42);
  assert.deepEqual(baseline, {
    seedMarker: "target-drift-seed-42", mode: "baseline", activationCount: 0, transitionCount: 0, lastOperation: "seeded",
    oracle: { recordedTargetTestId: "diagnosis-target", renderedTargetTestId: "diagnosis-target", targetPresent: true, expectedResult: "Ready" },
  });
  const activated = llmTargetDriftScenario.mutate(baseline, "activate", {});
  assert.equal(activated.oracle.expectedResult, "Completed: 1");
  const missing = llmTargetDriftScenario.mutate(activated, "set-mode", { mode: "missing" });
  assert.deepEqual(missing, {
    seedMarker: "target-drift-seed-42", mode: "missing", activationCount: 0, transitionCount: 1, lastOperation: "missing",
    oracle: { recordedTargetTestId: "diagnosis-target", renderedTargetTestId: null, targetPresent: false, expectedResult: "Target missing: deterministic failure armed" },
  });
  assert.deepEqual(llmTargetDriftScenario.mutate(missing, "activate", {}), missing);
  assert.deepEqual(llmTargetDriftScenario.mutate(missing, "activate", {}), missing);
  const renamed = llmTargetDriftScenario.mutate(missing, "set-mode", { mode: "renamed" });
  assert.equal(renamed.oracle.renderedTargetTestId, "diagnosis-target-v2");
  const restored = llmTargetDriftScenario.mutate(renamed, "restore", {});
  assert.match(restored.seedMarker, /42$/);
  assert.equal(restored.mode, "baseline");
  assert.equal(restored.activationCount, 0);
  assert.equal(restored.oracle.expectedResult, "Ready");
});

test("target drift manifest records only the stable baseline action and declares loopback evidence", () => {
  const manifest = llmTargetDriftScenario.manifest;
  assert.equal(manifest.networkPolicy, "loopback-only");
  assert.deepEqual(manifest.recordingScript, [
    { id: "activate-recorded-target", operation: "click", target: "testid:diagnosis-target" },
    { id: "baseline-completed", operation: "checkpoint" },
  ]);
  assert.deepEqual(manifest.expected.actions, [{ action: "web.dom.click", outcome: "succeeded" }]);
  assert.deepEqual(manifest.expected.finalState, [{ id: "baseline-completed", subject: "result", predicate: "text", value: "Completed: 1" }]);
  assert.equal(manifest.evidencePolicy?.reviewRequired, true);
});
test("each mode renders exactly the target its oracle names, with the oracle's result text and the seed marker", () => {
  const context = { runToken: "llm-target-drift-unit-token", seed: 42 };
  const baseline = llmTargetDriftScenario.createState(42);
  const missing = llmTargetDriftScenario.mutate(baseline, "set-mode", { mode: "missing" });
  const renamed = llmTargetDriftScenario.mutate(baseline, "set-mode", { mode: "renamed" });
  const restored = llmTargetDriftScenario.mutate(renamed, "restore", {});
  for (const state of [baseline, llmTargetDriftScenario.mutate(baseline, "activate", {}), missing, renamed, restored]) {
    const html = llmTargetDriftScenario.render(state, context);
    // The client script names the target too; only the markup above it is the page.
    const markup = html.slice(0, html.indexOf("<script"));
    const rendered = [...markup.matchAll(/data-testid="(diagnosis-target(?:-v2)?)"/gu)].map(([, id]) => id);
    assert.deepEqual(rendered, state.oracle.renderedTargetTestId === null ? [] : [state.oracle.renderedTargetTestId], state.mode);
    assert.ok(html.includes(`<p data-testid="drift-mode">Mode: ${state.mode}</p>`), state.mode);
    assert.ok(html.includes(`<p data-testid="result" aria-live="polite">${state.oracle.expectedResult}</p>`), state.mode);
    assert.ok(html.includes('<code data-testid="seed-marker">target-drift-seed-42</code>'), state.mode);
  }
  assert.match(llmTargetDriftScenario.render(renamed, context), /<button data-testid="diagnosis-target-v2" aria-label="Replacement control" type="button">Replacement control<\/button>/u);
  assert.deepEqual({ mode: restored.mode, activationCount: restored.activationCount, lastOperation: restored.lastOperation }, { mode: "baseline", activationCount: 0, lastOperation: "restored" });
});

test("over HTTP, reloading the page while the target is missing changes nothing the oracle reports", async () => {
  const lab = await startScenarioLab({ runToken: "llm-target-drift-http-token", seed: 42 });
  const authorization = { authorization: "Bearer llm-target-drift-http-token" };
  const read = async () => ((await (await fetch(`${lab.origin}/__control/final-state?scenario=llm-target-drift`, { headers: authorization })).json()) as { state: unknown }).state;
  try {
    const armed = await fetch(`${lab.origin}/api/llm-target-drift/set-mode`, { method: "POST", headers: { ...authorization, "content-type": "application/json" }, body: JSON.stringify({ mode: "missing" }) });
    assert.equal(armed.status, 200);
    const first = await read();
    for (let load = 0; load < 2; load += 1) {
      const response = await fetch(`${lab.origin}/scenarios/llm-target-drift/`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.doesNotMatch(html.slice(0, html.indexOf("<script")), /data-testid="diagnosis-target"/u);
    }
    const second = await read();
    assert.deepEqual(second, first);
    assert.deepEqual(second, llmTargetDriftScenario.mutate(llmTargetDriftScenario.createState(42), "set-mode", { mode: "missing" }));
  } finally {
    await lab.close();
  }
});
