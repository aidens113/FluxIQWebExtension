// How long a run is read back for, and why it is not one number.
//
// The 90-second bound was measured on Flows of a single extraction node. Read
// as a whole-run deadline for a Flow of six to twenty nodes it expires while
// the run is still executing, and the wait then reports the failure that
// stopped the *request* -- a product verdict for a run nobody observed fail.
// These pin the derivation that replaced it, and pin it to Core's own
// published ceilings rather than to a number written here.

import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY, AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS, AUTOMATION_STUDIO_READINESS_CAP_MS } from "fluxiq/automation-studio";
import { TERMINAL_DETAIL_BASE_WAIT_MS, TERMINAL_DETAIL_MAX_WAIT_MS, TERMINAL_DETAIL_NODE_WAIT_MS, terminalDetailWaitMs } from "../terminal-run-wait.js";

test("one node's allowance is every attempt's readiness ceiling plus every retry's backoff, as Core defines them", () => {
  // Core awaits readiness once per attempt and sleeps a backoff before each
  // attempt after the first: 3 x 30 s, then 250 ms and 1 s.
  assert.equal(AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY.maxAttempts, 3);
  assert.equal(AUTOMATION_STUDIO_READINESS_CAP_MS, 30_000);
  assert.equal(TERMINAL_DETAIL_NODE_WAIT_MS, 91_250);
  // Stated the other way round, so a Core that moves a ceiling moves this and
  // does not leave a literal behind.
  assert.equal(TERMINAL_DETAIL_NODE_WAIT_MS - AUTOMATION_STUDIO_READINESS_CAP_MS * AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY.maxAttempts, 1_250);
});

test("a Flow of one node keeps the load-proven 90 seconds, and a caller that names no count gets it", () => {
  assert.equal(terminalDetailWaitMs(1), TERMINAL_DETAIL_BASE_WAIT_MS);
  assert.equal(terminalDetailWaitMs(undefined), TERMINAL_DETAIL_BASE_WAIT_MS);
  // Nothing a caller can pass shortens it: 0 nodes is a Flow this reader knows
  // nothing about, not a Flow that finishes faster than one of one node.
  assert.equal(terminalDetailWaitMs(0), TERMINAL_DETAIL_BASE_WAIT_MS);
  assert.equal(terminalDetailWaitMs(-4), TERMINAL_DETAIL_BASE_WAIT_MS);
  assert.equal(terminalDetailWaitMs(2.5), TERMINAL_DETAIL_BASE_WAIT_MS);
});

test("every node after the first adds its own allowance, so a multi-node Flow is not failed for still running", () => {
  assert.equal(terminalDetailWaitMs(2), TERMINAL_DETAIL_BASE_WAIT_MS + TERMINAL_DETAIL_NODE_WAIT_MS);
  assert.equal(terminalDetailWaitMs(6), 90_000 + 5 * 91_250);
  // The six-node case is the one the plan names, and it is 9.1 minutes: more
  // than six times the bound that would have failed it.
  assert.ok(terminalDetailWaitMs(6) > 6 * TERMINAL_DETAIL_BASE_WAIT_MS);
});

test("the derived bound is capped at the longest run this facility allows", () => {
  assert.equal(TERMINAL_DETAIL_MAX_WAIT_MS, AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS);
  assert.equal(terminalDetailWaitMs(20), TERMINAL_DETAIL_MAX_WAIT_MS);
  assert.equal(terminalDetailWaitMs(Number.MAX_SAFE_INTEGER), TERMINAL_DETAIL_MAX_WAIT_MS);
  // Seven nodes is where Core's own per-node worst case reaches the cap, so
  // the count still governs every Flow smaller than that.
  assert.ok(terminalDetailWaitMs(6) < TERMINAL_DETAIL_MAX_WAIT_MS);
  assert.equal(terminalDetailWaitMs(7), TERMINAL_DETAIL_MAX_WAIT_MS);
});
