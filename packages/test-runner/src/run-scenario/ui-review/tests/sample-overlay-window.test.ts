import assert from "node:assert/strict";
import test from "node:test";
import { sampleOverlayWindow, type OverlaySample } from "../index.js";

test("a window reads about every interval from its start for its duration, and counts what it read", async () => {
  let clock = 10_000;
  const reads: number[] = [];
  const texts = ["A", "A", "B", "A"];
  const window = await sampleOverlayWindow({
    cdp: { send: async () => undefined }, secrets: [], pageUrl: "http://127.0.0.1:1/start",
    intervalMs: 200, durationMs: 600,
    now: () => clock,
    sleep: async ms => { clock += ms; },
    read: async (_cdp, atMs): Promise<OverlaySample> => { reads.push(atMs); const text = texts[reads.length - 1] ?? "A"; clock += 30; return { atMs, present: true, hostCount: 1, visible: true, text, textParts: [text] }; },
  });
  assert.deepEqual(reads, [0, 200, 400, 600], "scheduled from the start: a 30 ms read does not push the next one later");
  assert.equal(window.samples.length, 4);
  assert.equal(window.pageUrl, "http://127.0.0.1:1/start");
  assert.equal(window.counts.textChanges, 2);
  assert.equal(window.counts.textRevisits, 1);
  assert.equal(window.counts.status, "flickering");
});

test("a read slower than the interval is followed at once rather than stretching the window further", async () => {
  let clock = 0;
  const reads: number[] = [];
  let slept = 0;
  await sampleOverlayWindow({
    cdp: { send: async () => undefined }, secrets: [], intervalMs: 200, durationMs: 400,
    now: () => clock, sleep: async ms => { slept += ms; clock += ms; },
    read: async (_cdp, atMs) => { reads.push(atMs); clock += 350; return { atMs, present: false, hostCount: 0, visible: false }; },
  });
  assert.deepEqual(reads, [0, 350, 700]);
  assert.equal(slept, 0, "every read was already due");
});
