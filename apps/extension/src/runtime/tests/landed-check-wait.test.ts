// T1 coverage of landed-check-wait.ts: how a wait on a self-clearing robot
// check ends -- cleared, turned into one only a person can answer, or out of
// time -- and that it never waits longer than the command allows. The tab is a
// probe answering readings in turn, on a clock the test moves, so no row costs
// the wall-clock seconds a real check takes.

import assert from "node:assert/strict";
import { test } from "node:test";
import { webAutomationActionFromGatewayCommand, webAutomationCheckWaitParameters } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand } from "../../shared/protocol";
import type { LandedPageReading } from "../landed-challenge";
import { SELF_CLEARING_WAIT_MS, checkWaitBudgetMs, settleLandedReading, standingCheckWords, waitOutLandedCheck, type LandedCheckProbe } from "../landed-check-wait";

const SELF_CLEARING: LandedPageReading = { kind: "robot_check", check: "self_clearing" };
const PERSON_ONLY: LandedPageReading = { kind: "robot_check", check: "person_only" };
const NO_CHECK: LandedPageReading = { kind: "no_robot_check" };
const BETWEEN_DOCUMENTS: LandedPageReading = { kind: "unread", why: "the top frame could not be asked: Receiving end does not exist." };

/** A tab that answers `readings` in turn (the last one for ever after), on a clock only `sleep` moves. */
function tab(readings: LandedPageReading[]): LandedCheckProbe & { asked: number; settled: number } {
  let clock = 0;
  let index = 0;
  const probe = {
    asked: 0,
    settled: 0,
    read: async () => {
      probe.asked += 1;
      const reading = readings[Math.min(index, readings.length - 1)]!;
      index += 1;
      return reading;
    },
    settle: async () => {
      probe.settled += 1;
    },
    sleep: async (ms: number) => {
      clock += ms;
    },
    now: () => clock
  };
  return probe;
}

test("a check that goes away is cleared once the page behind it has settled and still reads as no check", async () => {
  const probe = tab([SELF_CLEARING, SELF_CLEARING, NO_CHECK, NO_CHECK]);
  const wait = await waitOutLandedCheck(probe, 15_000);
  assert.deepEqual(wait, { outcome: "cleared", waitedMs: 1_500 });
  assert.equal(probe.settled, 1);
});

test("a page between documents is no answer either way, and the wait goes on through it", async () => {
  const probe = tab([BETWEEN_DOCUMENTS, BETWEEN_DOCUMENTS, NO_CHECK, NO_CHECK]);
  assert.equal((await waitOutLandedCheck(probe, 15_000)).outcome, "cleared");
});

test("a check that turns into one only a person can answer ends the wait at once", async () => {
  const probe = tab([SELF_CLEARING, PERSON_ONLY]);
  assert.deepEqual(await waitOutLandedCheck(probe, 15_000), { outcome: "person_only", waitedMs: 1_000 });
});

test("a no-check reading the settled page contradicts is not a clearing", async () => {
  // The check reloads onto itself: between documents it read as no check.
  const probe = tab([NO_CHECK, SELF_CLEARING, SELF_CLEARING, NO_CHECK, NO_CHECK]);
  const wait = await waitOutLandedCheck(probe, 15_000);
  assert.equal(wait.outcome, "cleared");
  assert.equal(probe.settled, 2, "the first no-check was checked again and did not hold");
});

test("a check still up when the time runs out is not cleared, and the wait took the whole budget", async () => {
  const probe = tab([SELF_CLEARING]);
  assert.deepEqual(await waitOutLandedCheck(probe, SELF_CLEARING_WAIT_MS), { outcome: "not_cleared", waitedMs: SELF_CLEARING_WAIT_MS });
  assert.equal(probe.asked, SELF_CLEARING_WAIT_MS / 500);
});

test("no budget is no wait", async () => {
  const probe = tab([NO_CHECK]);
  assert.deepEqual(await waitOutLandedCheck(probe, 0), { outcome: "not_cleared", waitedMs: 0 });
  assert.equal(probe.asked, 0);
});

test("only a self-clearing reading is waited on; every other one is returned as it was, without asking again", async () => {
  const access = { send: () => Promise.reject(new Error("not asked")), settle: () => Promise.reject(new Error("not settled")) };
  for (const reading of [PERSON_ONLY, NO_CHECK, BETWEEN_DOCUMENTS, undefined]) {
    assert.deepEqual(await settleLandedReading(reading, 41, access, 15_000), { reading });
  }
});

test("a self-clearing reading that clears reads as no check afterwards, beside the wait", async () => {
  let answers = [{ challenge: "captcha", robotCheck: "self_clearing" }, { challenge: null }];
  const access = {
    send: <T>() => {
      const answer = answers[0];
      answers = answers.slice(1).length > 0 ? answers.slice(1) : answers;
      return Promise.resolve(answer as T);
    },
    settle: () => Promise.resolve()
  };
  const settled = await settleLandedReading(SELF_CLEARING, 41, access, 5_000);
  assert.deepEqual(settled.reading, NO_CHECK);
  assert.equal(settled.checkWait?.outcome, "cleared");
});

