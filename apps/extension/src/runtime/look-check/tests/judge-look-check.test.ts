// T1 coverage of judge-look-check.ts: a look that meets a robot check answers as
// a landing does. The tab is a fake whose top frame answers the page-challenge
// question in turn; a self-clearing wait runs on the real clock at its
// 500 ms poll, so each row that waits keeps its budget small.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation";
import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand } from "../../../shared/protocol";
import type { FrameSender } from "../../landed-challenge";
import type { LandedTabAccess } from "../../landed-check-wait";
import { judgeLookCheck } from "..";

const TAB_ID = 7;
const PERSON_ONLY = { challenge: "captcha", robotCheck: "person_only" };
const SELF_CLEARING = { challenge: "captcha", robotCheck: "self_clearing" };
const NO_CHECK = { challenge: null };

/** A tab whose top frame answers `answers` in turn (the last for ever after); an Error answer is a frame that cannot be asked. */
function tab(answers: unknown[]): LandedTabAccess & { asked: number } {
  let index = 0;
  const access = {
    asked: 0,
    send: (async () => {
      access.asked += 1;
      const answer = answers[Math.min(index, answers.length - 1)];
      index += 1;
      if (answer instanceof Error) throw answer;
      return answer;
    }) as FrameSender,
    settle: async () => undefined
  };
  return access;
}

function look(timeoutMs?: number): BrowserActionCommand {
  return { commandId: "c-look", actionType: "web.dom.capture_snapshot", tabId: TAB_ID, checkWaitMs: 15_000, ...(timeoutMs === undefined ? {} : { timeoutMs }) };
}

test("a page only a person can clear fails the look USER_INTERVENTION_REQUIRED, captcha first, as a landing does", async () => {
  const judged = await judgeLookCheck(look(), TAB_ID, Date.now(), tab([PERSON_ONLY]));
  assert.equal(judged?.kind, "check_standing");
  if (judged?.kind !== "check_standing") return;
  const { result } = judged;
  assert.equal(result.commandId, "c-look");
  assert.equal(result.actionType, "web.dom.capture_snapshot");
  assert.equal(result.status, "failed");
  assert.equal(result.message, "The page is a robot check, which only a person can answer.");
  assert.deepEqual(result.validation, { status: "failed", expected: "a page to look at", actual: "the page looked at is a robot check, which only a person can answer" });
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED);
  assert.equal(result.failure?.actual, "captcha: the page looked at is a robot check, which only a person can answer");
  // Core drops a record it refuses whole, and the domain reads the person-needed mark off it.
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("a check that clears by itself is waited out, and the look is told how long it stood", async () => {
  const access = tab([SELF_CLEARING, SELF_CLEARING, NO_CHECK]);
  const judged = await judgeLookCheck(look(), TAB_ID, Date.now(), access);
  assert.equal(judged?.kind, "check_cleared");
  if (judged?.kind !== "check_cleared") return;
  assert.ok(judged.checkWait.waitedMs >= 400, `waited ${judged.checkWait.waitedMs} ms`);
  // The first reading, a poll still on the check, a poll past it, and the settled page's confirmation.
  assert.equal(access.asked, 4);
});

test("a check that said it would clear and is still up when the look's time runs out is the person's", async () => {
  // 1.7 s less the reply margin: about 0.7 s of waiting.
  const judged = await judgeLookCheck(look(1_700), TAB_ID, Date.now(), tab([SELF_CLEARING]));
  assert.equal(judged?.kind, "check_standing");
  if (judged?.kind !== "check_standing") return;
  assert.equal(judged.result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED);
  assert.match(judged.result.failure?.actual ?? "", /^captcha: the page looked at is a robot check that said it would clear by itself and had not after \d+ ms, so only a person can answer it now$/u);
});

test("a self-clearing check that turns into one only a person can answer is the person's at once", async () => {
  const judged = await judgeLookCheck(look(), TAB_ID, Date.now(), tab([SELF_CLEARING, PERSON_ONLY]));
  assert.equal(judged?.kind, "check_standing");
  if (judged?.kind !== "check_standing") return;
  assert.match(judged.result.failure?.actual ?? "", /asked for what only a person can answer$/u);
});

test("a page with no check, and a frame that cannot be asked, leave the look to be taken as it always was", async () => {
  assert.equal(await judgeLookCheck(look(), TAB_ID, Date.now(), tab([NO_CHECK])), undefined);
  assert.equal(await judgeLookCheck(look(), TAB_ID, Date.now(), tab([{ challenge: "credential" }])), undefined);
  const unreachable = tab([new Error("Could not establish connection. Receiving end does not exist.")]);
  assert.equal(await judgeLookCheck(look(), TAB_ID, Date.now(), unreachable), undefined);
  assert.equal(unreachable.asked, 1);
});
