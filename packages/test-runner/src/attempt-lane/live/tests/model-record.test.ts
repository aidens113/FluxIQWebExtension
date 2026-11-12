import assert from "node:assert/strict";
import test from "node:test";
import { attemptModelHeader } from "../report-model-header.js";
import { attemptModelRecord } from "../model-record.js";

test("a live run records the plan's provider and exact model; a scripted run records the scripted provider and no model", () => {
  assert.deepEqual(attemptModelRecord({ describe: () => ({ provider: "anthropic", model: "claude-sonnet-5-5" }) }), { provider: "anthropic", model: "claude-sonnet-5-5" });
  assert.deepEqual(attemptModelRecord(undefined), { provider: "scripted" });
});

test("the report header names the model and provider", () => {
  assert.equal(attemptModelHeader({ provider: "anthropic", model: "claude-sonnet-5-5" }), "model claude-sonnet-5-5, provider anthropic");
  assert.equal(attemptModelHeader({ provider: "scripted" }), "model none, provider scripted");
});
