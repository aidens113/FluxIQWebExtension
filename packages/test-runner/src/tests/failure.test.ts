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
