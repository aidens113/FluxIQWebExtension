import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import type { RenderContext } from "../../../types.js";
import { identityDriftModes, type IdentityDriftMode } from "../modes.js";
import { renderSaveAction } from "../save-action.js";
import { identityDriftScenario as scenario } from "../scenario.js";

const context: RenderContext = { runToken: "identity-drift-unit-token", seed: 42 };
const manifest = scenario.manifest;
const workspaceName = "Aurora Field Team";
const driftModes = identityDriftModes.filter((mode) => mode !== "baseline");

function pageIn(mode: IdentityDriftMode): string {
  return scenario.render(scenario.mutate(scenario.createState(42), "set-mode", { mode }), context);
}

/** The markup inside the element carrying `data-testid`, up to its first closing `tag`. */
function region(html: string, testId: string, tag: string): string {
  const match = new RegExp(`data-testid="${testId}">([\\s\\S]*?)</${tag}>`).exec(html);
  assert.ok(match, `no ${testId} region`);
  return match[1] ?? "";
}

/** The first submit button in `fragment`: its attributes after `type`, and its text without tags. */
function submitButton(fragment: string): { attributes: Record<string, string>; text: string } {
  const match = /<button type="submit"([^>]*)>([\s\S]*?)<\/button>/.exec(fragment);
  assert.ok(match, "no submit button");
  const attributes = Object.fromEntries([...(match[1] ?? "").matchAll(/([a-z-]+)="([^"]*)"/g)].map((pair) => [pair[1] ?? "", pair[2] ?? ""]));
  return { attributes, text: (match[2] ?? "").replace(/<[^>]+>/g, "").trim() };
}

test("manifest keeps the placeholder identity, validates, and records through the baseline target", () => {
  assert.equal(validateWebScenario(manifest).valid, true);
  assert.deepEqual({ id: scenario.id, seed: scenario.seed, startPath: scenario.startPath }, { id: "identity-drift", seed: 121, startPath: "/scenarios/identity-drift/" });
  assert.equal(manifest.networkPolicy, "loopback-only");
  assert.deepEqual(manifest.recordingScript, [
    { id: "enter-workspace-name", operation: "type", target: "testid:display-name", value: workspaceName },
    { id: "save-changes", operation: "click", target: "testid:save-changes" },
    { id: "settings-saved", operation: "checkpoint" },
  ]);
  assert.deepEqual(manifest.expected.finalState, [{ id: "settings-saved", subject: "save-status", predicate: "text", value: `Saved: ${workspaceName}` }]);
  assert.deepEqual(manifest.playbackGoal?.successFacts, manifest.expected.finalState);
  assert.equal(manifest.expected.failure, undefined);
  assert.equal(manifest.workflows, undefined);
});

test("each drift mode is one variant, armed by one set-mode and expected to save successfully", () => {
  const variants = manifest.variants ?? [];
  assert.deepEqual(variants.map((variant) => variant.id), driftModes);
  for (const variant of variants) {
    assert.deepEqual(variant.arm, { operation: "set-mode", payload: { mode: variant.id } });
    const resolved = resolveScenarioWorkflow(manifest, { variantId: variant.id });
    assert.equal(resolved.expected.failure, undefined, variant.id);
    assert.deepEqual(resolved.expected.finalState, manifest.expected.finalState, variant.id);
    assert.deepEqual(resolved.expected.actions, [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }], variant.id);
    assert.equal(resolved.recordingScript, manifest.recordingScript, variant.id);
  }
});

test("state is seeded deterministically and renders identically for one seed", () => {
  assert.deepEqual(scenario.createState(42), {
    mode: "baseline", defaultDisplayName: "Workspace 42", savedDisplayName: null, saveCount: 0,
    savedInMode: null, discardCount: 0, lastOperation: "seeded", status: "",
  });
  assert.notEqual(scenario.createState(42), scenario.createState(42));
  assert.equal(scenario.createState(7).defaultDisplayName, "Workspace 7");
  for (const mode of identityDriftModes) assert.equal(pageIn(mode), pageIn(mode), mode);
  assert.match(pageIn("baseline"), /id="display-name"[^>]*value="Workspace 42"/);
});

test("save records the trimmed name and the rendering it went through; invalid saves change nothing", () => {
  const seeded = scenario.createState(42);
  const saved = scenario.mutate(seeded, "save", { displayName: `  ${workspaceName}  ` });
  assert.deepEqual(saved, { ...seeded, savedDisplayName: workspaceName, saveCount: 1, savedInMode: "baseline", lastOperation: "saved", status: `Saved: ${workspaceName}` });
  for (const payload of [{ displayName: "   " }, { displayName: 5 }, { displayName: "x".repeat(81) }, {}, null, workspaceName]) {
    assert.equal(scenario.mutate(seeded, "save", payload), seeded, JSON.stringify(payload));
  }
  const html = scenario.render(saved, context);
  assert.match(html, new RegExp(`value="${workspaceName}"`));
  assert.match(html, new RegExp(`data-testid="save-status"[^>]*>Saved: ${workspaceName}</p>`));
  assert.match(scenario.render(scenario.mutate(seeded, "save", { displayName: "<b>Aurora</b>" }), context), /value="&lt;b&gt;Aurora&lt;\/b&gt;"/);
});

