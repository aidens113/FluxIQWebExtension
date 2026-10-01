// Coverage of origin-pace.ts: loads on one origin are spaced and loads on
// different origins are not; a refusal holds the origin's next load and slows it
// for good, up to the cap; and an origin that never refuses never pays for one.

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

test("loads on one origin are spaced from the start of the one before, and the first goes at once", () => {
  const { pace, clock } = paced();
  assert.equal(pace.reserve(STORE), 0);
  assert.equal(pace.reserve(STORE), spacingMs, "a load asked for at the same moment waits one spacing");
  clock.now += 1_000;
  assert.equal(pace.reserve(STORE), 2 * spacingMs - 1_000, "the third is booked after the second's booked start");
  clock.now += 10_000;
  assert.equal(pace.reserve(STORE), 0, "a load long after the last goes at once");
});

test("loads on different origins do not wait for each other", () => {
  const { pace } = paced();
  assert.equal(pace.reserve(STORE), 0);
  assert.equal(pace.reserve(OTHER), 0);
  assert.equal(pace.reserve("https://third.test"), 0);
  assert.equal(pace.reserve(STORE), spacingMs, "the store's own spacing still holds");
});

test("an origin that never refuses keeps the base spacing, and loads already that far apart never wait", () => {
  const { pace, clock } = paced();
  let waited = 0;
  for (let load = 0; load < 50; load += 1) {
    waited += pace.reserve(STORE);
    clock.now += spacingMs + 500;
  }
  assert.equal(waited, 0);
  assert.equal(pace.spacingOf(STORE), spacingMs);
  for (const served of [200, 204, 301, 404, 500]) assert.equal(pace.noteRefusal(STORE, served), false, `status ${served} is no refusal`);
  assert.equal(pace.spacingOf(STORE), spacingMs, "a status that is not 429 or 503 slows nothing");
  assert.equal(pace.refusalsOf(STORE), 0);
});

test("an ordinary five-page read, about 2.2 s a page as live reads run, waits little over a second in all", () => {
  const { pace, clock } = paced();
  let waited = 0;
  for (let load = 0; load < 5; load += 1) {
    const wait = pace.reserve(STORE);
    waited += wait;
    clock.now += wait + 2_200;
  }
  assert.ok(waited <= 4 * (spacingMs - 2_200), `waited ${waited} ms`);
});

test("a 429 holds the origin's next load until it is waited out and doubles its spacing, up to the cap, for good", () => {
  const { pace, clock } = paced();
  pace.reserve(STORE);
  clock.now += 100;
  assert.equal(pace.noteRefusal(STORE, 429), true);
  assert.equal(pace.spacingOf(STORE), 2 * spacingMs);
  assert.equal(pace.reserve(STORE), refusalWaitMs, "the next load waits out the refusal from when it was seen");
  clock.now += refusalWaitMs;
  assert.equal(pace.reserve(STORE), 2 * spacingMs, "and every load after it keeps the slower spacing");
  pace.noteRefusal(STORE, 503);
  assert.equal(pace.spacingOf(STORE), cooledSpacingCapMs, "a second refusal doubles again, held to the cap");
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
  assert.equal(pace.reserve(OTHER), spacingMs);
  assert.equal(pace.spacingOf(OTHER), spacingMs);
});

test("the wait before an origin's next load is read without booking it: none for an origin never seen, the refusal wait after a refusal", () => {
  const { pace, clock } = paced();
  assert.equal(pace.waitBeforeNextLoad(STORE), 0, "an origin with no load booked waits for nothing");
  assert.equal(pace.reserve(STORE), 0);
  assert.equal(pace.waitBeforeNextLoad(STORE), spacingMs, "one spacing after the load just booked");
  assert.equal(pace.waitBeforeNextLoad(STORE), spacingMs, "and reading it books nothing");
  pace.noteRefusal(STORE, 429);
  assert.equal(pace.waitBeforeNextLoad(STORE), refusalWaitMs);
  clock.now += refusalWaitMs + 1;
  assert.equal(pace.waitBeforeNextLoad(STORE), 0, "a wait already over is no wait");
  assert.equal(pace.waitBeforeNextLoad(OTHER), 0, "other origins are untouched");
});
