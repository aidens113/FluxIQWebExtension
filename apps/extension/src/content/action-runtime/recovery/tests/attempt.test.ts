// One row per fault class the loop now absorbs, each one showing what the single
// attempt this replaced would have reported and what the loop reports instead.
//
// The pause is injected, so four attempts and 3750 ms of waiting run instantly
// and the waiting is still asserted rather than merely survived.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { WEB_AUTOMATION_FAILURE_CODES, type WebAutomationFailureCode } from "@fluxiq-web-extension/domain/client";
import type { ActionResultEvidence } from "../../results";
import { runWithRecovery } from "../attempt";
import { RECOVERY_BLIP_BACKOFF_MS, RECOVERY_BUDGET_MS, RECOVERY_INTERFERENCE_BACKOFF_MS, RECOVERY_TARGET_BACKOFF_MS } from "../budget";
import type { BrowserActionCommand, BrowserActionResult, DomSnapshot } from "../../../types";

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
  const nothingOverPage = (): boolean => false;
  for (const code of [WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, WEB_AUTOMATION_FAILURE_CODES.TIMEOUT]) {
    const slow = page("web.dom.extract", [failed("web.dom.extract", code)]);
    await runWithRecovery(command("web.dom.extract"), Date.now(), slow.attempt, pause, Date.now, intervene, nothingOverPage);
  }
  assert.deepEqual(pressed, [], "a late target and an unread post-condition are waited for, never clicked at");
});

test("a layer over the page is never looked for on a fault other than a missing target", async () => {
  let asked = 0;
  const probe = (): boolean => { asked += 1; return true; };
  for (const code of [WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED]) {
    const pressed: string[] = [];
    const slow = page("web.dom.extract", [failed("web.dom.extract", code)]);
    await runWithRecovery(command("web.dom.extract"), Date.now(), slow.attempt, pause, Date.now, (fault) => { pressed.push(fault); return 1; }, probe);
    assert.deepEqual(pressed, [], `something was pressed after ${code}`);
  }
  assert.equal(asked, 0);
});

// --- A target the page draws only once a wall is answered ------------------
//
// company-website, lane t174 row R2: s2 declines a newsletter offer the page
// opens only after its "Your privacy choices" wall is answered, so the verb
// reports TARGET_NOT_FOUND and the loop used to only wait. The probe is
// injected; a challenge is never clearable (`interference/pressable-way-out.ts`).

test("a target hidden behind a consent wall: the wall is cleared, then the target is waited for on its own ladder", async () => {
  const absent = failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  // The wall stands until it is answered, and the offer is drawn only after.
  let wall = true;
  const cleared: string[] = [];
  const intervene = (fault: string): number => { cleared.push(fault); wall = false; return 1; };
  let calls = 0;
  const attempt = async (): Promise<BrowserActionResult> => {
    calls += 1;
    return wall || calls < 3 ? absent : succeeded("web.dom.click");
  };

  const { result, account } = await runWithRecovery(command("web.dom.click"), Date.now(), attempt, pause, Date.now, intervene, () => wall);

  assert.equal(result.status, "succeeded", "the offer's decline must be found once the wall is answered");
  assert.deepEqual(cleared, ["target_absent"], "the wall is cleared once, and not pressed at again once it has gone");
  assert.deepEqual(account, { attempts: 3, absorbed: ["target_absent", "target_absent"], waitedMs: 750, dismissed: 1, outcome: "recovered" });
  assert.deepEqual(paused, [250, 500], "the missing target keeps the target ladder, inside the same budget");
});

test("the wall is cleared before the wait, so the retry looks for the target on a page the wall has left", async () => {
  const order: string[] = [];
  let calls = 0;
  const attempt = async (): Promise<BrowserActionResult> => {
    order.push("attempt");
    calls += 1;
    return calls === 1 ? failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND) : succeeded("web.dom.click");
  };
  await runWithRecovery(
    command("web.dom.click"),
    Date.now(),
    attempt,
    async (ms) => { order.push(`pause ${ms}`); },
    Date.now,
    () => { order.push("clear"); return 1; },
    () => { order.push("probe"); return true; }
  );
  assert.deepEqual(order, ["attempt", "probe", "clear", "pause 250", "attempt"]);
});

