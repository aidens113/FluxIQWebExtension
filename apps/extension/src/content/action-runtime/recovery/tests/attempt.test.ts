// One row per fault class the loop now absorbs, each one showing what the single
// attempt this replaced would have reported and what the loop reports instead.
//
// The pause is injected, so four attempts and 3750 ms of waiting run instantly
// and the waiting is still asserted rather than merely survived.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_FAILURE_CODES, type WebAutomationFailureCode } from "@fluxiq-web-extension/domain/client";
import { runWithRecovery } from "../attempt";
import { RECOVERY_BLIP_BACKOFF_MS, RECOVERY_TARGET_BACKOFF_MS } from "../budget";
import type { BrowserActionCommand, BrowserActionResult } from "../../../types";

function command(actionType: string, timeoutMs?: number): BrowserActionCommand {
  return { commandId: "c1", actionType, ...(timeoutMs === undefined ? {} : { timeoutMs }) } as unknown as BrowserActionCommand;
}

function failed(actionType: string, code: WebAutomationFailureCode): BrowserActionResult {
  return {
    commandId: "c1",
    actionType,
    status: "failed",
    validation: { status: "failed", expected: "e", actual: "a" },
    failure: { category: "action_failed", code, retryable: true, stage: "execution" },
    startedAt: 0,
    finishedAt: 1
  } as unknown as BrowserActionResult;
}

function succeeded(actionType: string): BrowserActionResult {
  return {
    commandId: "c1",
    actionType,
    status: "succeeded",
    validation: { status: "passed", expected: "e", actual: "a" },
    startedAt: 0,
    finishedAt: 1
  } as unknown as BrowserActionResult;
}

/** A page that answers with `failures` in order and then succeeds, counting its attempts. */
function page(actionType: string, failures: readonly BrowserActionResult[]): { attempt: () => Promise<BrowserActionResult>; calls: () => number } {
  let calls = 0;
  return {
    attempt: async () => {
      const result = failures[calls] ?? succeeded(actionType);
      calls += 1;
      return result;
    },
    calls: () => calls
  };
}

const paused: number[] = [];
const pause = async (ms: number): Promise<void> => {
  paused.push(ms);
};

test.beforeEach(() => {
  paused.length = 0;
});

test("a target drawn late: the single attempt this replaced failed, the loop waits and finds it", async () => {
  const late = page("web.dom.click", [failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND)]);
  // What the dispatcher did before: one attempt, and this is the answer.
  assert.equal((await late.attempt()).status, "failed");

  const fresh = page("web.dom.click", [failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND)]);
  const { result, account } = await runWithRecovery(command("web.dom.click"), Date.now(), fresh.attempt, pause);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(account, { attempts: 2, absorbed: ["target_absent"], waitedMs: 250, outcome: "recovered" });
  assert.deepEqual(paused, [250]);
});

test("a target still absent after every retry: the page's own failure is reported, not one this loop invented", async () => {
  const absent = failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  const never = page("web.dom.click", Array.from({ length: 9 }, () => absent));
  const { result, account } = await runWithRecovery(command("web.dom.click"), Date.now(), never.attempt, pause);
  assert.equal(result, absent, "the reported result must be the attempt's own");
  assert.equal(account.outcome, "exhausted");
  assert.equal(account.attempts, RECOVERY_TARGET_BACKOFF_MS.length + 1);
  assert.equal(account.absorbed.length, RECOVERY_TARGET_BACKOFF_MS.length + 1);
  assert.equal(account.waitedMs, 3_750);
  assert.deepEqual(paused, [...RECOVERY_TARGET_BACKOFF_MS]);
  assert.equal(never.calls(), 5, "at most four retries, so five attempts");
});

test("a read whose post-condition did not appear yet is retried", async () => {
  const read = page("web.dom.extract", [failed("web.dom.extract", WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED)]);
  const { result, account } = await runWithRecovery(command("web.dom.extract"), Date.now(), read.attempt, pause);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(account.absorbed, ["output_not_observed"]);
});

test("a read whose document was replaced under it re-acquires the page rather than reporting a dead handle", async () => {
  const moved = page("web.dom.capture_snapshot", [failed("web.dom.capture_snapshot", WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED)]);
  const { result, account } = await runWithRecovery(command("web.dom.capture_snapshot"), Date.now(), moved.attempt, pause);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(account.absorbed, ["page_changed"]);
});

