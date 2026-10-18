// The loop scrolls toward a target the page has not shown before each retry,
// as a person told to press it would (`../attempt.ts`, `../../reveal/`).
//
// Live (install-core): every click on a "Show more people" button the page had
// not shown yet was refused TARGET_NOT_SHOWN, "the element's display is none",
// and "did not recover within its 4 attempts": the loop cleared layers and
// waited, and the grid above the button, which loads a batch and finally
// unhides it each time its end is scrolled into view, was never scrolled.
//
// The scroll is injected, as the intervention is, so what is asserted here is
// the loop's contract: it scrolls for an obstruction only, after clearing and
// before waiting, on every attempt that has a retry after it; a scroll that
// moved the page waits on the reveal ladder, which has as many rungs as the
// interference ladder, so the number of attempts is unchanged; and the account
// says whether the target was revealed. Where the scroll goes on a real page is
// `../../reveal/tests/`, and the content harness proves it end to end.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_FAILURE_CODES, type WebAutomationFailureCode } from "@fluxiq-web-extension/domain/client";
import { runWithRecovery } from "../attempt";
import { RECOVERY_INTERFERENCE_BACKOFF_MS, RECOVERY_REVEAL_BACKOFF_MS } from "../budget";
import { recordRecovery } from "../record";
import type { BrowserActionCommand, BrowserActionResult } from "../../../types";

const CLICK = { commandId: "c1", actionType: "web.dom.click" } as unknown as BrowserActionCommand;

function failed(code: WebAutomationFailureCode, actual: string): BrowserActionResult {
  return {
    commandId: "c1",
    actionType: "web.dom.click",
    status: "failed",
    validation: { status: "failed", expected: "a target that can be clicked", actual },
    failure: { category: "target_not_found", code, retryable: true, stage: "target_resolution", actual, effect: "unacted" },
    startedAt: 0,
    finishedAt: 1
  } as unknown as BrowserActionResult;
}

const notShown = (): BrowserActionResult => failed(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN, "hidden: the element's display is none");

function succeeded(): BrowserActionResult {
  return {
    commandId: "c1",
    actionType: "web.dom.click",
    status: "succeeded",
    validation: { status: "passed", expected: "e", actual: "clicked" },
    startedAt: 0,
    finishedAt: 1
  } as unknown as BrowserActionResult;
}

/** A page answering `failures` in order and then, unless `never`, succeeding; and a log of what the loop did between attempts. */
function page(failures: readonly BrowserActionResult[], never = false) {
  const log: string[] = [];
  let calls = 0;
  return {
    log,
    attempt: async (): Promise<BrowserActionResult> => {
      log.push("attempt");
      const result = failures[calls] ?? (never ? failures[failures.length - 1]! : succeeded());
      calls += 1;
      return result;
    },
    pause: async (ms: number): Promise<void> => {
      log.push(`pause ${ms}`);
    },
    intervene: (): number => {
      log.push("clear");
      return 0;
    },
    reveal: (moves: boolean) => (): boolean => {
      log.push("scroll");
      return moves;
    }
  };
}

test("a target not shown until its list is scrolled: each retry scrolls first, waits the reveal ladder, and the click lands", async () => {
  const site = page([notShown(), notShown(), notShown()]);
  const { result, account } = await runWithRecovery(CLICK, Date.now(), site.attempt, site.pause, Date.now, site.intervene, () => false, site.reveal(true));
  assert.equal(result.status, "succeeded");
  assert.deepEqual(account, {
    attempts: 4,
    absorbed: ["obstructed_target", "obstructed_target", "obstructed_target"],
    waitedMs: 400 + 800 + 1_600,
    dismissed: 0,
    outcome: "recovered",
    reveal: { scrolls: 3, shown: true }
  });
  assert.deepEqual(site.log, [
    "attempt", "clear", "scroll", "pause 400",
    "attempt", "clear", "scroll", "pause 800",
    "attempt", "clear", "scroll", "pause 1600",
    "attempt"
  ], "layers are cleared, then the page is scrolled, then the loop waits for it to answer");
  const reported = recordRecovery(result, account);
  assert.equal(reported.validation.status === "none" ? "" : reported.validation.actual,
    "clicked; the execution recovered on attempt 4 after absorbing obstructed_target, obstructed_target, obstructed_target, scrolling 3 times toward where the target would be, which revealed it, waiting 2800 ms");
});

test("a target scrolling does not reveal: the attempts are the same four, and the account says scrolling did not reveal it", async () => {
  const site = page([notShown()], true);
  const { result, account } = await runWithRecovery(CLICK, Date.now(), site.attempt, site.pause, Date.now, site.intervene, () => false, site.reveal(true));
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN, "the page's own refusal is the answer");
  assert.equal(account.attempts, 1 + RECOVERY_REVEAL_BACKOFF_MS.length);
  assert.equal(RECOVERY_REVEAL_BACKOFF_MS.length, RECOVERY_INTERFERENCE_BACKOFF_MS.length, "revealing changes how long a retry waits, never how many there are");
  assert.deepEqual(account.reveal, { scrolls: 3, shown: false });
  assert.equal(site.log.filter((step) => step === "scroll").length, 3, "no scroll after the last attempt, which has no retry to answer it");
  const reported = recordRecovery(result, account);
  assert.match(reported.failure?.actual ?? "", /^hidden: the element's display is none; the execution did not recover within its 4 attempts after absorbing obstructed_target, obstructed_target, obstructed_target, obstructed_target, scrolling 3 times toward where the target would be, which did not reveal it, waiting 2800 ms$/u);
});

test("a scroll that moved nothing woke nothing: the wait is the interference ladder and the account mentions no scrolling", async () => {
  const site = page([notShown(), notShown()]);
  const { account } = await runWithRecovery(CLICK, Date.now(), site.attempt, site.pause, Date.now, site.intervene, () => false, site.reveal(false));
  assert.deepEqual(account, { attempts: 3, absorbed: ["obstructed_target", "obstructed_target"], waitedMs: 150 + 400, dismissed: 0, outcome: "recovered" });
  assert.equal(site.log.filter((step) => step === "scroll").length, 2, "it was asked, and answered that nothing moved");
});

test("a target the page has not drawn at all is waited for and never scrolled for", async () => {
  const site = page([failed(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, "no element matched")]);
  const { account } = await runWithRecovery(CLICK, Date.now(), site.attempt, site.pause, Date.now, site.intervene, () => false, site.reveal(true));
  assert.equal(account.outcome, "recovered");
  assert.equal(account.reveal, undefined);
  assert.deepEqual(site.log, ["attempt", "pause 250", "attempt"]);
});

test("the reveal ladder never runs past the command's own timeout", async () => {
  const site = page([notShown()], true);
  let clock = 0;
  const pause = async (ms: number): Promise<void> => {
    clock += ms;
  };
  const timed = { ...CLICK, timeoutMs: 1_000 } as BrowserActionCommand;
  const { account } = await runWithRecovery(timed, 0, site.attempt, pause, () => clock, site.intervene, () => false, site.reveal(true));
  assert.equal(account.waitedMs, 1_000, "400, then the 600 left of the 1000 ms the node allowed");
  assert.equal(account.outcome, "exhausted");
});
