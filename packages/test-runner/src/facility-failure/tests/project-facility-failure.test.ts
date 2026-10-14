import assert from "node:assert/strict";
import test from "node:test";
import {
  facilityFailureBoundaries,
  facilityFailureStages,
  isScreenedFacilityRefusal,
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

// A8 run run-mv85un8j-beb734f5 built and passed its judged run, then was failed
// as `unclassified` although Core had said why on its Flow-settings route.
const SETTINGS = "/api/programs/automation-studio/update-flow-settings";
const coreRefused = (reason?: string, status = 400, path = SETTINGS) => {
  const details = { path, status, ...(reason === undefined ? {} : { reason }) };
  const refused = new RunnerFailure("recording.persistence", `FluxIQ control request failed: ${path} (${status})${reason ? `: ${reason}` : ""}`, { details });
  return new RunnerFailure("facility.contract", `Core refused a value the Lab sent: ${refused.message}`, { cause: refused, details });
};

test("a control request Core refused names the route, the status and Core's screened sentence", () => {
  assert.deepEqual(projectFacilityFailure(coreRefused("LLM execution limit is invalid."), "finalized-bundle", "scenario.execute"), {
    boundary: "finalized-bundle", stage: "scenario.execute", reason: "core.refused", endpoint: SETTINGS, httpStatus: 400, refusal: "LLM execution limit is invalid.",
  });
  // Without a sentence, or wrapped once more, the route and status still say what happened.
  assert.deepEqual(projectFacilityFailure(coreRefused(undefined, 404), "finalized-bundle", "scenario.execute"), {
    boundary: "finalized-bundle", stage: "scenario.execute", reason: "core.refused", endpoint: SETTINGS, httpStatus: 404,
  });
  const wrapped = new RunnerFailure("facility.contract", "Flow settings could not be applied", { cause: coreRefused("LLM execution limit is invalid.") });
  assert.equal(projectFacilityFailure(wrapped, "finalized-bundle", "scenario.execute").refusal, "LLM execution limit is invalid.");
  // A long sentence is bounded, and the bounded record passes the contract's screening.
  const long = projectFacilityFailure(coreRefused(`The Flow settings are invalid: ${"limit ".repeat(80)}`), "finalized-bundle", "scenario.execute");
  assert.equal(long.refusal?.length, 240);
  assert.equal(long.refusal?.endsWith("…"), true);
  assert.equal(isScreenedFacilityRefusal(long.refusal), true);
});

test("a refusal sentence carrying a secret-shaped value is dropped whole, never cut around", () => {
  for (const reason of [
    `Unknown session token Bearer ${SENTINEL}`,
    `password=${SENTINEL} is not accepted`,
    "Session 9f2c4e1a7b3d5f6e8a0c2e4f6a8b0d1c3e5f7a9b is unknown",
    `pairing_token: ${SENTINEL}`,
    `Already [REDACTED] upstream ${SENTINEL}`,
    `${"ok ".repeat(100)} Bearer ${SENTINEL}`,
  ]) {
    const projected = projectFacilityFailure(coreRefused(reason), "finalized-bundle", "scenario.execute");
    assert.deepEqual(projected, { boundary: "finalized-bundle", stage: "scenario.execute", reason: "core.refused", endpoint: SETTINGS, httpStatus: 400 }, reason);
    assert.equal(JSON.stringify(projected).includes(SENTINEL), false, reason);
  }
});

test("only a 4xx on a Core API route is a Core refusal", () => {
  for (const error of [coreRefused("boom", 500), coreRefused("not found", 399), coreRefused("refused", 400, `/private/${SENTINEL}`), coreRefused("refused", 400.5)]) {
    const projected = projectFacilityFailure(error, "finalized-bundle", "scenario.execute");
    assert.deepEqual(projected, { boundary: "finalized-bundle", stage: "scenario.execute", reason: "unclassified" });
  }
  // A details record whose getters throw fails closed to `unclassified`.
  const hostile = new RunnerFailure("facility.contract", SENTINEL, { details: new Proxy({}, { get: () => { throw new Error(SENTINEL); } }) });
  assert.deepEqual(projectFacilityFailure(hostile, "finalized-bundle", "scenario.execute"), { boundary: "finalized-bundle", stage: "scenario.execute", reason: "unclassified" });
});
