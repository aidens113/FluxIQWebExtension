// Coverage of storage.ts's reader: a kept value that is not an ended pairing
// reads as nothing, so a damaged record never shows a browser as revoked.

import assert from "node:assert/strict";
import test from "node:test";

import { readPairingEnded } from "../storage";
import { PairingEndedMemory } from "../memory";

test("a kept ended pairing reads back with its state, reason and time", () => {
  assert.deepEqual(readPairingEnded({ state: "revoked", reason: "revoked_by_user", at: 7 }), { state: "revoked", reason: "revoked_by_user", at: 7 });
  assert.deepEqual(readPairingEnded({ state: "expired", at: 8 }), { state: "expired", at: 8 });
});

test("anything else reads as nothing", () => {
  for (const stored of [undefined, null, "revoked", [], { state: "paused", at: 1 }, { state: "revoked" }, { state: "revoked", at: Number.NaN }]) {
    assert.equal(readPairingEnded(stored), undefined, JSON.stringify(stored));
  }
  assert.equal(readPairingEnded({ state: "refused", reason: "", at: 1 })?.reason, undefined, "an empty reason is no reason");
});

test("a note made in this worker wins over what an earlier one kept", async () => {
  let kept: unknown = { state: "revoked", at: 1 };
  let release: () => void = () => undefined;
  const reading = new Promise<void>((resolve) => { release = resolve; });
  const memory = new PairingEndedMemory({
    read: async () => {
      await reading;
      return readPairingEnded(kept);
    },
    write: async (ended) => { kept = ended; }
  });
  const loaded = memory.load();
  await memory.clear();
  release();
  assert.equal(await loaded, false);
  assert.equal(memory.current(), undefined);
});
