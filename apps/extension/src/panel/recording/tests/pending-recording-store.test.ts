import assert from "node:assert/strict";
import test from "node:test";
import { createPendingRecordingStore, parsePendingRecording, PENDING_MAX_AGE_MS, PENDING_RECORDING_KEY } from "../pending-recording-store";

const NOW = 1_000_000_000;

test("only a whole, recent record is trusted", () => {
  const good = { description: "Add a coffee", known: ["a"], at: NOW - 1000 };
  assert.deepEqual(parsePendingRecording(good, NOW), good);
  for (const bad of [undefined, null, [], "x", { ...good, description: "" }, { ...good, known: [1] }, { ...good, at: "now" }, { ...good, at: NOW - PENDING_MAX_AGE_MS - 1 }, { ...good, at: NOW + 10 * 60_000 }]) {
    assert.equal(parsePendingRecording(bad, NOW), undefined);
  }
});

test("the store round-trips through chrome.storage.local and survives storage failing", async () => {
  const memory: Record<string, unknown> = {};
  const scope = globalThis as unknown as { chrome?: unknown };
  const previous = scope.chrome;
  scope.chrome = { runtime: { lastError: undefined }, storage: { local: {
    get: (keys: string[], done: (items: Record<string, unknown>) => void) => done({ [keys[0]!]: memory[keys[0]!] }),
    set: (values: Record<string, unknown>, done: () => void) => {
      Object.assign(memory, values);
      done();
    },
    remove: (key: string, done: () => void) => {
      delete memory[key];
      done();
    }
  } } };
  try {
    const store = createPendingRecordingStore(() => NOW);
    await store.write({ description: "Add a coffee", known: ["a"], at: NOW });
    assert.deepEqual(await store.read(), { description: "Add a coffee", known: ["a"], at: NOW });
    assert.ok(PENDING_RECORDING_KEY in memory);
    await store.clear();
    assert.equal(await store.read(), undefined);
    const blocked = () => {
      throw new Error("blocked");
    };
    scope.chrome = { runtime: {}, storage: { local: { get: blocked, set: blocked, remove: blocked } } };
    assert.equal(await store.read(), undefined);
    await store.write({ description: "x", known: [], at: NOW });
    await store.clear();
  } finally {
    scope.chrome = previous;
  }
});