test("a missing target with nothing clearable over the page is only waited for, as before", async () => {
  const absent = failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  const never = page("web.dom.click", Array.from({ length: 9 }, () => absent));
  const pressed: string[] = [];
  let asked = 0;
  // No layer, or only a challenge, which is never a clearable one.
  const probe = (): boolean => { asked += 1; return false; };
  const { result, account } = await runWithRecovery(command("web.dom.click"), Date.now(), never.attempt, pause, Date.now, (fault) => { pressed.push(fault); return 1; }, probe);
  assert.equal(result, absent);
  assert.deepEqual(pressed, [], "nothing is pressed at blind for a target that is merely late");
  assert.equal(asked, RECOVERY_TARGET_BACKOFF_MS.length, "the page is asked once per retry the ladder allows");
  assert.equal(account.dismissed, 0);
  assert.deepEqual(paused, [...RECOVERY_TARGET_BACKOFF_MS]);
});

test("a wall that will not clear does not stretch the missing target's ladder or its budget", async () => {
  const absent = failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  const never = page("web.dom.click", Array.from({ length: 9 }, () => absent));
  const { result, account } = await runWithRecovery(command("web.dom.click"), Date.now(), never.attempt, pause, Date.now, () => 0, () => true);
  assert.equal(result, absent, "the reported result must be the page's own");
  assert.equal(account.attempts, RECOVERY_TARGET_BACKOFF_MS.length + 1);
  assert.equal(account.outcome, "exhausted");
  assert.equal(account.dismissed, 0);
  assert.deepEqual(paused, [...RECOVERY_TARGET_BACKOFF_MS]);
});


// --- A control the page disables for a moment ------------------------------
//
// job-board's applicant tracker shows "I'm a person" disabled, reading "Please
// wait N", for three seconds after Submit, and a Flow reaches that step well
// inside three seconds (reports/t195-w19d-audit-apply-quillmark.md, C5). The
// gate refused it ACTION_REJECTED and nothing waited. These rows build each
// refusal with the real `actionRejected`, from exactly what the verb hands it,
// so what is asserted is the line from the verb's statement to the loop's
// decision: a gate refusal says the act did not happen (`effect: "unacted"`),
// and only that `disabled` is waited out. Which verbs make the statement, and
// that `check.ts` does not make it after `setCheckedState`, is held by
// `actions/tests/gate-refusal.test.ts`, which runs the verbs themselves.

type RejectAction = typeof import("../../results").actionRejected;

/**
 * The page globals `actionRejected` reads on its way to a result: the address
 * and title it stamps, the `querySelector` its sign-in and challenge rules
 * would ask -- which a command naming no selector never reaches -- and the
 * `window` its snapshot module reads as it loads. The previous globals, usually
 * none, are put back when the test ends.
 *
 * `results.ts` is imported only after this, by the rows themselves: its import
 * chain reads `window` at load (`frame-geometry.ts`), and a static import would
 * make this file pass only when another test file had left a `window` on the
 * global first.
 */
async function installRejectionPage(t: TestContext): Promise<RejectAction> {
  const scope = globalThis as unknown as Record<string, unknown>;
  const before = { document: scope.document, location: scope.location, window: scope.window };
  const view: Record<string, unknown> = { innerWidth: 1280, innerHeight: 800, addEventListener: () => undefined };
  view.top = view;
  scope.window = view;
  scope.document = { title: "Apply", body: null, querySelector: () => null, addEventListener: () => undefined };
  scope.location = { href: "http://127.0.0.1:4000/scenarios/job-board/apply" };
  t.after(() => {
    scope.document = before.document;
    scope.location = before.location;
    scope.window = before.window;
  });
  return (await import("../../results")).actionRejected;
}

/** A command with no selector, so the page-decided codes in `results.ts` are never asked. */
function bare(actionType: string): BrowserActionCommand {
  return { commandId: "c1", actionType } as BrowserActionCommand;
}

