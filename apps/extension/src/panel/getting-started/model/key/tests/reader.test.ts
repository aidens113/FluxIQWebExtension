// The model key reader: reads on connect, beats while missing or locked, stops when ready,
// re-reads on focus, and ignores a late answer from an earlier read.

import assert from "node:assert/strict";
import test from "node:test";
import { createModelKeyReader, type KeyReaderHost } from "../reader";
import type { ModelKeyReading } from "../reading";

function rig(answers: Array<ModelKeyReading | Promise<ModelKeyReading>>) {
  const timers: Array<{ run: () => void; ms: number; live: boolean }> = [];
  let reads = 0;
  let changes = 0;
  const host: KeyReaderHost = {
    setTimeout: (run, ms) => {
      const timer = {
        run: () => {
          timer.live = false;
          run();
        },
        ms,
        live: true
      };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (handle) => {
      if (handle) (handle as { live: boolean }).live = false;
    }
  };
  const port = { readModelKey: async () => answers[Math.min(reads++, answers.length - 1)]! };
  const reader = createModelKeyReader(port, host, () => {
    changes += 1;
  });
  const live = () => timers.filter((timer) => timer.live);
  const settle = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  return { reader, timers, live, settle, reads: () => reads, changes: () => changes };
}

test("not connected: nothing is read and the reading is unknown", async () => {
  const r = rig(["missing"]);
  r.reader.observe(false);
  await r.settle();
  assert.equal(r.reads(), 0);
  assert.equal(r.reader.current(), "unknown");
});

test("a missing key is read again on a short beat, and the beat ends the moment it is ready", async () => {
  const r = rig(["missing", "missing", "ready"]);
  r.reader.observe(true);
  await r.settle();
  assert.equal(r.reader.current(), "missing");
  assert.equal(r.live().length, 1);
  assert.ok(r.live()[0]!.ms <= 5000, "a short beat");
  r.live()[0]!.run();
  await r.settle();
  assert.equal(r.live().length, 1, "still missing: beats on");
  r.live()[0]!.run();
  await r.settle();
  assert.equal(r.reader.current(), "ready");
  assert.equal(r.live().length, 0, "ready: no more beats");
  assert.equal(r.changes(), 2);
});

test("a locked key beats like a missing one", async () => {
  const r = rig(["locked", "ready"]);
  r.reader.observe(true);
  await r.settle();
  assert.equal(r.reader.current(), "locked");
  assert.equal(r.live().length, 1);
});

test("unknown never beats: it says nothing, so nothing waits on it", async () => {
  const r = rig(["unknown"]);
  r.reader.observe(true);
  await r.settle();
  assert.equal(r.live().length, 0);
});

test("refreshing (the panel regained focus) reads again, even after ready; disconnecting stops everything and forgets the reading", async () => {
  const r = rig(["ready", "missing"]);
  r.reader.observe(true);
  await r.settle();
  assert.equal(r.reader.current(), "ready");
  r.reader.refresh();
  await r.settle();
  assert.equal(r.reader.current(), "missing", "a key removed meanwhile is noticed on focus");
  r.reader.observe(false);
  assert.equal(r.reader.current(), "unknown");
  assert.equal(r.live().length, 0);
});

test("a late answer from an earlier read never overwrites a newer one", async () => {
  let release!: (value: ModelKeyReading) => void;
  const slow = new Promise<ModelKeyReading>((resolve) => { release = resolve; });
  const r = rig([slow, "ready"]);
  r.reader.observe(true);
  r.reader.refresh();
  await r.settle();
  assert.equal(r.reader.current(), "ready");
  release("missing");
  await r.settle();
  assert.equal(r.reader.current(), "ready");
});
