import assert from "node:assert/strict";
import test from "node:test";
import {
  facilityFailureBoundaries,
  facilityFailureStages,
  type FacilityFailureBoundary,
  type FacilityFailureStage,
} from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { projectFacilityFailure, ProjectedFacilityError } from "../index.js";

const SENTINEL = "private-value-must-not-persist";

test("every boundary and coarse stage is preserved without inspecting raw input", () => {
  for (const boundary of facilityFailureBoundaries) {
    for (const stage of facilityFailureStages) {
      assert.deepEqual(projectFacilityFailure(new Error(SENTINEL), boundary, stage), { boundary, stage, reason: "unclassified" });
    }
  }
});

test("known readiness and HTTP failures map to their exact closed shapes", () => {
  assert.deepEqual(projectFacilityFailure(new RunnerFailure("process.startup", "Topology startup wait timed out", {
    details: { bounded: "timeout", operationStage: "scenario.health", timeoutMs: 60_000, url: SENTINEL },
  }), "finalized-bundle", "scenario.execute"), {
    boundary: "finalized-bundle", stage: "scenario.execute", reason: "readiness.timeout", operationStage: "scenario.health", timeoutMs: 60_000,
  });
  assert.deepEqual(projectFacilityFailure(new RunnerFailure("environment.missing", "FluxIQ HTTP operation timed out", {
    details: { bounded: "timeout", operationStage: "auth.login", timeoutMs: 30_000, body: SENTINEL },
  }), "finalized-bundle", "scenario.execute"), {
    boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.timeout", operationStage: "auth.login", timeoutMs: 30_000,
  });
  assert.deepEqual(projectFacilityFailure(new RunnerFailure("process.startup", "FluxIQ HTTP operation was interrupted", {
    details: { bounded: "abort", operationStage: "project.select", path: SENTINEL },
  }), "finalized-bundle", "scenario.cleanup"), {
    boundary: "finalized-bundle", stage: "scenario.cleanup", reason: "http.abort", operationStage: "project.select",
  });
  assert.deepEqual(projectFacilityFailure(new RunnerFailure("gateway.pairing", "FluxIQ HTTP transport failed", {
    details: { operationStage: "control.request", transportCategory: "network", transportCode: "ECONNRESET", message: SENTINEL },
  }), "finalized-bundle", "scenario.execute"), {
    boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.transport", operationStage: "control.request", causeCode: "ECONNRESET",
  });
});

test("a bounded HTTP failure carries the Core route it went to, and drops anything that is not one", () => {
  const timedOut = (path: string) => new RunnerFailure("environment.missing", "FluxIQ HTTP operation timed out", {
    details: { bounded: "timeout", operationStage: "control.request", timeoutMs: 30_000, path },
  });
  assert.deepEqual(projectFacilityFailure(timedOut("/api/programs/automation-studio/run-runtime-session"), "finalized-bundle", "scenario.execute"), {
    boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.timeout", operationStage: "control.request", timeoutMs: 30_000,
    endpoint: "/api/programs/automation-studio/run-runtime-session",
  });
  for (const path of [SENTINEL, `/api/${SENTINEL}?q=${SENTINEL}`, `/private/${SENTINEL}`]) {
    const projected = projectFacilityFailure(timedOut(path), "finalized-bundle", "scenario.execute");
    assert.equal("endpoint" in projected, false, path);
    assert.equal(JSON.stringify(projected).includes(SENTINEL), false, path);
  }
  assert.deepEqual(projectFacilityFailure(new RunnerFailure("gateway.pairing", "FluxIQ HTTP transport failed", {
    details: { operationStage: "control.request", transportCategory: "network", transportCode: "ECONNRESET", path: "/api/client-gateway/snapshot" },
  }), "finalized-bundle", "scenario.execute"), {
    boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.transport", operationStage: "control.request", causeCode: "ECONNRESET", endpoint: "/api/client-gateway/snapshot",
  });
});

test("module and path causes share the classifier's bounded allowlist", () => {
  const projected = (code: string) => projectFacilityFailure(Object.assign(new Error(SENTINEL), { code }), "no-final-bundle", "scenario.load");
  assert.deepEqual(projected("ERR_MODULE_NOT_FOUND"), { boundary: "no-final-bundle", stage: "scenario.load", reason: "module.missing", causeCode: "ERR_MODULE_NOT_FOUND" });
  assert.deepEqual(projected("ENOENT"), { boundary: "no-final-bundle", stage: "scenario.load", reason: "path.missing", causeCode: "ENOENT" });
  assert.deepEqual(projected("EACCES"), { boundary: "no-final-bundle", stage: "scenario.load", reason: "path.denied", causeCode: "EACCES" });
  assert.deepEqual(projected("EPERM"), { boundary: "no-final-bundle", stage: "scenario.load", reason: "path.denied", causeCode: "EPERM" });
  assert.deepEqual(projected("FOREIGN_CODE"), { boundary: "no-final-bundle", stage: "scenario.load", reason: "unclassified" });
});

test("projection is sentinel-free and fails closed on hostile getters and proxies", () => {
  const nested = new Error(SENTINEL, { cause: Object.assign(new Error(SENTINEL), { code: "ENOENT", url: SENTINEL, body: { credential: SENTINEL } }) });
  const hostile = Object.create(null, {
    code: { get: () => { throw new Error(SENTINEL); } },
    cause: { get: () => { throw new Error(SENTINEL); } },
    message: { value: SENTINEL },
  });
  const proxy = new Proxy({}, { has: () => { throw new Error(SENTINEL); } });
  for (const diagnostic of [
    projectFacilityFailure(nested, "no-final-bundle", "bundle.initialize"),
    projectFacilityFailure(hostile, "no-final-bundle", "scenario.load"),
    projectFacilityFailure(proxy, "no-final-bundle", "scenario.load"),
  ]) assert.equal(JSON.stringify(diagnostic).includes(SENTINEL), false);
  assert.equal(projectFacilityFailure(hostile, "no-final-bundle", "scenario.load").reason, "unclassified");
  assert.equal(projectFacilityFailure(proxy, "no-final-bundle", "scenario.load").reason, "unclassified");
});

test("an already projected error is idempotent and cannot be relabelled", () => {
  const first = projectFacilityFailure(Object.assign(new Error(SENTINEL), { code: "ENOENT" }), "no-final-bundle", "scenario.load");
  const error = new ProjectedFacilityError(new Error(SENTINEL), first);
  assert.equal(error.cause instanceof Error, true);
  assert.equal(projectFacilityFailure(error, "finalized-bundle", "bundle.publish"), error.facilityFailure);
  assert.deepEqual(projectFacilityFailure(error, "finalized-bundle", "bundle.publish"), first);
  assert.equal(JSON.stringify(error.facilityFailure).includes(SENTINEL), false);
});

test("foreign operation stages, codes and raw-shaped details never widen the projection", () => {
  const project = (boundary: FacilityFailureBoundary, stage: FacilityFailureStage) => projectFacilityFailure(new RunnerFailure("environment.missing", SENTINEL, {
    details: { bounded: "timeout", operationStage: SENTINEL, timeoutMs: 999_999, transportCategory: "network", transportCode: SENTINEL, password: SENTINEL },
  }), boundary, stage);
  assert.deepEqual(project("finalized-bundle", "scenario.execute"), { boundary: "finalized-bundle", stage: "scenario.execute", reason: "unclassified" });
});
