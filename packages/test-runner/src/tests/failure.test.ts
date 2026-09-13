import assert from "node:assert/strict";
import test from "node:test";
import { classifyRunnerFailure, RunnerFailure } from "../failure.js";

test("preserves explicit failure categories", () => {
  assert.equal(classifyRunnerFailure(new RunnerFailure("gateway.connection", "offline")), "gateway.connection");
});

test("classifies missing tools and unknown failures", () => {
  assert.equal(classifyRunnerFailure(Object.assign(new Error("missing"), { code: "ENOENT" })), "environment.missing");
  assert.equal(classifyRunnerFailure(new Error("unexpected")), "unknown");
});

/**
 * The classification the bench-killing incident needed and did not have. Node
 * raises `ERR_MODULE_NOT_FOUND` when a FluxIQ Core rebuild in the sibling
 * checkout deletes a module a Lab run is importing, and it used to land in
 * `unknown` -- a category that tells a reader nothing, on a failure whose
 * message names the exact missing file.
 */
test("a module the facility could not load is a missing environment, not an unknown failure", () => {
  const notFound = Object.assign(new Error(String.raw`Cannot find module 'F:\!FluxIQ\packages\fluxiq\node_modules\@fluxiq\contracts\dist\automation-studio.js' imported from F:\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\runtime\llm\harness\context-packet.js`), { code: "ERR_MODULE_NOT_FOUND" });
  assert.equal(classifyRunnerFailure(notFound), "environment.missing");
  assert.equal(classifyRunnerFailure(Object.assign(new Error("Cannot find package '@fluxiq-web-extension/test-contracts'"), { code: "ERR_MODULE_NOT_FOUND" })), "environment.missing");
  assert.equal(classifyRunnerFailure(Object.assign(new Error("legacy require"), { code: "MODULE_NOT_FOUND" })), "environment.missing");
  assert.equal(classifyRunnerFailure(Object.assign(new Error("half-written package.json"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" })), "environment.missing");
  assert.equal(classifyRunnerFailure(Object.assign(new Error("busy port"), { code: "EADDRINUSE" })), "process.startup");
});
