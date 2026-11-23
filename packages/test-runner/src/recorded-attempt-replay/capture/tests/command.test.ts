import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import { runRecordedCaptureCommand } from "../command.js";
import { registerFluxIQHost } from "../host-module.js";
import { recordedCaptureRequest } from "../request.js";

test("fresh Company entry serializes the authored criteria without inventing sorting or fallback processing", () => {
  const input = { projectId: "project.fixture", flowId: "flow.fixture", startLocation: "http://127.0.0.1/company", taskId: "company-website-apprentices" };
  const request = recordedCaptureRequest(input);
  assert.deepEqual(JSON.parse(JSON.stringify(request)), { projectId: input.projectId, flowId: input.flowId, evidenceGuided: true, startLocation: input.startLocation, taskProcessing: { process: { where: [{ field: "role", contains: "apprentice" }], columns: ["name", "role", "branch"] } } });
  assert.notEqual(request.taskProcessing?.process, recordedCaptureRequest(input).taskProcessing?.process);
  assert.throws(() => recordedCaptureRequest({ ...input, taskId: "undeclared-task" }), /No processing fixture/u);
});

test("fresh capture refuses output outside the owned ignored run root before loading fixtures or browser", async () => {
  await assert.rejects(() => runRecordedCaptureCommand({ repositoryRoot: path.resolve("missing-repository"), fluxiqRepositoryRoot: path.resolve("missing-core"), scenarioId: "company-website", taskId: "company-website-apprentices", evidenceDirectory: path.resolve("outside-evidence"), source: { core: "fixture", extension: "fixture" } }), /output_scope_refused/u);
});

test("capture host refuses nonfixture roots before registering domain or native model", () => {
  const before = process.env.FLUXIQ_ROOT;
  try {
    process.env.FLUXIQ_ROOT = path.resolve("nonfixture-root");
    assert.throws(() => registerFluxIQHost({} as FluxIQ), /requires_isolated_root/u);
    delete process.env.FLUXIQ_ROOT;
    assert.throws(() => registerFluxIQHost({} as FluxIQ), /requires_isolated_root/u);
  } finally {
    if (before === undefined) delete process.env.FLUXIQ_ROOT;
    else process.env.FLUXIQ_ROOT = before;
  }
});

test("fresh capture refuses an existing evidence directory before any fixture or browser is opened", async () => {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "recorded-capture-scope-"));
  const evidenceDirectory = path.join(repositoryRoot, "test-runs", "existing");
  try {
    await mkdir(evidenceDirectory, { recursive: true });
    await assert.rejects(() => runRecordedCaptureCommand({ repositoryRoot, fluxiqRepositoryRoot: path.join(repositoryRoot, "missing-core"), scenarioId: "company-website", taskId: "company-website-apprentices", evidenceDirectory, source: { core: "fixture", extension: "fixture" } }), { code: "EEXIST" });
  } finally { await rm(repositoryRoot, { recursive: true, force: true }); }
});
