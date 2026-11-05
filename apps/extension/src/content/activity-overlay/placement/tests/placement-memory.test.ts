import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import { browserPlacementMemory } from "../placement-memory";

// A content script may not read the extension's storage, because the credential is in it:
// the overlay's place goes through the background, and the storage is never touched here.

function withChrome(reply: unknown, run: (sent: unknown[]) => Promise<void>): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const sent: unknown[] = [];
  const storage = new Proxy({}, { get: () => { throw new Error("a content script touched the extension's storage"); } });
  const sendMessage = async (message: unknown): Promise<unknown> => {
    sent.push(message);
    return reply;
  };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { storage, runtime: { sendMessage } } });
  return run(sent).finally(() => {
    if (previous) Object.defineProperty(globalThis, "chrome", previous);
    else delete (globalThis as { chrome?: unknown }).chrome;
  });
}

test("recalls through the background, and ignores what is not a placement", async () => {
  await withChrome({ placement: { shape: "pill", anchor: "top-left" } }, async (sent) => {
    assert.deepEqual(await browserPlacementMemory.recall(), { shape: "pill", anchor: "top-left" });
    assert.deepEqual(sent, [{ type: RUNTIME_MESSAGES.overlayPlacementRecall }]);
  });
  await withChrome({ placement: { shape: "circle", anchor: "nowhere" } }, async () => {
    assert.equal(await browserPlacementMemory.recall(), undefined);
  });
});

test("keeps through the background", async () => {
  await withChrome({ ok: true }, async (sent) => {
    browserPlacementMemory.keep({ shape: "narrow", anchor: "bottom-right", offset: 2 });
    assert.deepEqual(sent, [{ type: RUNTIME_MESSAGES.overlayPlacementKeep, placement: { shape: "narrow", anchor: "bottom-right", offset: 2 } }]);
  });
});

test("with no extension runtime there is nothing to recall and nothing waits", () => {
  assert.equal(browserPlacementMemory.recall(), undefined);
  browserPlacementMemory.keep({ shape: "pill", anchor: "top-left" });
});
