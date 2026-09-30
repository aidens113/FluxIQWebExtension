// T1 coverage of the ignored-press watch (`ignored-press-watch.ts`): it settles
// at once on a sign the press's own handler left, as soon as a later sign
// arrives, and with nothing only once the window has passed. The page is faked
// at the probe, so each row states what the page did and checks what the watch
// concluded.

import assert from "node:assert/strict";
import test from "node:test";
import { watchIgnoredPress, type IgnoredPressProbe } from "../ignored-press-watch";
import type { PressSignal } from "../press-again";

const PRESSED = {} as Element;

type FakeProbe = { probe: IgnoredPressProbe; emit(signal: PressSignal): void; queue(signal: PressSignal): void; stopped: () => number };

/** A probe whose signs arrive through `emit` (delivered at once) or `queue` (delivered on the next flush). */
function fakeProbe(): FakeProbe {
  let note: ((signal: PressSignal) => void) | undefined;
  const queued: PressSignal[] = [];
  let stops = 0;
  return {
    probe: (_pressed, onSignal) => {
      note = onSignal;
      return {
        flush: () => queued.splice(0).forEach((signal) => note?.(signal)),
        stop: () => {
          stops += 1;
        }
      };
    },
    emit: (signal) => note?.(signal),
    queue: (signal) => queued.push(signal),
    stopped: () => stops
  };
}

test("a press the page did nothing about settles with nothing seen, once the window has passed", async () => {
  const page = fakeProbe();
  const watch = watchIgnoredPress(PRESSED, page.probe);
  const started = Date.now();
  const answer = await watch.settle(120);
  assert.deepEqual(answer.seen, []);
  assert.ok(Date.now() - started >= 110, "the whole window was waited");
  assert.equal(page.stopped(), 1);
});

test("a sign the press's own handler queued is flushed and answers at once, without waiting", async () => {
  const page = fakeProbe();
  const watch = watchIgnoredPress(PRESSED, page.probe);
  page.queue("change");
  const started = Date.now();
  const answer = await watch.settle(5_000);
  assert.deepEqual(answer.seen, ["change"]);
  assert.ok(Date.now() - started < 1_000);
});

test("a request that arrives inside the window ends the watch when it arrives", async () => {
  const page = fakeProbe();
  const watch = watchIgnoredPress(PRESSED, page.probe);
  setTimeout(() => page.emit("request"), 30);
  const started = Date.now();
  const answer = await watch.settle(5_000);
  assert.deepEqual(answer.seen, ["request"]);
  assert.ok(Date.now() - started < 1_000);
});

test("a sign queued inside the final interval is read at the deadline, not reported as none", async () => {
  const page = fakeProbe();
  const watch = watchIgnoredPress(PRESSED, page.probe);
  setTimeout(() => page.queue("focus"), 55);
  const answer = await watch.settle(60);
  assert.deepEqual(answer.seen, ["focus"]);
});

test("each sign is reported once, in the order first seen", async () => {
  const page = fakeProbe();
  const watch = watchIgnoredPress(PRESSED, page.probe);
  page.emit("change");
  page.emit("request");
  page.emit("change");
  const answer = await watch.settle(500);
  assert.deepEqual(answer.seen, ["change", "request"]);
});

test("stopping without settling stops the listener once, however often it is called", () => {
  const page = fakeProbe();
  const watch = watchIgnoredPress(PRESSED, page.probe);
  watch.stop();
  watch.stop();
  assert.equal(page.stopped(), 1);
});
