// The offline queue's byte budget: four fifths of the session storage quota the
// browser names, or of 10 MB when it names none, so queued snapshots can never
// fill the area the in-flight records and leases share.

import assert from "node:assert/strict";
import test from "node:test";

import { extensionOutboxByteBudget } from "../index";

test("the queue is given four fifths of the quota the browser names", () => {
  assert.equal(extensionOutboxByteBudget(10_485_760), 8_388_608);
  assert.equal(extensionOutboxByteBudget(1_048_576), 838_860);
});

test("a browser that names no usable quota gets four fifths of 10 MB", () => {
  for (const quota of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, "10485760"]) {
    assert.equal(extensionOutboxByteBudget(quota), 8_388_608, String(quota));
  }
});

test("by default the quota is read from chrome.storage.session", () => {
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  holder.chrome = { storage: { session: { QUOTA_BYTES: 2_000_000 } } };
  try {
    assert.equal(extensionOutboxByteBudget(), 1_600_000);
  } finally {
    holder.chrome = previous;
  }
});
