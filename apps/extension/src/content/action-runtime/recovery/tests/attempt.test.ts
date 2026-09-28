// One row per fault class the loop now absorbs, each one showing what the single
// attempt this replaced would have reported and what the loop reports instead.
//
// The pause is injected, so four attempts and 3750 ms of waiting run instantly
// and the waiting is still asserted rather than merely survived.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_FAILURE_CODES, type WebAutomationFailureCode } from "@fluxiq-web-extension/domain/client";
import { runWithRecovery } from "../attempt";
import { RECOVERY_BLIP_BACKOFF_MS, RECOVERY_INTERFERENCE_BACKOFF_MS, RECOVERY_TARGET_BACKOFF_MS } from "../budget";
import type { BrowserActionCommand, BrowserActionResult } from "../../../types";

function command(actionType: string, timeoutMs?: number): BrowserActionCommand {
  return { commandId: "c1", actionType, ...(timeoutMs === undefined ? {} : { timeoutMs }) } as unknown as BrowserActionCommand;
}

function failed(actionType: string, code: WebAutomationFailureCode, actual?: string): BrowserActionResult {
  return {
    commandId: "c1",
    actionType,
    status: "failed",
    validation: { status: "failed", expected: "e", actual: "a" },
    failure: { category: "action_failed", code, retryable: true, stage: "execution", ...(actual === undefined ? {} : { actual }) },
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
  assert.deepEqual(account, { attempts: 2, absorbed: ["target_absent"], waitedMs: 250, dismissed: 0, outcome: "recovered" });
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
    assert.deepEqual(account, { attempts: 1, absorbed: [], waitedMs: 0, dismissed: 0, outcome: "clean" });
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
  assert.deepEqual(account, { attempts: 1, absorbed: [], waitedMs: 0, dismissed: 0, outcome: "clean" });
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
  assert.deepEqual(account, { attempts: 1, absorbed: ["target_absent"], waitedMs: 10, dismissed: 0, outcome: "exhausted" });
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
  assert.deepEqual(account, { attempts: 1, absorbed: ["target_absent"], waitedMs: 250, dismissed: 0, outcome: "exhausted" });
});

// --- A dialog appearing before a click ------------------------------------
//
// The rows this work exists for. Live, a `web.output.dom-click` met
// `web.action.rejected.blocked_by_dialog` and the run carried on with the effect
// never applied. Under the standing rule -- the runtime is defensive by default,
// for every node, and a recoverable obstacle is absorbed rather than recorded --
// that is a defect, and these are the assertions that fail if the defence is
// removed again.
//
// The intervention is injected, so what is asserted here is the *loop's*
// contract: that it clears before it waits, that it counts what it cleared, and
// that it never clears for a fault clearing cannot help. What is actually
// pressed on a page is `interference/`, proved against a real DOM by the
// Playwright content harness.

/** An intervention that clears the page on its first call, as pressing a promotion's "Not now" does. */
function dismisses(times = 1): { intervene: (fault: string) => number; calls: () => string[] } {
  const calls: string[] = [];
  return {
    intervene: (fault: string) => {
      calls.push(fault);
      return calls.length <= times ? 1 : 0;
    },
    calls: () => calls
  };
}

test("a dialog appearing before a click does not fail the click: it is closed and the click lands", async () => {
  const blocked = failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG);
  // What the dispatcher did before this defence existed, and what the live run recorded.
  const before = page("web.dom.click", [blocked]);
  assert.equal((await before.attempt()).status, "failed");
  assert.equal((await before.attempt()).status, "succeeded", "the page itself would have taken the click; only the dialog stopped it");

  const dialog = dismisses();
  const fresh = page("web.dom.click", [blocked]);
  const { result, account } = await runWithRecovery(command("web.dom.click"), Date.now(), fresh.attempt, pause, Date.now, dialog.intervene);

  assert.equal(result.status, "succeeded", "the click must land once the dialog is out of the way");
  assert.deepEqual(account, { attempts: 2, absorbed: ["blocking_dialog"], waitedMs: 150, dismissed: 1, outcome: "recovered" });
  assert.deepEqual(dialog.calls(), ["blocking_dialog"], "the dialog must be closed, not merely waited at");
  assert.deepEqual(paused, [150]);
});