test("discard is recorded without undoing an earlier save", () => {
  const saved = scenario.mutate(scenario.createState(42), "save", { displayName: workspaceName });
  const discarded = scenario.mutate(saved, "discard", {});
  assert.deepEqual(discarded, { ...saved, discardCount: 1, lastOperation: "discarded", status: "Changes discarded" });
  assert.match(scenario.render(discarded, context), /data-testid="save-status"[^>]*>Changes discarded<\/p>/);
});

test("each variant arm switches the rendering and clears the save record; bad arms change nothing", () => {
  const recorded = scenario.mutate(scenario.mutate(scenario.createState(42), "save", { displayName: workspaceName }), "discard", {});
  for (const variant of manifest.variants ?? []) {
    const armed = scenario.mutate(recorded, variant.arm.operation, variant.arm.payload);
    assert.deepEqual(armed, {
      mode: variant.id, defaultDisplayName: "Workspace 42", savedDisplayName: null, saveCount: 0,
      savedInMode: null, discardCount: 0, lastOperation: "armed", status: "",
    });
    const resaved = scenario.mutate(armed, "save", { displayName: workspaceName });
    assert.equal(resaved.savedInMode, variant.id);
    assert.equal(resaved.saveCount, 1);
    assert.equal(scenario.mutate(resaved, "set-mode", { mode: "baseline" }).mode, "baseline");
  }
  for (const [operation, payload] of [["set-mode", { mode: "renamed" }], ["set-mode", {}], ["set-mode", null], ["reset", {}], ["delete", { mode: "moved" }]] as const) {
    assert.equal(scenario.mutate(recorded, operation, payload), recorded, `${operation} ${JSON.stringify(payload)}`);
  }
});

test("only the baseline carries the recorded test id; every mode keeps the field and one submit control", () => {
  assert.match(pageIn("baseline"), /data-testid="save-changes"/);
  for (const mode of driftModes) assert.doesNotMatch(pageIn(mode), /data-testid="save-changes"/, mode);
  for (const mode of identityDriftModes) {
    const html = pageIn(mode);
    assert.match(html, /data-testid="display-name"/, mode);
    assert.equal(html.match(/type="submit"/g)?.length, 1, mode);
  }
});

test("each drifted rendering changes only what its corpus row describes", () => {
  assert.deepEqual(submitButton(renderSaveAction("baseline")), { attributes: { id: "save-settings", class: "btn btn-primary", "data-testid": "save-changes" }, text: "Save changes" });

  const selectorOnly = region(pageIn("selector-only"), "primary-actions", "div");
  assert.deepEqual(submitButton(selectorOnly), { attributes: { id: "workspace-settings-submit", class: "ui-button ui-button--accent", "data-testid": "settings-submit" }, text: "Save changes" });
  assert.ok(selectorOnly.indexOf('type="submit"') < selectorOnly.indexOf('type="reset"'));

  const textOnly = region(pageIn("text-only"), "primary-actions", "div");
  assert.deepEqual(submitButton(textOnly), { attributes: { id: "save-settings", class: "btn btn-primary" }, text: "Apply changes" });
  assert.ok(textOnly.indexOf('type="submit"') < textOnly.indexOf('type="reset"'));

  const moved = pageIn("moved");
  assert.doesNotMatch(region(moved, "primary-actions", "div"), /type="submit"/);
  assert.deepEqual(submitButton(region(moved, "footer-actions", "footer")), { attributes: { id: "save-settings", class: "btn btn-primary" }, text: "Save changes" });
  for (const mode of identityDriftModes.filter((candidate) => candidate !== "moved")) {
    assert.doesNotMatch(region(pageIn(mode), "footer-actions", "footer"), /type="submit"/, mode);
  }

  const wrapped = region(pageIn("wrapped-aria"), "primary-actions", "div");
  assert.deepEqual(submitButton(wrapped), { attributes: { id: "save-settings", class: "btn btn-primary", "aria-labelledby": "save-settings-label" }, text: "Save changes" });
  assert.match(wrapped, /^<span class="action-slot"><span class="action-frame"><button /);
  assert.match(wrapped, /<span id="save-settings-label" class="btn-label">Save changes<\/span>/);
});

test("the fixture serves no documents beyond its start page", () => {
  assert.equal(scenario.route, undefined);
});