test("a browser API that threw transiently is retried, and a detached node is that same fault", async () => {
  const threw = page("web.dom.capture_snapshot", [
    failed("web.dom.capture_snapshot", WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED),
    failed("web.dom.capture_snapshot", WEB_AUTOMATION_FAILURE_CODES.TIMEOUT)
  ]);
  const { result, account } = await runWithRecovery(command("web.dom.capture_snapshot"), Date.now(), threw.attempt, pause);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(account.absorbed, ["action_failed", "timeout"]);
  assert.equal(account.waitedMs, 750);
  assert.equal(account.attempts, 3);
});

test("a blip is given two retries and no more, so a frame that has gone does not cost the target ladder", async () => {
  const gone = failed("web.dom.capture_snapshot", WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
  const never = page("web.dom.capture_snapshot", Array.from({ length: 9 }, () => gone));
  const { result, account } = await runWithRecovery(command("web.dom.capture_snapshot"), Date.now(), never.attempt, pause);
  assert.equal(result, gone);
  assert.equal(never.calls(), RECOVERY_BLIP_BACKOFF_MS.length + 1);
  assert.equal(account.waitedMs, 750);
  assert.equal(account.outcome, "exhausted");
});

test("a click whose confirmation was missed is never pressed twice", async () => {
  for (const code of [
    WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED,
    WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED,
    WEB_AUTOMATION_FAILURE_CODES.TIMEOUT,
    WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED
  ]) {
    const pressed = page("web.dom.click", [failed("web.dom.click", code)]);
    const { result, account } = await runWithRecovery(command("web.dom.click"), Date.now(), pressed.attempt, pause);
    assert.equal(result.status, "failed", `a click was retried after ${code}`);
    assert.equal(pressed.calls(), 1, `the page was acted on twice after ${code}`);
    assert.deepEqual(account, { attempts: 1, absorbed: [], waitedMs: 0, outcome: "clean" });
  }
  assert.deepEqual(paused, []);
});

test("a deterministic refusal costs no retry and no waiting", async () => {
  const refused = page("web.dom.click", [failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS)]);
  const { result, account } = await runWithRecovery(command("web.dom.click"), Date.now(), refused.attempt, pause);
  assert.equal(result.status, "failed");
  assert.equal(refused.calls(), 1);
  assert.equal(account.outcome, "clean");
  assert.deepEqual(paused, []);
});

test("a first attempt that simply worked is not charged an account at all", async () => {
  const clean = page("web.dom.click", []);
  const { result, account } = await runWithRecovery(command("web.dom.click"), Date.now(), clean.attempt, pause);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(account, { attempts: 1, absorbed: [], waitedMs: 0, outcome: "clean" });
});

test("a verb that already spent the command's timeout gets no retry, so its own wait is not doubled", async () => {
  const startedAt = Date.now() - 2_500;
  const spent = page("web.dom.extract", [failed("web.dom.extract", WEB_AUTOMATION_FAILURE_CODES.TIMEOUT)]);
  const { account } = await runWithRecovery(command("web.dom.extract", 2_000), startedAt, spent.attempt, pause);
  assert.equal(spent.calls(), 1);
  assert.deepEqual(account.absorbed, ["timeout"], "the fault is still recorded as reached, even though nothing could absorb it");
  assert.equal(account.outcome, "exhausted");
  assert.deepEqual(paused, []);
});

test("a clipped backoff that reaches the command deadline never dispatches another verb", async () => {
  let clock = 90;
  const absent = page("web.dom.click", [failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND)]);
  const advancingPause = async (ms: number): Promise<void> => {
    paused.push(ms);
    clock += ms;
  };

  const { result, account } = await runWithRecovery(command("web.dom.click", 100), 0, absent.attempt, advancingPause, () => clock);

  assert.equal(result.status, "failed");
  assert.equal(absent.calls(), 1, "the verb ran at the deadline");
  assert.deepEqual(paused, [10]);
  assert.deepEqual(account, { attempts: 1, absorbed: ["target_absent"], waitedMs: 10, outcome: "exhausted" });
});

test("scheduler overshoot past the command deadline never dispatches another verb", async () => {
  let clock = 0;
  const absent = page("web.dom.click", [failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND)]);
  const overshootingPause = async (ms: number): Promise<void> => {
    paused.push(ms);
    clock += ms + 75;
  };

  const { result, account } = await runWithRecovery(command("web.dom.click", 300), 0, absent.attempt, overshootingPause, () => clock);

  assert.equal(result.status, "failed");
  assert.equal(absent.calls(), 1, "the verb ran after scheduler overshoot");
  assert.deepEqual(paused, [250]);
  assert.deepEqual(account, { attempts: 1, absorbed: ["target_absent"], waitedMs: 250, outcome: "exhausted" });
});
