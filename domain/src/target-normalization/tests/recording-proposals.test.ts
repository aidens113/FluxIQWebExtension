import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AutomationStudioService } from "fluxiq/automation-studio";
import { AutomationStudioNativeNodeRuntime } from "fluxiq/runtime/native-execution";
import type { AutomationStudioImporterSdkManifest } from "fluxiq/components/automation/importer";
import { IoRegistry } from "fluxiq/io";
import type { JsonObject } from "fluxiq/core";
import { normalizeWebRecordingCandidateParameters } from "../index";

let tempRoot: string;
const services = new Set<AutomationStudioService>();
function createService(...args: ConstructorParameters<typeof AutomationStudioService>): AutomationStudioService {
  const service = new AutomationStudioService(...args);
  services.add(service);
  return service;
}

describe("AutomationStudioService recording persistence", { timeout: 60_000 }, () => {
beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "fluxiq-automation-studio-service-"));
  });
afterEach(async () => {
    await Promise.all([...services].map((service) => service.close()));
    services.clear();
    await rm(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
  });
it("normalizes mapper element targets in recording Flow proposals, taking identity from a recorded element and never from typed text", async () => {
    let parameters: JsonObject = {};
    const io = new IoRegistry();
    io.registerOutput("example", { definition: { id: "click", title: "Click" }, mode: "request", dispatch: (request) => ({ ok: true, domainId: "example", outputId: request.outputId }) });
    const manifest: AutomationStudioImporterSdkManifest = { schemaVersion: "0.1", sdkVersion: "0.1", packageId: "example.importer", packageVersion: "1.0.0", domainId: "example", nodes: [], recordingMappers: [{ id: "click-mapper", version: "1.0.0", description: "Maps clicks", outputIds: ["click"] }] };
    const runtime = new AutomationStudioNativeNodeRuntime().register(manifest, {
        packageId: "example.importer", packageVersion: "1.0.0", implementations: {},
        recordingMappers: { "click-mapper": () => ({ outputId: "click", parameters, confidence: 0.9 }) },
        recordingCandidateParameterNormalizer: normalizeWebRecordingCandidateParameters
    });
    const service = createService({ dataDir: tempRoot }).bindIoRuntime(io, "example").bindNativeNodeRuntime(runtime);
    const project = await service.createProject({ name: "Mapped element target", domainId: "example" });
    const element = { tagName: "input", implicitRole: "textbox", accessibleName: "Display name", id: "display-name" };
    const identity = { tagName: "input", role: "textbox", accessibleName: "Display name", id: "display-name" };
    const cases: Array<[
        string,
        JsonObject,
        JsonObject
    ]> = [
        ["explicit target", { target: { selector: "button[data-testid='save']", visibleText: "Save", testId: "save" } }, { selector: "button[data-testid='save']", visibleText: "Save", testId: "save" }],
        ["typed text beside an element", { selector: "#display-name", statePath: "web.elements.display.name", text: "Ada Lovelace", element }, { selector: "#display-name", statePath: "web.elements.display.name", ...identity }],
        ["bare locator target beside an element", { target: { selector: "#display-name" }, text: "Ada Lovelace", element }, { selector: "#display-name", ...identity }]
    ];
    for (const [index, [label, recorded, fingerprint]] of cases.entries()) {
        parameters = recorded;
        const recording = await service.createRecording({ description: "Shows the steps the automation repeats.", projectId: project.id, recordingId: `recording.mapper-element-target.${index}`, domainId: "example", initialState: { timestamp: 1, namespaces: {} } });
        await service.appendRecordingEvent({ projectId: project.id, recordingId: recording.recordingId, entry: { type: "observation", observationType: "clicked", payload: {}, timestamp: 2 } });
        const { proposals: [proposal] } = await service.createRecordingFlowProposals({ projectId: project.id, recordingId: recording.recordingId });
        const target = proposal?.candidates[0]?.parameters.target;
        assert.deepEqual(target, { kind: "element", source: "mapper", fingerprint }, label);
        assert.equal(JSON.stringify(target).includes("Ada Lovelace"), false, label);
    }
});
});
