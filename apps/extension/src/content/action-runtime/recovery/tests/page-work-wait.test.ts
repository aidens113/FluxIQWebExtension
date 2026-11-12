// A target refused as not shown is waited on while the page shows it is working toward it,
// and no longer (t903). E1's trace of company-website-apprentices: the replay pressed "Show
// more people" 0.7 s after the team page loaded; the page was still loading its people behind
// skeleton cards and a 429 back-off, and showed the button 4.4 s in. The loop waited the
// dismissed-dialog ladder, about 1.35 s, and gave up, so Core retried the step.
//
// The page's work is injected (`../../reveal/page-work.ts` reads it on a real page), as are the
// pause and the clock, so seconds of waiting run instantly and are still asserted.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { PageWork } from "../../reveal";
import { runWithRecovery } from "../attempt";
import { RECOVERY_BUDGET_MS } from "../budget";
import type { BrowserActionCommand, BrowserActionResult } from "../../../types";

const LOOK_MS = 100;

function command(timeoutMs?: number): BrowserActionCommand {
  return { commandId: "c1", actionType: "web.dom.click", ...(timeoutMs === undefined ? {} : { timeoutMs }) } as unknown as BrowserActionCommand;
}

function notShown(): BrowserActionResult {
  return {
    commandId: "c1", actionType: "web.dom.click", status: "failed",
    validation: { status: "failed", expected: "e", actual: "hidden: the element is hidden" },
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN, { actual: "hidden: the element is hidden" }),
    startedAt: 0, finishedAt: 1
  } as unknown as BrowserActionResult;
}

function succeeded(): BrowserActionResult {
  return { commandId: "c1", actionType: "web.dom.click", status: "succeeded", validation: { status: "passed", expected: "e", actual: "a" }, startedAt: 0, finishedAt: 1 } as unknown as BrowserActionResult;
}

/**
 * A page that shows its target at `showsAtMs` and shows work until `worksUntilMs`, on a clock the
 * pause moves; every attempt before the target shows is refused as not shown.
 */
function stand(showsAtMs: number | undefined, worksUntilMs: number) {
  let clock = 0;
  let attempts = 0;
  const work: PageWork = { shown: () => showsAtMs !== undefined && clock >= showsAtMs, working: () => clock < worksUntilMs };
  return {
    now: () => clock,
    pause: async (ms: number) => { clock += ms; },
    attempt: async () => {
      attempts += 1;
      return showsAtMs !== undefined && clock >= showsAtMs ? succeeded() : notShown();
    },
    attempts: () => attempts,
    work: (result: BrowserActionResult) => (result.status === "failed" ? work : undefined),
    noReveal: () => false
  };
}

test("a target the page is still working toward is waited on while it works, and pressed once it shows", async () => {
  // The team page: work for 4.4 s, the button shown at 4.4 s, the command given 10 s.
  const page = stand(4_400, 4_400);
  const { result, account } = await runWithRecovery(command(10_000), 0, page.attempt, page.pause, page.now, () => 0, () => false, page.noReveal, page.work);
  assert.equal(result.status, "succeeded");
  assert.equal(page.attempts(), 2, "one refusal, one press once the target shows: no ladder of attempts");
  assert.equal(account.waitedMs, 4_400);
  assert.equal(account.outcome, "recovered");
});

test("work past the defence's own 5 s is still waited on, within the command's budget", async () => {
  const page = stand(6_500, 6_500);
  const { result } = await runWithRecovery(command(10_000), 0, page.attempt, page.pause, page.now, () => 0, () => false, page.noReveal, page.work);
  assert.ok(6_500 > RECOVERY_BUDGET_MS);
  assert.equal(result.status, "succeeded");
});

test("a page that shows no work is not waited on: the refusal is the answer after one look", async () => {
  const page = stand(undefined, 0);
  const { result, account } = await runWithRecovery(command(10_000), 0, page.attempt, page.pause, page.now, () => 0, () => false, page.noReveal, page.work);
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN);
  assert.equal(page.attempts(), 1);
  assert.equal(page.now(), LOOK_MS, "one look, a sampling period, and no ladder");
  // The look is the defence reached and not enough: it stays on the account, which follows the reason.
  assert.deepEqual(account.absorbed, ["obstructed_target"]);
  assert.equal(account.outcome, "exhausted");
});

test("when the work stops and the target is still absent, it is tried once more and then the refusal is the answer", async () => {
  const page = stand(undefined, 1_000);
  const { result, account } = await runWithRecovery(command(10_000), 0, page.attempt, page.pause, page.now, () => 0, () => false, page.noReveal, page.work);
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN);
  assert.equal(page.attempts(), 2);
  assert.equal(page.now(), 1_000 + LOOK_MS);
  assert.equal(account.outcome, "exhausted");
});

test("work that outlasts the command's budget ends the wait there, with the page's own refusal", async () => {
  const page = stand(undefined, 60_000);
  const { result } = await runWithRecovery(command(3_000), 0, page.attempt, page.pause, page.now, () => 0, () => false, page.noReveal, page.work);
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN);
  assert.equal(page.now(), 3_000);
});
