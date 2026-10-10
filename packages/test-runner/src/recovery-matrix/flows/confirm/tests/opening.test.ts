// The friend-request Flows open the same way, and name only what the page
// renders. social-network-feed's script turns `data-lb` and `data-db` into
// `aria-labelledby` and `aria-describedby` and `data-uid` into a generated id,
// dropping all three (`client/shell-script.ts`, `hydrate`), so a selector on
// one of them never matches. Until t403 the cookie and "Not now" steps named
// `data-lb`, never found their targets, and the interference clearing answered
// both prompts in their place (matrix 13a and 13b, t399). Whether the new
// selectors find the right buttons is the Lab's to show: `pnpm lab
// recovery-matrix --case 13b`.

import assert from "node:assert/strict";
import test from "node:test";
import { CONFIRM_OPENING, CONFIRM_QUALIFYING, CONFIRM_THEN_STOP, CONFIRM_WITH_CHECKPOINT } from "../index.js";

const FLOWS: Record<string, string> = { CONFIRM_QUALIFYING, CONFIRM_THEN_STOP, CONFIRM_WITH_CHECKPOINT };

/** The attributes the feed's markup source carries and its script removes before anything can read them. */
const SOURCE_ONLY = /\[data-(?:lb|uid|db)\b/u;

test("every friend-request Flow opens with the shared opening", () => {
  for (const [name, flow] of Object.entries(FLOWS)) assert.ok(flow.includes(CONFIRM_OPENING), name);
});

// A route back lands on the checkpoint, so the checkpoint must run on the page the confirms are on. On "see all
// friend requests", a press only the Friends home allows, the route never got back to the confirms (t411).
test("row 10's checkpoint is a wait for the requests page, before the first confirm", () => {
  const steps = CONFIRM_WITH_CHECKPOINT.split(/\n(?=step)/u);
  const checkpoints = steps.filter((step) => /^\s*checkpoint: yes$/mu.test(step));
  assert.equal(checkpoints.length, 1);
  const checkpoint = checkpoints[0]!;
  assert.match(checkpoint, /^step requests: /u);
  assert.match(checkpoint, /^\s*node: web\.dom\.wait_for_selector$/mu);
  assert.ok(checkpoint.includes(`selector: [role="main"] a[href$="/friends/requests/sent/"]`));
  assert.doesNotMatch(checkpoint, /^\s*consequences:/mu);
  assert.match(steps[steps.indexOf(checkpoint) + 1] ?? "", /^step amara: confirm Amara Osei/u);
});

test("no friend-request Flow targets an attribute the feed's script strips", () => {
  for (const [name, flow] of Object.entries(FLOWS)) {
    for (const line of flow.split("\n").filter((text) => /^\s*selector:/u.test(text))) {
      assert.doesNotMatch(line, SOURCE_ONLY, `${name}: ${line.trim()}`);
    }
  }
});

test("the two prompts are told apart by the close control only the notifications prompt has", () => {
  const selectors = CONFIRM_OPENING.split("\n").filter((text) => /^\s*selector:/u.test(text)).map((text) => text.trim());
  assert.ok(selectors.includes('selector: [role="dialog"][aria-modal="true"]:not(:has([aria-label="Close"])) > div:last-child > [role="button"]:last-child'));
  assert.ok(selectors.includes('selector: [role="dialog"][aria-modal="true"]:has([aria-label="Close"]) > div:last-child > [role="button"]:first-child'));
});
