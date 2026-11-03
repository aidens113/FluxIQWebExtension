import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioImporterImplementationBundle } from "fluxiq/components/automation/importer";
import type { AutomationStudioElementTarget } from "fluxiq/automation-studio";
import { prepareWebRecordingEntryTarget } from "../index";

type Entry = Parameters<NonNullable<AutomationStudioImporterImplementationBundle["recordingEntryTargetPreparer"]>>[1];
const action = (override: Partial<Entry> = {}): Entry => ({ type: "action", actionType: "click", origin: "operator", startedAt: 1, parameters: {}, ...override });

test("recording projection gives explicit elementTarget precedence and returns only target data", () => {
  const result = { status: "succeeded" as const, metadata: { original: true } };
  const entry = action({ id: "entry.original", outputId: "web.dom.click", result, parameters: { target: { selector: "#parameter" }, text: "argument" }, target: { type: "original_type", id: "control.original", label: "Original", selector: "#raw", bounds: { x: 1, y: 2, width: 3, height: 4 }, relativePosition: { x: 0.5, y: 0.5 }, visualTarget: { entityId: "entity.original" }, elementTarget: { selector: "#explicit", drawing: "d1.original" }, metadata: { original: true } }, visualTarget: { entityId: "entity.entry", statePath: { namespace: "web", path: "saved" } } });
  const projected = prepareWebRecordingEntryTarget("web", entry)!;
  assert.deepEqual(Object.keys(projected).sort(), ["parameters", "target"]);
  const target = projected.parameters?.target as AutomationStudioElementTarget;
  assert.deepEqual(target.fingerprint, { selector: "#explicit", drawing: "d1.original" });
  assert.equal(target.source, "recording");
  assert.deepEqual(projected.target, { type: "original_type", id: "control.original", label: "Original", selector: "#raw", bounds: { x: 1, y: 2, width: 3, height: 4 }, relativePosition: { x: 0.5, y: 0.5 }, visualTarget: { entityId: "entity.original" }, elementTarget: target, metadata: { original: true } });
  const combined = { ...entry, ...projected };
  assert.equal(combined.id, entry.id);
  assert.equal(combined.outputId, entry.outputId);
  assert.equal(combined.result, result);
  assert.equal(combined.visualTarget, entry.visualTarget);
});

test("parameters.target precedes the raw target and entry visual target", () => {
  const entry = action({ parameters: { target: { selector: "#parameter" } }, target: { selector: "#raw" }, visualTarget: { entityId: "entity.entry" } });
  const projected = prepareWebRecordingEntryTarget("web", entry)!;
  assert.deepEqual((projected.parameters?.target as AutomationStudioElementTarget).fingerprint, { selector: "#parameter" });
  assert.equal((projected.target as Record<string, unknown>).selector, "#raw");
});

test("raw targets merge entry visual identity while retaining candidate and selection diagnostics", () => {
  const entry = action({ target: { type: "ui_element", elementTarget: { kind: "element", fingerprint: { selector: "#saved", drawing: "d1.saved", metadata: { token: "synthetic-sensitive", kept: true } }, candidates: [{ candidateId: "saved", selector: "#saved", drawing: "d1.saved" }], selectedCandidate: { candidateId: "saved", confidence: 0.8, matchedSignals: ["selector"], failedSignals: [] } } } });
  const projected = prepareWebRecordingEntryTarget("web", entry)!;
  const target = projected.parameters?.target as AutomationStudioElementTarget;
  assert.equal(target.candidates?.[0]?.drawing, "d1.saved");
  assert.equal(target.selectedCandidate?.confidence, 0.8);
  assert.deepEqual(target.fingerprint.metadata, { kept: true });
  assert.equal(JSON.stringify(projected).includes("synthetic-sensitive"), false);
  const visual = prepareWebRecordingEntryTarget("web", action({ target: { selector: "#raw" }, visualTarget: { entityId: "entity.entry", statePath: { namespace: "web", path: "saved" } } }))!;
  assert.deepEqual((visual.parameters?.target as AutomationStudioElementTarget).fingerprint, { entityId: "entity.entry", selector: "#raw", statePath: { namespace: "web", path: "saved" } });
});

test("missing identity returns null so Core can preserve the original entry object", () => {
  const entry = action({ parameters: { opaque: { original: true } } });
  assert.equal(prepareWebRecordingEntryTarget("web", entry), null);
  assert.deepEqual(entry.parameters, { opaque: { original: true } });
});

test("recording compaction preserves original empty arrays in arbitrary parameters and target metadata", () => {
  const entry = action({ parameters: { empty: [], opaque: { values: [] }, target: { selector: "#saved" } }, target: { metadata: [] } });
  const projected = prepareWebRecordingEntryTarget("web", entry)!;
  assert.deepEqual(projected.parameters?.empty, []);
  assert.deepEqual(projected.parameters?.opaque, { values: [] });
  assert.deepEqual((projected.target as Record<string, unknown>).metadata, []);
});
