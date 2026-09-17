// What a demo launcher prints when a lane fails. The launchers used to print
// only `failureCode: "unknown"` or `runner.runtime.behavior`, which says
// nothing about which of dozens of checks refused; a live run then had to be
// repeated to learn anything. The describer keeps the runner's own fixed
// messages, redacts every credential literal, and never prints a foreign
// error's text beyond its first line.

import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { describeDemoLauncherFailure } from "../failure-detail.js";

test("a runner failure keeps its category, message, reason code and source location", () => {
  const error = new RunnerFailure("runtime.behavior", "Exploration did not persist exactly one scoped proposal", { details: { reasonCode: "exploration_apply.pending_candidate_count" } });
  const described = describeDemoLauncherFailure(error, []);
  assert.equal(described.failureCode, "runner.runtime.behavior");
  assert.equal(described.reasonCode, "exploration_apply.pending_candidate_count");
  assert.equal(described.causes[0]?.message, "Exploration did not persist exactly one scoped proposal");
  assert.equal(described.causes[0]?.errorClass, "RunnerFailure");
  assert.match(described.sourceLocation ?? "", /^failure-detail\.test:\d+:\d+$/u);
});

test("credential literals are redacted from every message in the chain", () => {
  const cause = new RunnerFailure("environment.missing", "login refused for hunter2-password");
  const error = new RunnerFailure("runtime.behavior", "outer with 424242", { cause });
  const described = describeDemoLauncherFailure(error, ["hunter2-password", "424242", ""]);
  const printed = JSON.stringify(described);
  assert.doesNotMatch(printed, /hunter2-password|424242/u);
  assert.equal(described.causes.length, 2);
  assert.equal(described.causes[1]?.message, "login refused for [redacted]");
});

test("a foreign error keeps only its first line, so a Playwright call log never prints", () => {
  const error = Object.assign(new Error("locator.click: Timeout 30000ms exceeded.\nCall log:\n  - locator resolved to <button>Private page text</button>"), { name: "TimeoutError" });
  const described = describeDemoLauncherFailure(error, []);
  assert.equal(described.failureCode, "playwright.timeout");
  assert.equal(described.causes[0]?.message, "locator.click: Timeout 30000ms exceeded.");
  assert.doesNotMatch(JSON.stringify(described), /Private page text/u);
});

test("a failed response's code and a node error code are named, and unknowns stay unknown", () => {
  assert.equal(describeDemoLauncherFailure(Object.assign(new Error("connect"), { code: "ECONNREFUSED" }), []).failureCode, "node.econnrefused");
  assert.equal(describeDemoLauncherFailure("plain string", []).failureCode, "unknown");
  assert.equal(describeDemoLauncherFailure("plain string", []).causes[0]?.message, "plain string");
});

test("a message is bounded and the chain stops at eight", () => {
  let error: unknown = new Error("x".repeat(2_000));
  for (let index = 0; index < 12; index += 1) error = new Error(`level ${index}`, { cause: error });
  const described = describeDemoLauncherFailure(error, []);
  assert.equal(described.causes.length, 8);
  assert.ok(described.causes.every(cause => cause.message.length <= 400));
});
