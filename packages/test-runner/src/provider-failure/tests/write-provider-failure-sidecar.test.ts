import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { EvidenceBundle } from "@fluxiq-web-extension/test-evidence";
import { PROVIDER_FAILURE_SIDECAR_FILENAME, ProviderFailureLog, writeProviderFailureSidecar } from "../index.js";

const now = () => new Date("2026-09-26T02:44:13.117Z");

const REFUSAL = JSON.stringify({
  ok: false,
  error: "Flow bootstrap generation failed.",
  payload: { diagnostic: { code: "flow_bootstrap.provider_transport_unknown", stage: "provider_request", providerInvocation: "attempted", accounting: { estimatedInputTokens: 51_200, model: "deepseek-flash" } } },
});

async function runsDirectory(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "fluxiq-provider-failure-"));
}

function failed(secrets: readonly string[] = []): ProviderFailureLog {
  const log = new ProviderFailureLog({ secrets, now });
  log.record({ route: "generate-flow-bootstrap-adaptation", httpStatus: 400, body: REFUSAL, controlRequestBytes: 214 });
  return log;
}

test("a run with a failed provider call gets the file beside logs/, and it says what failed", async () => {
  const root = await runsDirectory();
  const runDirectory = path.join(root, "run-fixture");
  await mkdir(path.join(runDirectory, "logs"), { recursive: true });

  const written = await writeProviderFailureSidecar({ runDirectory, runId: "run-fixture", log: failed() });

  assert.equal(written, path.join(runDirectory, PROVIDER_FAILURE_SIDECAR_FILENAME));
  // The name says it is local, and it sits beside logs/ rather than inside it.
  assert.equal(PROVIDER_FAILURE_SIDECAR_FILENAME, "provider-failures.local.json");
  assert.deepEqual((await readdir(runDirectory)).sort(), [PROVIDER_FAILURE_SIDECAR_FILENAME, "logs"].sort());

  const sidecar = JSON.parse(await readFile(written, "utf8")) as Record<string, unknown>;
  assert.equal(sidecar.tier, "local");
  assert.equal(sidecar.published, false);
  assert.equal(sidecar.runId, "run-fixture");
  assert.equal(sidecar.failures, 1);
  assert.equal(sidecar.dropped, 0);
  const [entry] = sidecar.records as Array<Record<string, Record<string, unknown>>>;
  assert.equal(entry?.core?.httpStatus, 400);
  assert.equal(entry?.provider?.code, "flow_bootstrap.provider_transport_unknown");
  assert.equal(entry?.provider?.estimatedInputTokens, 51_200);
  assert.match(String(entry?.core?.body), /Flow bootstrap generation failed\./u);
});

test("a run whose provider calls all succeeded writes nothing at all", async () => {
  const root = await runsDirectory();
  const runDirectory = path.join(root, "run-clean");
  await mkdir(path.join(runDirectory, "logs"), { recursive: true });

  const written = await writeProviderFailureSidecar({ runDirectory, runId: "run-clean", log: new ProviderFailureLog({ secrets: [], now }) });

  assert.equal(written, undefined);
  assert.deepEqual(await readdir(runDirectory), ["logs"]);
});

test("writing into a bundle staging directory is refused, because the bundle would publish it", async () => {
  const root = await runsDirectory();
  const staging = path.join(root, ".staging-run-fixture");
  await mkdir(staging, { recursive: true });

  await assert.rejects(
    () => writeProviderFailureSidecar({ runDirectory: staging, runId: "run-fixture", log: failed() }),
    /staging directory/u,
  );
  assert.deepEqual(await readdir(staging), []);
});

test("the file is absent from the finalized bundle's index, its completion hash and its byte count", async () => {
  const root = await runsDirectory();
  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "run-fixture", scenarioId: "everything-store" });
  await bundle.initialize();
  const finalized = await bundle.finalize({ verdict: "failed" });

  // Written where a run writes it: after finalize, into the renamed directory.
  const written = await writeProviderFailureSidecar({ runDirectory: finalized.path, runId: "run-fixture", log: failed() });
  assert.ok(written);

  const index = JSON.parse(await readFile(path.join(finalized.path, "artifact-index.json"), "utf8")) as { artifacts: Array<{ path: string }> };
  assert.ok(!index.artifacts.some(artifact => artifact.path === PROVIDER_FAILURE_SIDECAR_FILENAME), "the sidecar was indexed as evidence");
  // The published index is the one the bundle sealed: adding the file changed nothing in it.
  assert.deepEqual(index.artifacts.map(artifact => artifact.path).sort(), finalized.index.artifacts.map(artifact => artifact.path).sort());
  const complete = JSON.parse(await readFile(path.join(finalized.path, "bundle.complete.json"), "utf8")) as { artifactIndexSha256: string };
  assert.equal(typeof complete.artifactIndexSha256, "string");
});

test("a redacted body reaches the file and the secret does not", async () => {
  const key = "sk-livekeyvalue0123456789";
  const root = await runsDirectory();
  const runDirectory = path.join(root, "run-secret");
  await mkdir(runDirectory, { recursive: true });
  const log = new ProviderFailureLog({ secrets: [key], now });
  log.record({ route: "generate-flow-bootstrap-adaptation", httpStatus: 400, body: `{"ok":false,"error":"rejected ${key}"}`, controlRequestBytes: 12 });

  const written = await writeProviderFailureSidecar({ runDirectory, runId: "run-secret", log });
  const contents = await readFile(written!, "utf8");

  assert.ok(!contents.includes(key), "the credential reached the file");
  assert.match(contents, /\[REDACTED\]/u);
});