/** The evidence every refusal here carries: a snapshot already taken, so none is captured from the stub page. */
const TAKEN: ActionResultEvidence = { snapshot: {} as DomSnapshot };

/** The click gate's refusal of a control the page has disabled, as `actions/click.ts` hands it over. */
function gateDisabled(actionRejected: RejectAction): BrowserActionResult {
  return actionRejected(bare("web.dom.click"), Date.now(), "disabled", "a target that can be clicked", "the element is disabled", { ...TAKEN, refusedBeforeDispatch: true });
}

/** `check.ts`'s refusal after `setCheckedState` answered `disabled`: the same word, and no statement about the act. */
function checkedDisabled(actionRejected: RejectAction): BrowserActionResult {
  return actionRejected(bare("web.dom.check"), Date.now(), "disabled", "the control is checked", "the checkbox is disabled", TAKEN);
}

test("a click the gate refused because the control was disabled for a moment is waited out, and lands", async (t) => {
  const actionRejected = await installRejectionPage(t);
  const refusal = gateDisabled(actionRejected);
  assert.equal(refusal.failure?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, "the code is unchanged: the statement is the effect, not a new code");
  assert.equal(refusal.failure?.effect, "unacted");

  const shield = page("web.dom.click", [refusal]);
  const pressed: string[] = [];
  const { result, account } = await runWithRecovery(bare("web.dom.click"), Date.now(), shield.attempt, pause, Date.now, (fault) => { pressed.push(fault); return 1; }, () => true);
  assert.equal(result.status, "succeeded");
  assert.equal(shield.calls(), 2);
  assert.deepEqual(account, { attempts: 2, absorbed: ["disabled_target"], waitedMs: RECOVERY_BLIP_BACKOFF_MS[0], dismissed: 0, outcome: "recovered" });
  assert.deepEqual(pressed, [], "nothing stands over a disabled control, so nothing on the page is pressed");
});

test("a disabled control check.ts found after setCheckedState is refused, not waited out", async (t) => {
  const actionRejected = await installRejectionPage(t);
  const refusal = checkedDisabled(actionRejected);
  assert.equal(refusal.failure?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED);
  assert.ok(refusal.failure?.actual?.startsWith("disabled:"), "the same reason word the gate writes");
  assert.equal(refusal.failure?.effect, undefined, "written after setCheckedState, so it states nothing about the act");

  const checked = page("web.dom.check", [refusal]);
  const { result, account } = await runWithRecovery(bare("web.dom.check"), Date.now(), checked.attempt, pause);
  assert.equal(result, refusal);
  assert.equal(checked.calls(), 1, "the verb ran once and was not run again");
  assert.equal(account.attempts, 1);
  assert.deepEqual(paused, []);
});

test("a control that stays disabled past the budget fails as it did before, with the page's own refusal", async (t) => {
  const actionRejected = await installRejectionPage(t);
  let clock = 0;
  const advancingPause = async (ms: number): Promise<void> => {
    paused.push(ms);
    clock += ms;
  };
  const refusals: BrowserActionResult[] = [];
  let dispatchedAt = 0;
  const attempt = async (): Promise<BrowserActionResult> => {
    dispatchedAt = clock;
    // Each attempt itself takes most of a second, as a hit test on a busy page can.
    clock += 900;
    const refusal = gateDisabled(actionRejected);
    refusals.push(refusal);
    return refusal;
  };
  const { result, account } = await runWithRecovery(bare("web.dom.click"), 0, attempt, advancingPause, () => clock);
  assert.equal(result.status, "failed");
  assert.equal(result, refusals.at(-1), "the reported result must be the last attempt's own");
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED);
  assert.equal(account.outcome, "exhausted");
  assert.ok(dispatchedAt < RECOVERY_BUDGET_MS, `an attempt was dispatched at ${dispatchedAt} ms, past the budget`);
  assert.ok(account.absorbed.length >= 2 && account.absorbed.every((fault) => fault === "disabled_target"));
});
