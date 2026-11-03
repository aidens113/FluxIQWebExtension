import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioImporterImplementationBundle } from "fluxiq/automation-studio";
import type { AutomationStudioElementTarget } from "fluxiq/automation-studio";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AutomationStudioNativeNodeRuntime, AutomationStudioService } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { createWebAutomationOutputNodeImplementationBundle, createWebAutomationOutputNodeManifest } from "../../output-nodes";
import { prepareWebRecordingEntryTarget } from "../index";

type Entry = Parameters<NonNullable<AutomationStudioImporterImplementationBundle["recordingEntryTargetPreparer"]>>[1];
const action = (override: Record<string, unknown> = {}): Entry => ({ type: "action", actionType: "click", origin: "operator", startedAt: 1, parameters: {}, ...override }) as unknown as Entry;

test("a recorded action reaches storage as the registered web bundle projects it", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "fluxiq-web-recording-entry-"));
  const service = new AutomationStudioService({ dataDir }).bindNativeNodeRuntime(new AutomationStudioNativeNodeRuntime().register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle()));
  try {
    const project = await service.createProject({ name: "Element targets", domainId: WEB_AUTOMATION_DOMAIN_ID });
    const recording = await service.createRecording({ description: "Shows the steps the automation repeats.", projectId: project.id, recordingId: "recording.element-target", domainId: WEB_AUTOMATION_DOMAIN_ID, initialState: { timestamp: 1, namespaces: {} } });
    await service.appendRecordingEvent({ projectId: project.id, recordingId: recording.recordingId, entry: { type: "action", actionType: "click", parameters: {}, target: { type: "client-target", metadata: { visibleText: "Save changes", testId: "save", selector: "button[data-testid='save']", token: "synthetic-sensitive" } }, origin: "operator", startedAt: 2, timestamp: 2 } });
    const stored = await service.getRecordingSession(recording.recordingId, project.id);
    const action = stored.timeline.find((entry) => entry.type === "action");
    assert.ok(action?.type === "action");
    assert.deepEqual(action.target?.elementTarget?.fingerprint, { visibleText: "Save changes", testId: "save", selector: "button[data-testid='save']" });
    assert.equal(action.target?.elementTarget?.kind, "element");
    assert.equal(action.target?.elementTarget?.source, "recording");
    assert.deepEqual((action.parameters.target as AutomationStudioElementTarget).fingerprint, { visibleText: "Save changes", testId: "save", selector: "button[data-testid='save']" });
  } finally {
    await service.close();
    await rm(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
  }
});

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
