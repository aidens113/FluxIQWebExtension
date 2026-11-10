// Coverage of origin-pace.ts: an origin that has never refused a load is not
// paced at all (task speed S10); its first refusal holds its next load and
// spaces it from then on, each later one slows it further up to the cap, for
// good; and origins never slow each other.

import assert from "node:assert/strict";
import test from "node:test";
import { OriginPace } from "../origin-pace";
import { PAGE_LOAD_PACE_SETTINGS } from "../pace-settings";

const STORE = "http://127.0.0.1:4173";
const OTHER = "https://other.test";
const { spacingMs, refusalWaitMs, cooledSpacingCapMs } = PAGE_LOAD_PACE_SETTINGS;

function paced(start = 1_000): { pace: OriginPace; clock: { now: number } } {
  const clock = { now: start };
  return { pace: new OriginPace(PAGE_LOAD_PACE_SETTINGS, () => clock.now), clock };
}

test("an origin that has never refused a load is not paced, however close its loads come", () => {
  const { pace, clock } = paced();
  for (let load = 0; load < 20; load += 1) {
    assert.equal(pace.reserve(STORE), 0);
    clock.now += 100;
  }
  assert.equal(pace.spacingOf(STORE), 0);
  for (const served of [200, 204, 301, 404, 500]) assert.equal(pace.noteRefusal(STORE, served), false, `status ${served} is no refusal`);
  assert.equal(pace.reserve(STORE), 0, "a status that is not 429 or 503 paces nothing");
  assert.equal(pace.refusalsOf(STORE), 0);
});

test("a first refusal holds the origin's next load until it is waited out, then spaces each load from the one before", () => {
  const { pace, clock } = paced();
  pace.reserve(STORE);
  clock.now += 100;
  assert.equal(pace.noteRefusal(STORE, 429), true);
  assert.equal(pace.spacingOf(STORE), 2 * spacingMs, "backed off to where a pace that had held the base all along would stand");
  assert.equal(pace.reserve(STORE), refusalWaitMs, "the next load waits out the refusal from when it was seen");
  assert.equal(pace.reserve(STORE), refusalWaitMs + 2 * spacingMs, "and the one asked for with it one spacing later");
  clock.now += refusalWaitMs + 10_000;
  assert.equal(pace.reserve(STORE), 0, "a load long after the last goes at once");
  assert.equal(pace.reserve(STORE), 2 * spacingMs, "and the next is spaced from it");
});

test("each later refusal doubles the spacing, up to the cap, for good", () => {
  const { pace, clock } = paced();
  pace.noteRefusal(STORE, 429);
  assert.equal(pace.spacingOf(STORE), 2 * spacingMs);
  pace.noteRefusal(STORE, 503);
  assert.equal(pace.spacingOf(STORE), cooledSpacingCapMs, "doubled again, held to the cap");
  pace.noteRefusal(STORE, 429);
  assert.equal(pace.spacingOf(STORE), cooledSpacingCapMs);
  assert.equal(pace.refusalsOf(STORE), 3);
  clock.now += 60 * 60_000;
  pace.reserve(STORE);
  assert.equal(pace.reserve(STORE), cooledSpacingCapMs, "an hour later the origin is still paced as one that refuses");
});

test("a refusal on one origin does not slow another", () => {
  const { pace } = paced();
  pace.reserve(STORE);
  pace.noteRefusal(STORE, 429);
  assert.equal(pace.reserve(OTHER), 0);
  assert.equal(pace.reserve(OTHER), 0);
  assert.equal(pace.spacingOf(OTHER), 0);
});

test("the wait before an origin's next load is read without booking it: none until it refuses, the refusal wait after", () => {
  const { pace, clock } = paced();
  assert.equal(pace.waitBeforeNextLoad(STORE), 0, "an origin with no load booked waits for nothing");
  assert.equal(pace.reserve(STORE), 0);
  assert.equal(pace.waitBeforeNextLoad(STORE), 0, "nor one that has never refused");
  pace.noteRefusal(STORE, 429);
  assert.equal(pace.waitBeforeNextLoad(STORE), refusalWaitMs);
  assert.equal(pace.waitBeforeNextLoad(STORE), refusalWaitMs, "and reading it books nothing");
  clock.now += refusalWaitMs + 1;
  assert.equal(pace.waitBeforeNextLoad(STORE), 0, "a wait already over is no wait");
  assert.equal(pace.waitBeforeNextLoad(OTHER), 0, "other origins are untouched");
});
