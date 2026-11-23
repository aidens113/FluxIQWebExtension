import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { AutomationStudioGatewayTraceEpisodes, AutomationStudioGatewayTraceInstallation } from "fluxiq/automation";
import { ClientGatewayTraceMemoryStore } from "fluxiq/client-gateway";
import { openOfflineTrialHost } from "../../../offline-trial-experiment/run/offline-trial/index.js";
import { captureRecordedStart, recordedStoreDigest, verifyRecordedStartingPosition, type RecordedAttemptArtifact } from "../../index.js";
import { recordedCaptureRequest } from "../request.js";

test("a closed fixture snapshot gets one actual trace receipt, binding source membership, request and snapshot", async () => {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../..");
  await mkdir(path.join(repositoryRoot, "test-runs"), { recursive: true });
  const work = await mkdtemp(path.join(repositoryRoot, "test-runs", "recorded-start-test-"));
  const rootDir = path.join(work, "execution");
  await mkdir(rootDir);
  const host = openOfflineTrialHost({ rootDir });
  const entry = { request: recordedCaptureRequest({ projectId: "project.fixture", flowId: "flow.fixture", taskId: "company-website-apprentices", startLocation: "http://127.0.0.1/company" }), chat: null };
  const store = new ClientGatewayTraceMemoryStore();
  const episodes = new AutomationStudioGatewayTraceEpisodes({ enabled: true, storeFor: () => store, now: Date.now, flush: { everyEvents: 100, intervalMs: 60_000 }, contractVersions: {}, gatewayStreams: [] });
  let uninstall: (() => void) | undefined;
  let closedByCapture = false;
  try {
    await host.fluxiq.setup();
    const capture = await captureRecordedStart({ repositoryRoot, host, rootDir, work: path.join(work, "snapshot"), projectId: "project.fixture", flowId: "flow.fixture", taskId: "company-website-apprentices", oracleDigest: "a".repeat(64), entry });
    closedByCapture = true;
    assert.equal(await recordedStoreDigest(capture.snapshot.fluxiqDir), capture.storeDigest);
    assert.equal(await recordedStoreDigest(path.join(rootDir, ".fluxiq"), ["security"]), capture.storeDigest);
    assert.throws(() => capture.attach(entry), /trace_mismatch/u);
    uninstall = AutomationStudioGatewayTraceInstallation.install(episodes);
    let position: ReturnType<typeof capture.attach> | undefined;
    await episodes.run({ projectId: "project.fixture", flowId: "flow.fixture", episodeId: "build.fixture", activity: "exploration", context: { schema: { name: "recorded-start-unit", version: "1" }, value: {} } }, async () => {
      position = capture.attach(entry);
      assert.equal(capture.attach(entry), position);
      assert.throws(() => capture.attach({ changed: true }), /entry_changed/u);
    });
    const manifest = await store.readManifest(position!.sourceTraceId);
    assert.ok(manifest);
    assert.equal(manifest.artifacts.length, 1);
    const artifact: RecordedAttemptArtifact = { version: 1, provenance: "synthetic-fixture", scenarioId: "company-website", taskId: "company-website-apprentices", oracleDigest: "a".repeat(64), source: { core: "fixture", extension: "fixture" }, startingStore: { copied: true, digest: capture.storeDigest, position: position! }, domainEvidenceDigest: null, exchanges: [] };
    const input = { artifact, manifest, store, entry, projectId: "project.fixture", flowId: "flow.fixture" };
    assert.equal((await verifyRecordedStartingPosition(input)).point, "before_entry");
    await assert.rejects(() => verifyRecordedStartingPosition({ ...input, entry: { ...entry, request: { ...entry.request, taskProcessing: { process: { columns: ["name"] } } } } }), /binding_changed/u);
    await assert.rejects(() => verifyRecordedStartingPosition({ ...input, entry: { changed: true } }), /binding_changed/u);
    await assert.rejects(() => verifyRecordedStartingPosition({ ...input, artifact: { ...artifact, startingStore: { ...artifact.startingStore, digest: "b".repeat(64) } } }), /binding_changed/u);
    await assert.rejects(() => verifyRecordedStartingPosition({ ...input, manifest: { ...manifest, artifacts: [] } }), /not_in_source/u);
    await assert.rejects(() => verifyRecordedStartingPosition({ ...input, store: { readArtifact: async () => undefined } }), /bytes_missing/u);
    await assert.rejects(() => episodes.run({ projectId: "another", flowId: "flow.fixture", episodeId: "build.wrong", activity: "exploration", context: { schema: { name: "recorded-start-unit", version: "1" }, value: {} } }, async () => capture.attach(entry)), /trace_mismatch/u);
  } finally {
    uninstall?.();
    if (!closedByCapture) await host.close();
    await rm(work, { recursive: true, force: true });
  }
});