test("the dialog is closed before the wait, so the retry hit-tests a page the dialog has left", async () => {
  const order: string[] = [];
  const blocked = failed("web.dom.type", WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG);
  let calls = 0;
  const attempt = async (): Promise<BrowserActionResult> => {
    order.push("attempt");
    calls += 1;
    return calls === 1 ? blocked : succeeded("web.dom.type");
  };
  const { result } = await runWithRecovery(
    command("web.dom.type"),
    Date.now(),
    attempt,
    async (ms) => { order.push(`pause ${ms}`); },
    Date.now,
    () => { order.push("clear"); return 1; }
  );
  assert.equal(result.status, "succeeded");
  assert.deepEqual(order, ["attempt", "clear", "pause 150", "attempt"]);
});

test("a page that opens the next dialog behind the first is cleared layer by layer", async () => {
  // A consent sheet, then a newsletter modal: one press is not a defence.
  const blocked = failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG);
  const dialog = dismisses(2);
  const stacked = page("web.dom.click", [blocked, blocked]);
  const { result, account } = await runWithRecovery(command("web.dom.click"), Date.now(), stacked.attempt, pause, Date.now, dialog.intervene);

  assert.equal(result.status, "succeeded");
  assert.equal(account.dismissed, 2);
  assert.deepEqual(account.absorbed, ["blocking_dialog", "blocking_dialog"]);
  assert.deepEqual(paused, [150, 400]);
});

test("a dialog that will not close ends with the page's own refusal, not one this loop invented", async () => {
  const blocked = failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG);
  const never = page("web.dom.click", Array.from({ length: 9 }, () => blocked));
  const { result, account } = await runWithRecovery(command("web.dom.click"), Date.now(), never.attempt, pause, Date.now, () => 0);

  assert.equal(result, blocked, "the reported result must be the page's own");
  assert.equal(account.outcome, "exhausted");
  assert.equal(account.attempts, RECOVERY_INTERFERENCE_BACKOFF_MS.length + 1);
  assert.equal(account.dismissed, 0, "nothing was pressed, and the account must not pretend otherwise");
  assert.deepEqual(paused, [...RECOVERY_INTERFERENCE_BACKOFF_MS]);
});

test("a target covered by an overlay is cleared the same way, and a disabled one is not", async () => {
  const covered = failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, "covered: the point 76,683 landed on div.scrim");
  const overlay = dismisses();
  const under = page("web.dom.click", [covered]);
  const cleared = await runWithRecovery(command("web.dom.click"), Date.now(), under.attempt, pause, Date.now, overlay.intervene);
  assert.equal(cleared.result.status, "succeeded");
  assert.deepEqual(cleared.account.absorbed, ["obstructed_target"]);

  const disabled = failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, "disabled: the element is disabled");
  const refused = page("web.dom.click", [disabled]);
  const stopped = await runWithRecovery(command("web.dom.click"), Date.now(), refused.attempt, pause, Date.now, overlay.intervene);
  assert.equal(stopped.result, disabled, "a control that refused on its own account is not an obstruction to clear");
  assert.equal(stopped.account.attempts, 1);
});

test("nothing on the page is pressed for a fault pressing cannot help", async () => {
  const pressed: string[] = [];
  const intervene = (fault: string): number => { pressed.push(fault); return 1; };
  for (const code of [WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, WEB_AUTOMATION_FAILURE_CODES.TIMEOUT]) {
    const slow = page("web.dom.extract", [failed("web.dom.extract", code)]);
    await runWithRecovery(command("web.dom.extract"), Date.now(), slow.attempt, pause, Date.now, intervene);
  }
  assert.deepEqual(pressed, [], "a late target and an unread post-condition are waited for, never clicked at");
});
