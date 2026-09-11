import assert from "node:assert/strict";
import test from "node:test";
import { validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { getScenarioManifest, listScenarioManifests, listScenarios } from "../registry.js";
import { basicFormScenario } from "../scenarios/basic-form/scenario.js";
import { createScenarioManifest, defineScenario, scenarioIds } from "../types.js";

test("all twelve registered fixtures expose valid versioned WebScenario manifests", () => {
  const definitions = listScenarios();
  const manifests = listScenarioManifests();
  assert.equal(definitions.length, 12);
  assert.equal(manifests.length, 12);
  assert.deepEqual(definitions.map(({ id }) => id), [...scenarioIds]);

  for (const definition of definitions) {
    const result = validateWebScenario(definition.manifest);
    assert.equal(result.valid, true, result.valid ? definition.id : `${definition.id}: ${JSON.stringify(result.issues)}`);
    assert.equal(definition.manifest.schemaVersion, "0.1", definition.id);
    assert.equal(definition.manifest.id, definition.id, definition.id);
    assert.equal(definition.manifest.title, definition.title, definition.id);
    assert.equal(definition.manifest.startPath, definition.startPath, definition.id);
    assert.equal(definition.manifest.seed, definition.seed, definition.id);
    if (definition.id === "instruction-only-form") {
      assert.equal(definition.manifest.recordingScript.length, 0);
      assert.ok(definition.manifest.playbackGoal);
    } else {
      assert.ok(definition.manifest.recordingScript.length > 0, definition.id);
      assert.ok(definition.manifest.recordingScript.some(({ operation }) => operation !== "checkpoint"), `${definition.id} needs a semantic action step`);
    }
    assert.equal(definition.manifest.networkPolicy, "loopback-only", definition.id);
    assert.equal(definition.manifest.evidencePolicy?.screenshots, "events", definition.id);
    assert.ok(Object.values(definition.manifest.expected).some((expectations) => Array.isArray(expectations) && expectations.length > 0), `${definition.id} needs expected behavior`);
    assert.deepEqual(definition.createState(definition.seed), definition.createState(definition.manifest.seed), definition.id);
    assert.equal(getScenarioManifest(definition.id), definition.manifest, definition.id);
  }
});

test("manifest ids, paths, seeds, and step ids are unique across the corpus", () => {
  const manifests = listScenarioManifests();
  assert.equal(new Set(manifests.map(({ id }) => id)).size, manifests.length);
  assert.equal(new Set(manifests.map(({ startPath }) => startPath)).size, manifests.length);
  assert.equal(new Set(manifests.map(({ seed }) => seed)).size, manifests.length);
  for (const manifest of manifests) {
    assert.equal(new Set(manifest.recordingScript.map(({ id }) => id)).size, manifest.recordingScript.length, manifest.id);
  }
});

test("the deterministic corpus cannot opt into real-site networking", () => {
  const realSiteManifests = listScenarioManifests().filter(({ networkPolicy }) => networkPolicy === "allowlisted-real-site");
  assert.deepEqual(realSiteManifests, []);
});

test("fixture construction fails fast for invalid or disagreeing manifests", () => {
  assert.throws(() => createScenarioManifest({
    id: "invalid", title: "Invalid", tags: [], seed: 1, startPath: "/invalid",
    capabilities: [], recordingScript: [], expected: {},
  }), /WebScenario validation failed/);
  assert.throws(() => defineScenario({ ...basicFormScenario, startPath: "/wrong-path" }), /definition and manifest disagree: startPath/);
});
