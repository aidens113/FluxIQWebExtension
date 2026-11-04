import assert from "node:assert/strict";
import test from "node:test";
import { keepOverlayPlacement, recallOverlayPlacement } from "../overlay-placement";

function withStorage(stored: Record<string, unknown>, run: () => Promise<void>): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { storage: { local: {
    get: async (key: string) => (key in stored ? { [key]: stored[key] } : {}),
    set: async (items: Record<string, unknown>) => { Object.assign(stored, items); }
  } } } });
  return run().finally(() => {
    if (previous) Object.defineProperty(globalThis, "chrome", previous);
    else delete (globalThis as { chrome?: unknown }).chrome;
  });
}

const KEY = "fluxiq.activity.overlayPlacement";

test("keeps and gives back a placement, and nothing else in storage", async () => {
  const stored: Record<string, unknown> = { "fluxiq.session": { token: "dummy-credential" } };
  await withStorage(stored, async () => {
    assert.deepEqual(await keepOverlayPlacement({ shape: "pill", anchor: "top-left", offset: 4 }), { ok: true });
    const answer = await recallOverlayPlacement();
    assert.deepEqual(answer, { placement: { shape: "pill", anchor: "top-left", offset: 4 } });
    assert.ok(!JSON.stringify(answer).includes("dummy-credential"));
  });
});

test("refuses a value that is not small enough to be a placement, so a content script cannot fill the extension's storage", async () => {
  const stored: Record<string, unknown> = {};
  await withStorage(stored, async () => {
    for (const value of [null, "text", { shape: "x".repeat(100), anchor: "top-left" }, { shape: "pill", anchor: "top-left", extra: "x".repeat(100_000) }, { shape: "pill", anchor: "top-left", offset: "far" }]) {
      assert.deepEqual(await keepOverlayPlacement(value), { ok: false });
    }
    assert.equal(KEY in stored, false);
  });
});