const ACTION: BrowserActionCommand = { commandId: "c-nav", actionType: "web.browser.navigate", url: "http://127.0.0.1/" };

test("the wait is 15 s when the command names no timeout, and within what is left of one when it does", () => {
  assert.equal(checkWaitBudgetMs(ACTION, 1_000, 5_000), 15_000);
  assert.equal(checkWaitBudgetMs({ ...ACTION, timeoutMs: 60_000 }, 1_000, 5_000), 15_000);
  assert.equal(checkWaitBudgetMs({ ...ACTION, timeoutMs: 10_000 }, 1_000, 5_000), 5_000, "10 s less the 4 s spent and a 1 s margin");
  assert.equal(checkWaitBudgetMs({ ...ACTION, timeoutMs: 3_000 }, 1_000, 5_000), 0);
});

test("a recorded 5 s click given the check allowance waits a check out for the full 15 s, inside Core's deadline", () => {
  // `run-munx9bvj-a7ba7442`, node `entry.13`: a 5 s click cut the wait to 3,913 ms
  // and an 8 s check went to a person. With the allowance the command's timeout
  // is 20 s, Core waits 23 s, and the whole wait fits with the reply margin.
  const recorded = { ...ACTION, timeoutMs: 20_000, checkWaitMs: 15_000 } as BrowserActionCommand;
  assert.equal(checkWaitBudgetMs(recorded, 1_000, 2_000), 15_000);
  assert.equal(checkWaitBudgetMs(recorded, 1_000, 6_000), 14_000, "20 s less the 5 s spent and the 1 s margin");
});

// t203: a click a model built had no allowance. Its Flow node dispatches the
// parameters the model wrote -- here `timeoutMs` 5 s -- so the page gave a check
// about three seconds, and bigbox's clears after 8 s (`run-muoga8at`). Now the
// node dispatches them through the one allowance every click gets
// (`domain/src/actions/check-wait.ts`), and this is that command as the page
// reads it off the gateway.
function builtClick(parameters: Record<string, number | string>): BrowserActionCommand {
  const command = webAutomationActionFromGatewayCommand({ commandId: "c-built", actionType: "web.dom.click", parameters: webAutomationCheckWaitParameters("web.dom.click", parameters) });
  assert.ok(!("status" in command), "the built click is a command, not a rejection");
  return command as BrowserActionCommand;
}

/** Bigbox's "Robot or human?": says it is clearing, and is gone after 8 s. */
const EIGHT_SECOND_CHECK: LandedPageReading[] = [...Array.from({ length: 16 }, () => SELF_CLEARING), NO_CHECK];

test("a click a model built waits out a check that clears by itself after 8 s", async () => {
  const command = builtClick({ selector: "#add", timeoutMs: 5_000 });
  assert.equal(command.timeoutMs, 5_000 + SELF_CLEARING_WAIT_MS);
  assert.equal(command.checkWaitMs, SELF_CLEARING_WAIT_MS);
  // The press took a second before the check went up.
  const budget = checkWaitBudgetMs(command, 0, 1_000);
  assert.equal(budget, SELF_CLEARING_WAIT_MS);
  assert.deepEqual(await waitOutLandedCheck(tab(EIGHT_SECOND_CHECK), budget), { outcome: "cleared", waitedMs: 8_500 });
  // A model that wrote no timeout is waited on in full too.
  assert.equal(checkWaitBudgetMs(builtClick({ selector: "#add" }), 0, 1_000), SELF_CLEARING_WAIT_MS);
});

test("without the allowance the same click ran out before the 8 s check cleared", async () => {
  const unallowed = { commandId: "c-before", actionType: "web.dom.click", selector: "#add", timeoutMs: 5_000 } as BrowserActionCommand;
  const budget = checkWaitBudgetMs(unallowed, 0, 1_000);
  assert.equal(budget, 3_000);
  assert.equal((await waitOutLandedCheck(tab(EIGHT_SECOND_CHECK), budget)).outcome, "not_cleared");
});

test("a built click still hands a check that does not clear to the person", async () => {
  const command = builtClick({ selector: "#add", timeoutMs: 5_000 });
  const budget = checkWaitBudgetMs(command, 0, 1_000);
  const stuck = await waitOutLandedCheck(tab([SELF_CLEARING]), budget);
  assert.deepEqual(stuck, { outcome: "not_cleared", waitedMs: SELF_CLEARING_WAIT_MS });
  assert.match(standingCheckWords("the page the browser landed on", stuck), /only a person can answer it now/u);
  // One that turns into a person-only check is handed over at once.
  const personOnly = await waitOutLandedCheck(tab([SELF_CLEARING, PERSON_ONLY]), budget);
  assert.equal(personOnly.outcome, "person_only");
  assert.match(standingCheckWords("the page the browser landed on", personOnly), /only a person can answer/u);
});
